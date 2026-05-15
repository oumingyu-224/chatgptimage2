import { AITaskStatus } from '@/extensions/ai/types';
import { respData, respErr } from '@/shared/lib/resp';
import {
  findAITaskById,
  updateAITaskByIdWithGuards,
} from '@/shared/models/ai_task';
import {
  dispatchImageAITask,
  dispatchQueuedImageAITasks,
  recoverExpiredImageTaskClaims,
  triggerQueuedImageDispatch,
} from '@/shared/services/ai_task_dispatch';
import { logAITaskEvent } from '@/shared/services/ai_task_log';
import { getUserInfo } from '@/shared/models/user';
import { refreshAITaskStatus } from '@/shared/services/ai_task_status';

const STALE_IMAGE_TASK_TIMEOUT_MS = 30 * 60 * 1000;

export function safeQueryErrorMessage(error: any) {
  const message = String(error?.message || '').trim();
  const safeMessages = new Set([
    'invalid params',
    'unauthorized',
    'task not found',
    'no permission',
  ]);

  if (safeMessages.has(message)) {
    return message;
  }

  return 'query ai task failed';
}

function isStaleImageActiveTask(task: any) {
  if (
    !task ||
    task.mediaType !== 'image' ||
    (task.status !== AITaskStatus.PENDING &&
      task.status !== AITaskStatus.PROCESSING)
  ) {
    return false;
  }

  const updatedAt = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
  return !!updatedAt && Date.now() - updatedAt >= STALE_IMAGE_TASK_TIMEOUT_MS;
}

async function failStaleImageTask(task: any) {
  const failedTask = await updateAITaskByIdWithGuards({
    id: task.id,
    expectedStatuses: [AITaskStatus.PENDING, AITaskStatus.PROCESSING],
    expectedTaskId: task.taskId || null,
    expectedUpdatedAt: task.updatedAt || null,
    updateAITask: {
      status: AITaskStatus.FAILED,
      taskInfo: JSON.stringify({
        errorMessage: 'timeout',
      }),
      taskResult: JSON.stringify({
        errorMessage: 'timeout',
      }),
      creditId: task.creditId,
    },
  });

  if (!failedTask) {
    return (await findAITaskById(task.id)) || task;
  }

  logAITaskEvent('query_task_timeout_failed', {
    taskId: task.id,
    previousStatus: task.status,
  });

  return failedTask;
}

export function createFailStaleImageTaskForTest(deps: {
  findAITaskById: typeof findAITaskById;
  updateAITaskByIdWithGuards: typeof updateAITaskByIdWithGuards;
}) {
  return async function failStaleImageTaskForTest(task: any) {
    const failedTask = await deps.updateAITaskByIdWithGuards({
      id: task.id,
      expectedStatuses: [AITaskStatus.PENDING, AITaskStatus.PROCESSING],
      expectedTaskId: task.taskId || null,
      expectedUpdatedAt: task.updatedAt || null,
      updateAITask: {
        status: AITaskStatus.FAILED,
        taskInfo: JSON.stringify({
          errorMessage: 'timeout',
        }),
        taskResult: JSON.stringify({
          errorMessage: 'timeout',
        }),
        creditId: task.creditId,
      },
    });

    if (!failedTask) {
      return (await deps.findAITaskById(task.id)) || task;
    }

    return failedTask;
  };
}

export async function POST(req: Request) {
  try {
    const { taskId } = await req.json();
    if (!taskId) {
      return respErr('invalid params');
    }

    const user = await getUserInfo();
    if (!user) {
      return respErr('unauthorized');
    }

    const task = await findAITaskById(taskId);
    if (!task) {
      return respErr('task not found');
    }

    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    if (
      task.status === AITaskStatus.SUCCESS ||
      task.status === AITaskStatus.FAILED ||
      task.status === AITaskStatus.CANCELED
    ) {
      return respData(task);
    }

    if (!task.taskId) {
      if (
        (task.status === AITaskStatus.QUEUED ||
          task.status === AITaskStatus.PENDING) &&
        task.mediaType === 'image'
      ) {
        if (task.status === AITaskStatus.PENDING) {
          await recoverExpiredImageTaskClaims(1, task.id);
        }
        const latestTask = (await findAITaskById(task.id)) || task;
        const dispatchedTask = await dispatchImageAITask(latestTask);
        if (dispatchedTask?.status === AITaskStatus.QUEUED) {
          await triggerQueuedImageDispatch();
        }
        logAITaskEvent('query_task', {
          taskId: task.id,
          previousStatus: task.status,
          status: dispatchedTask?.status || latestTask.status,
        });
        return respData(dispatchedTask || latestTask);
      }

      return respData(task);
    }

    const previousStatus = task.status;
    let updatedTask = task;
    try {
      updatedTask = await refreshAITaskStatus(task);
    } catch (error: any) {
      if (isStaleImageActiveTask(task)) {
        updatedTask = await failStaleImageTask(task);
        await dispatchQueuedImageAITasks(1);
        await triggerQueuedImageDispatch(1);
        return respData(updatedTask);
      }
      if (
        task.mediaType === 'image' &&
        (task.status === AITaskStatus.PENDING ||
          task.status === AITaskStatus.PROCESSING)
      ) {
        logAITaskEvent('query_status_refresh_deferred', {
          taskId: task.id,
          previousStatus,
          error: error?.message || 'query ai task failed',
        });
        return respData(task);
      }
      throw error;
    }
    if (isStaleImageActiveTask(task) && isStaleImageActiveTask(updatedTask)) {
      updatedTask = await failStaleImageTask({
        ...task,
        ...updatedTask,
      });
    }
    if (
      updatedTask?.mediaType === 'image' &&
      (updatedTask.status === AITaskStatus.SUCCESS ||
        updatedTask.status === AITaskStatus.FAILED ||
        updatedTask.status === AITaskStatus.CANCELED)
    ) {
      await dispatchQueuedImageAITasks(1);
      await triggerQueuedImageDispatch(1);
    }
    logAITaskEvent('query_task', {
      taskId: task.id,
      previousStatus,
      status: updatedTask?.status || previousStatus,
    });
    return respData(updatedTask);
  } catch (e: any) {
    logAITaskEvent('query_failed', {
      error: e?.message || 'query ai task failed',
    });
    console.log('ai query failed', e);
    return respErr(safeQueryErrorMessage(e));
  }
}

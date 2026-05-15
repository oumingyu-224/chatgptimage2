import { envConfigs } from '@/config';
import { AITaskStatus } from '@/extensions/ai/types';
import { respOk } from '@/shared/lib/resp';
import { findAITaskByProviderTaskId } from '@/shared/models/ai_task';
import {
  dispatchQueuedImageAITasks,
  triggerQueuedImageDispatch,
} from '@/shared/services/ai_task_dispatch';
import { logAITaskEvent } from '@/shared/services/ai_task_log';
import { refreshAITaskStatus } from '@/shared/services/ai_task_status';

function parseNotifyTokens() {
  return String(envConfigs.ai_notify_tokens || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function respNotifyErr(message: string, status: number) {
  return Response.json(
    {
      code: -1,
      message,
    },
    { status }
  );
}

function extractTaskId(payload: any): string {
  const candidates = [
    payload?.taskId,
    payload?.task_id,
    payload?.request_id,
    payload?.requestId,
    payload?.id,
    payload?.data?.taskId,
    payload?.data?.task_id,
    payload?.data?.request_id,
    payload?.data?.requestId,
    payload?.data?.id,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!provider) {
      return respNotifyErr('provider is required', 400);
    }
    const notifyTokens = parseNotifyTokens();
    const requestToken = new URL(req.url).searchParams.get('token')?.trim();
    if (
      notifyTokens.length > 0 &&
      (!requestToken || !notifyTokens.includes(requestToken))
    ) {
      return respNotifyErr('invalid notify token', 401);
    }

    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      return respNotifyErr('invalid payload', 400);
    }

    const taskId = extractTaskId(payload);
    if (!taskId) {
      return respNotifyErr('task id not found', 400);
    }

    const task = await findAITaskByProviderTaskId({ provider, taskId });
    if (!task) {
      return respNotifyErr('task not found', 404);
    }

    if (
      task.status === AITaskStatus.SUCCESS ||
      task.status === AITaskStatus.FAILED ||
      task.status === AITaskStatus.CANCELED
    ) {
      logAITaskEvent('notify_task_ignored', {
        provider,
        taskId,
        status: task.status,
      });
      return respOk();
    }

    const updatedTask = await refreshAITaskStatus(task);
    if (
      updatedTask?.mediaType === 'image' &&
      (updatedTask.status === AITaskStatus.SUCCESS ||
        updatedTask.status === AITaskStatus.FAILED ||
        updatedTask.status === AITaskStatus.CANCELED)
    ) {
      await dispatchQueuedImageAITasks(2);
      await triggerQueuedImageDispatch(2);
    }
    logAITaskEvent('notify_task_processed', {
      provider,
      taskId,
      status: updatedTask?.status || '',
    });
    return respOk();
  } catch (e: any) {
    logAITaskEvent('notify_failed', {
      error: e?.message || 'ai notify failed',
    });
    console.log('ai notify failed', e);
    return respNotifyErr(e.message || 'ai notify failed', 500);
  }
}

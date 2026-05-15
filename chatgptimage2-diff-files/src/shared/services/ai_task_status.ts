import {
  UpdateAITask,
  findAITaskById,
  updateAITaskByIdWithGuards,
} from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import {
  createProviderByChannel,
  findChannelById,
} from '@/shared/services/ai_channels';
import { getAIService } from '@/shared/services/ai';
import { buildMockImageQueryResult } from '@/shared/services/ai_task_mock';
import {
  normalizeTaskInfoForDualUrls,
  triggerAsyncR2Migration,
} from '@/shared/services/ai_storage_migration';
import { triggerAsyncAITaskShowcaseSync } from '@/shared/services/ai_task_showcase';
import { logAITaskEvent } from '@/shared/services/ai_task_log';
import { AITaskStatus } from '@/extensions/ai';

export async function refreshAITaskStatus(task: any) {
  if (task.mediaType === 'image' && task.taskId?.startsWith('mock_')) {
    return applyAITaskQueryResult(task, buildMockImageQueryResult(task));
  }

  let aiProvider: any = null;
  let channelId = '';
  let resolvedConfigs: any = null;

  try {
    const options = task.options ? JSON.parse(task.options) : {};
    channelId = options?.__providerChannelId || '';
  } catch {}

  if (channelId) {
    resolvedConfigs = await getAllConfigs();
    const channel = findChannelById(resolvedConfigs, channelId);
    if (channel) {
      aiProvider = createProviderByChannel(channel, resolvedConfigs);
    }
  }

  if (!aiProvider) {
    const aiService = await getAIService();
    aiProvider = aiService.getProvider(task.provider);
  }

  if (!aiProvider) {
    throw new Error('invalid ai provider');
  }

  const result = await aiProvider?.query?.({
    taskId: task.taskId,
    mediaType: task.mediaType,
    model: task.model,
  });

  return applyAITaskQueryResult(task, result, resolvedConfigs);
}

async function applyAITaskQueryResult(
  task: any,
  result: any,
  resolvedConfigs?: any
) {
  if (!result?.taskStatus) {
    throw new Error('query ai task failed');
  }

  let nextTaskInfo = result.taskInfo;
  let shouldAsyncMigrate = false;
  if (task.mediaType === 'image' && result.taskInfo) {
    let previousTaskInfo: any = undefined;
    try {
      previousTaskInfo = task.taskInfo ? JSON.parse(task.taskInfo) : undefined;
    } catch {}

    const normalized = normalizeTaskInfoForDualUrls({
      latestTaskInfo: result.taskInfo,
      previousTaskInfo,
    });
    nextTaskInfo = normalized.taskInfo;
    shouldAsyncMigrate = result.taskStatus === 'success' && normalized.hasPending;
  }

  const updateAITask: UpdateAITask = {
    status: result.taskStatus,
    taskInfo: nextTaskInfo ? JSON.stringify(nextTaskInfo) : null,
    taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
    creditId: task.creditId,
  };
  const shouldUpdateTask =
    updateAITask.status !== task.status ||
    updateAITask.taskInfo !== task.taskInfo ||
    updateAITask.taskResult !== task.taskResult ||
    updateAITask.creditId !== task.creditId;

  let persistedTask: any = null;
  if (shouldUpdateTask) {
    persistedTask = await updateAITaskByIdWithGuards({
      id: task.id,
      expectedStatus: task.status,
      expectedTaskId: task.taskId || null,
      expectedUpdatedAt: task.updatedAt || null,
      updateAITask,
    });

    if (!persistedTask) {
      return (await findAITaskById(task.id)) || task;
    }

    logAITaskEvent('status_refreshed', {
      taskId: task.id,
      previousStatus: task.status,
      status: updateAITask.status,
      provider: task.provider,
      model: task.model,
    });
  }

  task.status = updateAITask.status || '';
  task.taskInfo = updateAITask.taskInfo || null;
  task.taskResult = updateAITask.taskResult || null;
  if (persistedTask?.updatedAt) {
    task.updatedAt = persistedTask.updatedAt;
  }

  if (shouldAsyncMigrate) {
    triggerAsyncR2Migration(task.id, resolvedConfigs || (await getAllConfigs()));
  }
  if (updateAITask.status === AITaskStatus.SUCCESS) {
    triggerAsyncAITaskShowcaseSync(task.id);
  }

  return task;
}

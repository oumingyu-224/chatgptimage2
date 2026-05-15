import { envConfigs } from '@/config';
import { AIMediaType } from '@/extensions/ai';
import { AITaskStatus } from '@/extensions/ai/types';
import { getUuid, md5 } from '@/shared/lib/hash';
import {
  getImageGenerationCostCredits,
  normalizeImageResolution,
} from '@/shared/lib/image-generation';
import { respData, respErr } from '@/shared/lib/resp';
import {
  createAITask,
  createAITaskIfAbsent,
  findAITaskById,
  findReusableAITask,
  getActiveAITasksCount,
  getStaleActiveAITasks,
  getStaleQueuedAITasks,
  NewAITask,
  updateAITaskById,
  updateAITaskByIdWithGuards,
} from '@/shared/models/ai_task';
import { shouldRotateImageTaskId } from '@/shared/lib/idempotency';
import { getAllConfigs } from '@/shared/models/config';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import {
  createProviderByChannel,
  getEnabledImageChannels,
} from '@/shared/services/ai_channels';
import {
  dispatchQueuedImageAITasks,
  dispatchImageAITask,
  recoverExpiredImageTaskClaims,
  triggerQueuedImageDispatch,
} from '@/shared/services/ai_task_dispatch';
import { getAIService } from '@/shared/services/ai';
import { logAITaskEvent } from '@/shared/services/ai_task_log';
import { refreshAITaskStatus } from '@/shared/services/ai_task_status';

type GenerateRequestBody = {
  provider: string;
  mediaType: string;
  model: string;
  prompt?: string;
  options?: any;
  scene?: string;
  idempotencyKey?: string;
};

const STALE_ACTIVE_TASK_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_ACTIVE_IMAGE_TASKS = 3;
const ACTIVE_TASK_CLEANUP_BATCH_SIZE = 30;

function parseNotifyTokens() {
  return String(envConfigs.ai_notify_tokens || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeWebhookTokenInUrl(value: string) {
  if (!value.includes('/api/ai/notify/')) {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.searchParams.has('token')) {
      url.searchParams.set('token', '***');
      return url.toString();
    }
  } catch {}
  return value.replace(/([?&]token=)[^&]+/gi, '$1***');
}

function sanitizeSensitiveData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeWebhookTokenInUrl(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSensitiveData(item));
  }
  if (data && typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeSensitiveData(value);
    }
    return result;
  }
  return data;
}

export function safeErrorMessage(error: any) {
  const message = String(error?.message || '').trim();
  const safeMessages = new Set([
    'invalid params',
    'prompt or options is required',
    'no auth, please sign in',
    'insufficient credits',
    'invalid scene',
    'invalid mediaType',
    'selected ai model is not available',
    'no available ai provider',
    'all providers failed',
    'invalid provider',
    'too many active tasks',
  ]);
  if (safeMessages.has(message)) {
    return message;
  }
  return 'generate failed';
}

function getNotifyCallbackUrl(provider: string) {
  const notifyToken = parseNotifyTokens()[0];
  if (!notifyToken) {
    return `${envConfigs.app_url}/api/ai/notify/${provider}`;
  }
  return `${envConfigs.app_url}/api/ai/notify/${provider}?token=${encodeURIComponent(notifyToken)}`;
}

export function sanitizeGenerateOptions(options: any) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return {};
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key.startsWith('__')) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function buildRequestFingerprint({
  mediaType,
  provider,
  model,
  prompt,
  scene,
  options,
  idempotencyKey,
}: {
  mediaType: string;
  provider?: string;
  model?: string;
  prompt?: string;
  scene?: string;
  options?: any;
  idempotencyKey?: string;
}) {
  return md5(
    JSON.stringify({
      mediaType,
      provider: provider || '',
      model: model || '',
      prompt: prompt || '',
      scene: scene || '',
      options: sanitizeGenerateOptions(options),
      idempotencyKey: idempotencyKey || '',
    })
  );
}

function buildAtomicImageTaskId({
  userId,
  requestFingerprint,
  idempotencyKey,
}: {
  userId: string;
  requestFingerprint: string;
  idempotencyKey?: string;
}) {
  if (idempotencyKey) {
    return `aiimg_${md5(`${userId}:${idempotencyKey}`)}`;
  }

  const minuteBucket = Math.floor(Date.now() / (60 * 1000));
  return `aiimg_${md5(`${userId}:${requestFingerprint}:${minuteBucket}`)}`;
}

async function failTaskIfUnchanged(task: any) {
  return updateAITaskByIdWithGuards({
    id: task.id,
    expectedStatus: task.status,
    expectedTaskId:
      Object.prototype.hasOwnProperty.call(task, 'taskId') ? task.taskId || null : undefined,
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
}

export async function POST(request: Request) {
  try {
    let {
      provider,
      mediaType,
      model,
      prompt,
      options,
      scene,
      idempotencyKey,
    } = (await request.json()) as GenerateRequestBody;

    if (!mediaType) {
      throw new Error('invalid params');
    }

    if (mediaType !== AIMediaType.IMAGE && (!provider || !model)) {
      throw new Error('invalid params');
    }

    if (!prompt && !options) {
      throw new Error('prompt or options is required');
    }

    const normalizedPrompt = String(prompt || '');

    if (options && typeof options === 'object' && !Array.isArray(options)) {
      if ('resolution' in options) {
        options = {
          ...options,
          resolution: normalizeImageResolution(String(options.resolution || '')),
        };
      }
    }

    // get current user
    const user = await getUserInfo();
    if (!user) {
      throw new Error('no auth, please sign in');
    }

    let costCredits = 4;

    if (mediaType === AIMediaType.IMAGE) {
      // generate image
      if (scene !== 'image-to-image' && scene !== 'text-to-image') {
        throw new Error('invalid scene');
      }
      costCredits = getImageGenerationCostCredits({
        scene,
        resolution: options?.resolution,
      });
    } else if (mediaType === AIMediaType.VIDEO) {
      // generate video
      if (scene === 'text-to-video') {
        costCredits = 6;
      } else if (scene === 'image-to-video') {
        costCredits = 8;
      } else if (scene === 'video-to-video') {
        costCredits = 10;
      } else {
        throw new Error('invalid scene');
      }
    } else if (mediaType === AIMediaType.MUSIC) {
      // generate music
      costCredits = 10;
      scene = 'text-to-music';
    } else {
      throw new Error('invalid mediaType');
    }

    // check credits
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < costCredits) {
      throw new Error('insufficient credits');
    }

    const requestFingerprint = buildRequestFingerprint({
      mediaType,
      provider,
      model,
      prompt: normalizedPrompt,
      scene,
      options,
      idempotencyKey,
    });
    const sanitizedOptions = sanitizeGenerateOptions(options);

    const reusableTask = await findReusableAITask({
      userId: user.id,
      mediaType,
      provider,
      model,
      requestFingerprint,
    });
    if (reusableTask) {
      logAITaskEvent('generate_reused_task', {
        userId: user.id,
        taskId: reusableTask.id,
        mediaType,
        provider: reusableTask.provider,
        model: reusableTask.model,
      });
      return respData(reusableTask);
    }

    let result: any = null;
    let usedProvider = provider;
    let usedModel = model;
    let usedChannelId = '';
    let taskRecord: any = null;
    const providerAttempts: Array<{
      channelId: string;
      channelName: string;
      provider: string;
      model: string;
      priority: number;
      status: 'failed';
      error: string;
    }> = [];

    if (mediaType === AIMediaType.IMAGE) {
      const configs = await getAllConfigs();
      const allChannels = getEnabledImageChannels(configs);
      const channels =
        provider && model
          ? allChannels.filter(
              (channel) =>
                channel.provider === provider && channel.model === model
            )
          : allChannels;

      if (channels.length === 0) {
        throw new Error(
          provider && model
            ? 'selected ai model is not available'
            : 'no available ai provider'
        );
      }

      const initialChannel = channels[0];
      let initialTaskId = buildAtomicImageTaskId({
        userId: user.id,
        requestFingerprint,
        idempotencyKey,
      });
      const existingTaskWithSameId = await findAITaskById(initialTaskId);
      if (shouldRotateImageTaskId(existingTaskWithSameId?.status)) {
        initialTaskId = `${initialTaskId}_${getUuid().slice(0, 8)}`;
      }
      const createTask = () =>
        createAITaskIfAbsent({
          newAITask: {
            id: initialTaskId,
            userId: user.id,
            mediaType,
            provider: initialChannel.provider,
            model: initialChannel.model,
            prompt: normalizedPrompt,
            scene,
            options: JSON.stringify({
              ...sanitizedOptions,
              __requestFingerprint: requestFingerprint,
              __idempotencyKey: idempotencyKey || null,
              __requestedProvider: provider || null,
              __requestedModel: model || null,
              __providerAttempts: providerAttempts,
            }),
            status: AITaskStatus.QUEUED,
            costCredits,
            taskId: null,
            taskInfo: null,
            taskResult: null,
          },
          maxActiveTasks: MAX_ACTIVE_IMAGE_TASKS,
        });

      let createResult: Awaited<ReturnType<typeof createAITaskIfAbsent>>;
      try {
        createResult = await createTask();
      } catch (error: any) {
        if (String(error?.message || '') !== 'too many active tasks') {
          throw error;
        }

        let activeUserTaskCount = await getActiveAITasksCount({
          userId: user.id,
          mediaType: AIMediaType.IMAGE,
        });
        if (activeUserTaskCount >= MAX_ACTIVE_IMAGE_TASKS) {
          await recoverExpiredImageTaskClaims(ACTIVE_TASK_CLEANUP_BATCH_SIZE);
          activeUserTaskCount = await getActiveAITasksCount({
            userId: user.id,
            mediaType: AIMediaType.IMAGE,
          });
        }

        if (activeUserTaskCount >= MAX_ACTIVE_IMAGE_TASKS) {
          const staleQueuedTasks = await getStaleQueuedAITasks({
            userId: user.id,
            mediaType: AIMediaType.IMAGE,
            updatedBefore: new Date(Date.now() - STALE_ACTIVE_TASK_TIMEOUT_MS),
            limit: ACTIVE_TASK_CLEANUP_BATCH_SIZE,
          });

          for (const queuedTask of staleQueuedTasks) {
            const latestTask =
              (await findAITaskById(queuedTask.id)) || queuedTask;

            if (latestTask.status !== AITaskStatus.QUEUED) {
              continue;
            }

            const dispatchedTask = await dispatchImageAITask(latestTask);
            if (dispatchedTask?.status !== AITaskStatus.QUEUED) {
              continue;
            }

            await failTaskIfUnchanged(latestTask);
          }

          activeUserTaskCount = await getActiveAITasksCount({
            userId: user.id,
            mediaType: AIMediaType.IMAGE,
          });
        }

        if (activeUserTaskCount >= MAX_ACTIVE_IMAGE_TASKS) {
          const staleTasks = await getStaleActiveAITasks({
            userId: user.id,
            mediaType: AIMediaType.IMAGE,
            updatedBefore: new Date(Date.now() - STALE_ACTIVE_TASK_TIMEOUT_MS),
            limit: ACTIVE_TASK_CLEANUP_BATCH_SIZE,
          });

          for (const activeTask of staleTasks) {
            try {
              const refreshedTask = await refreshAITaskStatus(activeTask);
              if (
                refreshedTask.status === AITaskStatus.PENDING ||
                refreshedTask.status === AITaskStatus.PROCESSING
              ) {
                await failTaskIfUnchanged(refreshedTask);
              }
            } catch {
              await failTaskIfUnchanged(activeTask);
            }
          }
        }

        await recoverExpiredImageTaskClaims(ACTIVE_TASK_CLEANUP_BATCH_SIZE);
        await dispatchQueuedImageAITasks(3);
        createResult = await createTask();
      }

      taskRecord = createResult.task;

      if (!createResult.created) {
        logAITaskEvent('generate_reused_task', {
          userId: user.id,
          taskId: taskRecord.id,
          mediaType,
          provider: taskRecord.provider,
          model: taskRecord.model,
        });
        if (taskRecord.status === AITaskStatus.QUEUED) {
          const dispatchedTask = await dispatchImageAITask(taskRecord);
          if (dispatchedTask?.status === AITaskStatus.QUEUED) {
            await triggerQueuedImageDispatch();
          }
          return respData(dispatchedTask || taskRecord);
        }
        return respData(taskRecord);
      }

      const dispatchedTask = await dispatchImageAITask(taskRecord);
      if (!dispatchedTask) {
        throw new Error('generate failed');
      }
      logAITaskEvent('generate_created_task', {
        userId: user.id,
        taskId: dispatchedTask.id,
        mediaType,
        status: dispatchedTask.status,
        provider: dispatchedTask.provider,
        model: dispatchedTask.model,
      });
      if (dispatchedTask.status === AITaskStatus.QUEUED) {
        await triggerQueuedImageDispatch();
      }
      return respData(dispatchedTask);
    } else {
      const activeUserTaskCount = await getActiveAITasksCount({
        userId: user.id,
        mediaType,
      });
      if (activeUserTaskCount >= 3) {
        throw new Error('too many active tasks');
      }
      const aiService = await getAIService();

      // check generate type
      if (!aiService.getMediaTypes().includes(mediaType)) {
        throw new Error('invalid mediaType');
      }

      // check ai provider
      const aiProvider = aiService.getProvider(provider);
      if (!aiProvider) {
        throw new Error('invalid provider');
      }

      const callbackUrl = getNotifyCallbackUrl(provider);

      const params: any = {
        mediaType,
        model,
        prompt,
        callbackUrl,
        options,
      };

      // generate content
      result = await aiProvider.generate({ params });
      if (!result?.taskId) {
        throw new Error(
          `ai generate failed, mediaType: ${mediaType}, provider: ${provider}, model: ${model}`
        );
      }
    }

    if (taskRecord?.id) {
      const updatedTask = await updateAITaskById(taskRecord.id, {
        provider: usedProvider,
        model: usedModel,
        options: JSON.stringify({
          ...sanitizedOptions,
          __requestFingerprint: requestFingerprint,
          __idempotencyKey: idempotencyKey || null,
          __providerChannelId: usedChannelId,
          __providerAttempts: providerAttempts,
        }),
        status: result.taskStatus,
        taskId: result.taskId,
        taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
        taskResult: result.taskResult
          ? JSON.stringify(sanitizeSensitiveData(result.taskResult))
          : null,
        creditId: taskRecord.creditId,
      });
      logAITaskEvent('generate_created_task', {
        userId: user.id,
        taskId: updatedTask.id,
        mediaType,
        status: updatedTask.status,
        provider: updatedTask.provider,
        model: updatedTask.model,
      });
      return respData(updatedTask);
    }

    const newAITask: NewAITask = {
      id: getUuid(),
      userId: user.id,
      mediaType,
      provider: usedProvider,
      model: usedModel,
      prompt: normalizedPrompt,
      scene,
      options: JSON.stringify({
        ...sanitizedOptions,
        __requestFingerprint: requestFingerprint,
        __idempotencyKey: idempotencyKey || null,
        __providerChannelId: usedChannelId,
        __providerAttempts: providerAttempts,
      }),
      status: result.taskStatus,
      costCredits,
      taskId: result.taskId,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult
        ? JSON.stringify(sanitizeSensitiveData(result.taskResult))
        : null,
    };
    await createAITask(newAITask);
    logAITaskEvent('generate_created_task', {
      userId: user.id,
      taskId: newAITask.id,
      mediaType,
      status: newAITask.status,
      provider: newAITask.provider,
      model: newAITask.model,
    });

    return respData(newAITask);
  } catch (e: any) {
    logAITaskEvent('generate_failed', {
      error: e?.message || 'generate failed',
    });
    console.log('generate failed', e);
    return respErr(safeErrorMessage(e));
  }
}

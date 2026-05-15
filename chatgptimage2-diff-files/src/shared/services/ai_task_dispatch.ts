import { envConfigs } from '@/config';
import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import { getUuid } from '@/shared/lib/hash';
import { findAITaskById } from '@/shared/models/ai_task';
import {
  getActiveAITasksCount,
  getQueuedAITasks,
  getStalePendingAITasks,
  updateAITaskById,
  updateAITaskByIdWithGuards,
} from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import {
  createProviderByChannel,
  getEnabledImageChannels,
} from '@/shared/services/ai_channels';
import {
  normalizeTaskInfoForDualUrls,
  triggerAsyncR2Migration,
} from '@/shared/services/ai_storage_migration';
import { createMockImageGenerateResult } from '@/shared/services/ai_task_mock';
import { triggerAsyncAITaskShowcaseSync } from '@/shared/services/ai_task_showcase';
import { logAITaskEvent } from '@/shared/services/ai_task_log';

const PROVIDER_ACTIVE_LIMIT = 20;
const DEFAULT_DISPATCH_LIMIT = 3;
const MAX_DISPATCH_LIMIT = 20;
const MAX_QUEUE_RETRY_COUNT = 8;
const BASE_QUEUE_RETRY_DELAY_MS = 5 * 1000;
const MAX_QUEUE_RETRY_DELAY_MS = 60 * 1000;
const CLAIM_LEASE_TIMEOUT_MS = 90 * 1000;
const CLAIM_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const CLAIM_RECOVERY_REDISPATCH_DELAY_MS = CLAIM_LEASE_TIMEOUT_MS;

function parseNotifyTokens() {
  return String(envConfigs.ai_notify_tokens || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDispatchTokens() {
  return String(envConfigs.ai_dispatch_tokens || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNotifyCallbackUrl(provider: string) {
  const notifyToken = parseNotifyTokens()[0];
  if (!notifyToken) {
    return `${envConfigs.app_url}/api/ai/notify/${provider}`;
  }
  return `${envConfigs.app_url}/api/ai/notify/${provider}?token=${encodeURIComponent(notifyToken)}`;
}

function parseTaskOptions(options?: string | null) {
  if (!options) {
    return {};
  }

  try {
    return JSON.parse(options);
  } catch {
    return {};
  }
}

function parseTaskPayload(payload?: string | null) {
  if (!payload) {
    return undefined;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function getNextQueueRetryDelayMs(dispatchCount: number) {
  const exponent = Math.max(0, dispatchCount - 1);
  return Math.min(
    MAX_QUEUE_RETRY_DELAY_MS,
    BASE_QUEUE_RETRY_DELAY_MS * 2 ** exponent
  );
}

function getTaskDispatchMeta(options: Record<string, any>) {
  const dispatchCount = Number(options?.__dispatchCount || 0);
  const nextDispatchAt = Number(options?.__nextDispatchAt || 0);
  const lastDispatchError =
    typeof options?.__lastDispatchError === 'string'
      ? options.__lastDispatchError
      : '';
  const queueRetryReason =
    typeof options?.__queueRetryReason === 'string'
      ? options.__queueRetryReason
      : '';

  return {
    dispatchCount: Number.isFinite(dispatchCount)
      ? Math.max(0, dispatchCount)
      : 0,
    nextDispatchAt: Number.isFinite(nextDispatchAt)
      ? Math.max(0, nextDispatchAt)
      : 0,
    lastDispatchError,
    queueRetryReason,
  };
}

function isQueuedTaskReady(task: any) {
  if (!task || task.status !== AITaskStatus.QUEUED) {
    return false;
  }

  const options = parseTaskOptions(task.options);
  const { nextDispatchAt } = getTaskDispatchMeta(options);
  return !nextDispatchAt || nextDispatchAt <= Date.now();
}

function getTimeValue(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function didDispatchAdvanceTask(currentTask: any, nextTask: any) {
  if (!nextTask || nextTask.id !== currentTask?.id) {
    return false;
  }

  if (nextTask.status !== AITaskStatus.QUEUED) {
    return true;
  }

  return (
    nextTask.taskId !== currentTask?.taskId ||
    getTimeValue(nextTask.updatedAt) !== getTimeValue(currentTask?.updatedAt) ||
    nextTask.options !== currentTask?.options ||
    nextTask.taskInfo !== currentTask?.taskInfo
  );
}

function getDispatchClaimToken(options: Record<string, any>) {
  return typeof options?.__dispatchClaimToken === 'string'
    ? options.__dispatchClaimToken
    : '';
}

function buildClaimedTaskOptions(
  options: Record<string, any>,
  claimToken: string | null
) {
  return {
    ...options,
    __dispatchClaimToken: claimToken,
  };
}

export function sanitizeProviderOptions(options: Record<string, any>) {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(options)) {
    if (key.startsWith('__')) {
      continue;
    }
    result[key] = value;
  }

  return result;
}

function isRetryableDispatchError(errorMessage: string) {
  const message = errorMessage.toLowerCase();

  return [
    'timeout',
    'timed out',
    'rate limit',
    'too many request',
    'overloaded',
    'temporarily unavailable',
    'service unavailable',
    'internal error',
    'internal server error',
    'network',
    'econnreset',
    'etimedout',
    'socket hang up',
  ].some((keyword) => message.includes(keyword));
}

function buildQueuedRetryUpdate({
  task,
  options,
  providerAttempts,
  dispatchCount,
  retryReason,
  lastDispatchError,
}: {
  task: any;
  options: Record<string, any>;
  providerAttempts: any[];
  dispatchCount: number;
  retryReason: string;
  lastDispatchError?: string;
}) {
  const nextDispatchCount = dispatchCount + 1;
  const nextDispatchAt =
    Date.now() + getNextQueueRetryDelayMs(nextDispatchCount);

  return {
    status: AITaskStatus.QUEUED,
    taskInfo: JSON.stringify({
      status: AITaskStatus.QUEUED,
      attempts: providerAttempts,
      dispatchCount: nextDispatchCount,
      nextDispatchAt,
      retryReason,
      lastDispatchError: lastDispatchError || '',
    }),
    taskResult: null,
    options: JSON.stringify({
      ...buildClaimedTaskOptions(options, null),
      __providerAttempts: providerAttempts,
      __dispatchCount: nextDispatchCount,
      __nextDispatchAt: nextDispatchAt,
      __queueRetryReason: retryReason,
      __lastDispatchError: lastDispatchError || '',
    }),
    creditId: task.creditId,
  };
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

type DispatchDeps = {
  findAITaskById: typeof findAITaskById;
  getActiveAITasksCount: typeof getActiveAITasksCount;
  getStalePendingAITasks: typeof getStalePendingAITasks;
  updateAITaskById: typeof updateAITaskById;
  updateAITaskByIdWithGuards: typeof updateAITaskByIdWithGuards;
  getAllConfigs: typeof getAllConfigs;
  getEnabledImageChannels: typeof getEnabledImageChannels;
  createProviderByChannel: typeof createProviderByChannel;
};

async function claimQueuedAITaskLease(deps: DispatchDeps, currentTask: any) {
  const options = parseTaskOptions(currentTask.options);
  const claimToken = getUuid();

  return deps.updateAITaskByIdWithGuards({
    id: currentTask.id,
    expectedStatus: AITaskStatus.QUEUED,
    expectedTaskId: null,
    expectedUpdatedAt: currentTask.updatedAt || null,
    expectedOptions: currentTask.options || null,
    updateAITask: {
      status: AITaskStatus.PENDING,
      options: JSON.stringify(buildClaimedTaskOptions(options, claimToken)),
    },
  });
}

async function updateClaimedTask(
  deps: DispatchDeps,
  claimedTask: any,
  updateAITask: any
) {
  const updatedTask = await deps.updateAITaskByIdWithGuards({
    id: claimedTask.id,
    expectedStatus: AITaskStatus.PENDING,
    expectedTaskId: null,
    expectedOptions: claimedTask.options || null,
    updateAITask,
  });

  if (updatedTask) {
    return updatedTask;
  }

  return deps.findAITaskById(claimedTask.id);
}

async function adoptLateClaimedTaskResult(
  deps: DispatchDeps,
  latestTask: any,
  updateAITask: any
) {
  if (
    !latestTask ||
    latestTask.mediaType !== AIMediaType.IMAGE ||
    latestTask.taskId ||
    (latestTask.status !== AITaskStatus.QUEUED &&
      latestTask.status !== AITaskStatus.PENDING)
  ) {
    return latestTask;
  }

  const adoptedTask = await deps.updateAITaskByIdWithGuards({
    id: latestTask.id,
    expectedStatus: latestTask.status,
    expectedTaskId: null,
    expectedUpdatedAt: latestTask.updatedAt || null,
    expectedOptions: latestTask.options || null,
    updateAITask,
  });

  if (adoptedTask) {
    logAITaskEvent('dispatch_late_result_adopted', {
      taskId: latestTask.id,
      previousStatus: latestTask.status,
      status: adoptedTask.status,
      provider: adoptedTask.provider,
      model: adoptedTask.model,
    });
    return adoptedTask;
  }

  return deps.findAITaskById(latestTask.id);
}

async function dispatchClaimedImageAITask(deps: DispatchDeps, claimedTask: any) {
  const options = parseTaskOptions(claimedTask.options);
  const providerOptions = sanitizeProviderOptions(options);
  const providerAttempts = Array.isArray(options?.__providerAttempts)
    ? [...options.__providerAttempts]
    : [];
  const { dispatchCount } = getTaskDispatchMeta(options);
  const requestedProvider = options?.__requestedProvider || '';
  const requestedModel = options?.__requestedModel || '';
  const claimToken = getDispatchClaimToken(options);

  if (dispatchCount >= MAX_QUEUE_RETRY_COUNT) {
    logAITaskEvent('dispatch_retry_exhausted', {
      taskId: claimedTask.id,
      dispatchCount,
      providerAttempts: providerAttempts.length,
    });
    return updateClaimedTask(deps, claimedTask, {
      status: AITaskStatus.FAILED,
      taskInfo: JSON.stringify({
        errorMessage: 'queue retry limit exceeded',
        attempts: providerAttempts,
        dispatchCount,
      }),
      taskResult: JSON.stringify({
        errorMessage: 'queue retry limit exceeded',
        attempts: providerAttempts,
        dispatchCount,
      }),
      options: JSON.stringify({
        ...buildClaimedTaskOptions(options, null),
        __dispatchCount: dispatchCount,
        __nextDispatchAt: null,
        __queueRetryReason: '',
      }),
      creditId: claimedTask.creditId,
    });
  }

  const configs = await deps.getAllConfigs();
  const channels = deps.getEnabledImageChannels(configs).filter((channel) => {
    if (!requestedProvider || !requestedModel) {
      return true;
    }
    return (
      channel.provider === requestedProvider &&
      channel.model === requestedModel
    );
  });

  if (channels.length === 0) {
    return updateClaimedTask(deps, claimedTask, {
      status: AITaskStatus.FAILED,
      taskInfo: JSON.stringify({
        errorMessage: 'no available ai provider',
        attempts: providerAttempts,
      }),
      taskResult: JSON.stringify({
        errorMessage: 'no available ai provider',
        attempts: providerAttempts,
      }),
      options: JSON.stringify(buildClaimedTaskOptions(options, null)),
      creditId: claimedTask.creditId,
    });
  }

  let hadRetryableSubmissionFailure = false;
  let hadNonRetryableSubmissionFailure = false;
  let hadBusyProvider = false;

  for (const channel of channels) {
    const activeProviderTaskCount = await deps.getActiveAITasksCount({
      provider: channel.provider,
      mediaType: claimedTask.mediaType,
      excludeTaskId: claimedTask.id,
      includeQueued: false,
    });
    if (activeProviderTaskCount >= PROVIDER_ACTIVE_LIMIT) {
      hadBusyProvider = true;
      providerAttempts.push({
        channelId: channel.id,
        channelName: channel.name,
        provider: channel.provider,
        model: channel.model,
        priority: channel.priority,
        status: 'failed',
        error: 'provider busy',
      });
      continue;
    }

    let heartbeatId: ReturnType<typeof setInterval> | null = null;
    try {
      heartbeatId = setInterval(() => {
        deps
          .updateAITaskByIdWithGuards({
            id: claimedTask.id,
            expectedStatus: AITaskStatus.PENDING,
            expectedTaskId: null,
            expectedOptions: claimedTask.options || null,
            updateAITask: {
              taskInfo: JSON.stringify({
                status: AITaskStatus.PENDING,
                claimToken,
              }),
            },
          })
          .catch(() => {});
      }, CLAIM_HEARTBEAT_INTERVAL_MS);

      const result = providerOptions.mock_generation
        ? createMockImageGenerateResult(claimedTask.id)
        : await (async () => {
            const aiProvider = deps.createProviderByChannel(channel, configs);
            const callbackUrl = getNotifyCallbackUrl(channel.provider);
            return aiProvider.generate({
              params: {
                mediaType: claimedTask.mediaType,
                model: channel.model,
                prompt: claimedTask.prompt,
                callbackUrl,
                options: providerOptions,
              },
            });
          })();

      if (heartbeatId) {
        clearInterval(heartbeatId);
        heartbeatId = null;
      }

      if (!result?.taskId) {
        throw new Error('no task id');
      }

      let nextTaskInfo = result.taskInfo;
      let shouldAsyncMigrate = false;
      if (result.taskStatus === AITaskStatus.SUCCESS && result.taskInfo) {
        const normalized = normalizeTaskInfoForDualUrls({
          latestTaskInfo: result.taskInfo,
          previousTaskInfo: parseTaskPayload(claimedTask.taskInfo),
        });
        nextTaskInfo = normalized.taskInfo;
        shouldAsyncMigrate = normalized.hasPending;
      }

      const successUpdate = {
        provider: channel.provider,
        model: channel.model,
        status: result.taskStatus,
        taskId: result.taskId,
        taskInfo: nextTaskInfo ? JSON.stringify(nextTaskInfo) : null,
        taskResult: result.taskResult
          ? JSON.stringify(sanitizeSensitiveData(result.taskResult))
          : null,
        options: JSON.stringify({
          ...buildClaimedTaskOptions(options, null),
          __providerChannelId: channel.id,
          __providerAttempts: providerAttempts,
          __dispatchCount: dispatchCount,
          __nextDispatchAt: null,
          __queueRetryReason: '',
          __lastDispatchError: '',
        }),
        creditId: claimedTask.creditId,
      };
      let updatedTask = await updateClaimedTask(
        deps,
        claimedTask,
        successUpdate
      );

      if (updatedTask && !updatedTask.taskId) {
        updatedTask = await adoptLateClaimedTaskResult(
          deps,
          updatedTask,
          successUpdate
        );
      }

      if (!updatedTask) {
        return null;
      }

      if (shouldAsyncMigrate) {
        triggerAsyncR2Migration(claimedTask.id, configs);
      }
      if (result.taskStatus === AITaskStatus.SUCCESS) {
        triggerAsyncAITaskShowcaseSync(claimedTask.id);
      }

      return updatedTask;
    } catch (e: any) {
      if (heartbeatId) {
        clearInterval(heartbeatId);
      }
      const errorMessage = sanitizeWebhookTokenInUrl(e?.message || 'failed');
      const retryable = isRetryableDispatchError(errorMessage);
      if (retryable) {
        hadRetryableSubmissionFailure = true;
      } else {
        hadNonRetryableSubmissionFailure = true;
      }
      providerAttempts.push({
        channelId: channel.id,
        channelName: channel.name,
        provider: channel.provider,
        model: channel.model,
        priority: channel.priority,
        status: 'failed',
        error: errorMessage,
        retryable,
      });
    }
  }

  if (hadBusyProvider || hadRetryableSubmissionFailure) {
    const lastAttempt = [...providerAttempts]
      .reverse()
      .find((attempt) => attempt.retryable || attempt.error === 'provider busy');
    const updatePayload = buildQueuedRetryUpdate({
      task: claimedTask,
      options,
      providerAttempts,
      dispatchCount,
      retryReason: hadBusyProvider
        ? 'provider busy'
        : 'retryable provider error',
      lastDispatchError: lastAttempt?.error || 'provider busy',
    });
    logAITaskEvent('dispatch_retry_scheduled', {
      taskId: claimedTask.id,
      retryReason: hadBusyProvider
        ? 'provider busy'
        : 'retryable provider error',
      dispatchCount: dispatchCount + 1,
      error: lastAttempt?.error || '',
    });
    return updateClaimedTask(deps, claimedTask, updatePayload);
  }

  logAITaskEvent('dispatch_failed', {
    taskId: claimedTask.id,
    dispatchCount: dispatchCount + 1,
    providerAttempts: providerAttempts.length,
  });
  return updateClaimedTask(deps, claimedTask, {
    status: AITaskStatus.FAILED,
    taskInfo: JSON.stringify({
      errorMessage: 'all providers failed',
      attempts: providerAttempts,
    }),
    taskResult: JSON.stringify({
      errorMessage: 'all providers failed',
      attempts: providerAttempts,
    }),
    options: JSON.stringify({
      ...buildClaimedTaskOptions(options, null),
      __providerAttempts: providerAttempts,
      __dispatchCount: dispatchCount + 1,
      __nextDispatchAt: null,
      __queueRetryReason: '',
      __lastDispatchError: '',
    }),
    creditId: claimedTask.creditId,
  });
}

export function createRecoverExpiredImageTaskClaims(deps: {
  getStalePendingAITasks: typeof getStalePendingAITasks;
  updateAITaskByIdWithGuards: typeof updateAITaskByIdWithGuards;
}) {
  return async function recoverExpiredImageTaskClaims(
    limit = MAX_DISPATCH_LIMIT,
    taskId?: string
  ) {
    const staleTasks = await deps.getStalePendingAITasks({
      mediaType: AIMediaType.IMAGE,
      taskId,
      updatedBefore: new Date(Date.now() - CLAIM_LEASE_TIMEOUT_MS),
      limit: Math.max(1, Math.min(MAX_DISPATCH_LIMIT, limit)),
    });

    for (const task of staleTasks) {
      const options = parseTaskOptions(task.options);
      const providerAttempts = Array.isArray(options?.__providerAttempts)
        ? [...options.__providerAttempts]
        : [];
      const { dispatchCount } = getTaskDispatchMeta(options);

      const nextDispatchAt = Date.now() + CLAIM_RECOVERY_REDISPATCH_DELAY_MS;
      const recoveredTask = await deps.updateAITaskByIdWithGuards({
        id: task.id,
        expectedStatus: AITaskStatus.PENDING,
        expectedTaskId: null,
        expectedUpdatedAt: task.updatedAt || null,
        expectedOptions: task.options || null,
        updateAITask: {
          status: AITaskStatus.QUEUED,
          taskInfo: JSON.stringify({
            status: AITaskStatus.QUEUED,
            attempts: providerAttempts,
            dispatchCount,
            nextDispatchAt,
            retryReason: 'dispatch claim expired',
          }),
          options: JSON.stringify({
            ...buildClaimedTaskOptions(options, null),
            __nextDispatchAt: nextDispatchAt,
            __queueRetryReason: 'dispatch claim expired',
          }),
          creditId: task.creditId,
        },
      });

      if (!recoveredTask) {
        continue;
      }

      logAITaskEvent('claim_recovered', {
        taskId: task.id,
        mediaType: task.mediaType,
        provider: task.provider,
        model: task.model,
        dispatchCount,
      });
    }

    return staleTasks.length;
  };
}

export function createDispatchImageAITask(deps: DispatchDeps) {
  return async function dispatchImageAITask(taskOrId: any) {
    const currentTask =
      typeof taskOrId === 'string'
        ? await deps.findAITaskById(taskOrId)
        : taskOrId;

    if (!currentTask || currentTask.mediaType !== AIMediaType.IMAGE) {
      return currentTask;
    }

    if (currentTask.status !== AITaskStatus.QUEUED) {
      return currentTask;
    }

    if (!isQueuedTaskReady(currentTask)) {
      return currentTask;
    }

    const claimedTask = await claimQueuedAITaskLease(deps, currentTask);
    if (!claimedTask) {
      return deps.findAITaskById(currentTask.id);
    }

    return dispatchClaimedImageAITask(deps, claimedTask);
  };
}

export const dispatchImageAITask = createDispatchImageAITask({
  findAITaskById,
  getActiveAITasksCount,
  getStalePendingAITasks,
  updateAITaskById,
  updateAITaskByIdWithGuards,
  getAllConfigs,
  getEnabledImageChannels,
  createProviderByChannel,
});

export const recoverExpiredImageTaskClaims = createRecoverExpiredImageTaskClaims({
  getStalePendingAITasks,
  updateAITaskByIdWithGuards,
});

export function createDispatchQueuedImageAITasks(deps: {
  recoverExpiredImageTaskClaims: typeof recoverExpiredImageTaskClaims;
  getQueuedAITasks: typeof getQueuedAITasks;
  dispatchImageAITask: typeof dispatchImageAITask;
}) {
  return async function dispatchQueuedImageAITasks(limit = 3) {
    await deps.recoverExpiredImageTaskClaims(limit);

    const queuedTasks = await deps.getQueuedAITasks({
      mediaType: AIMediaType.IMAGE,
      limit: Math.max(limit * 5, limit),
    });

    let dispatched = 0;
    for (const task of queuedTasks) {
      if (dispatched >= limit) {
        break;
      }
      if (!isQueuedTaskReady(task)) {
        continue;
      }
      const nextTask = await deps.dispatchImageAITask(task);
      if (didDispatchAdvanceTask(task, nextTask)) {
        dispatched += 1;
      }
    }

    return {
      scanned: queuedTasks.length,
      dispatched,
    };
  };
}

export const dispatchQueuedImageAITasks = createDispatchQueuedImageAITasks({
  recoverExpiredImageTaskClaims,
  getQueuedAITasks,
  dispatchImageAITask,
});

export function isValidDispatchToken(token?: string | null) {
  if (!token) {
    return false;
  }

  return parseDispatchTokens().includes(token.trim());
}

export function getDispatchTokenFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization')?.trim() || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const headerToken =
    req.headers.get('x-ai-dispatch-token')?.trim() ||
    req.headers.get('x-internal-token')?.trim();
  if (headerToken) {
    return headerToken;
  }

  return new URL(req.url).searchParams.get('token')?.trim() || '';
}

export function normalizeDispatchLimit(value: string | number | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DISPATCH_LIMIT;
  }

  return Math.min(MAX_DISPATCH_LIMIT, Math.max(1, Math.floor(parsed)));
}

export async function triggerQueuedImageDispatch(limit = DEFAULT_DISPATCH_LIMIT) {
  const tokens = parseDispatchTokens();
  const dispatchToken = tokens[0];
  const appUrl = String(envConfigs.app_url || '').trim();

  if (!dispatchToken || !appUrl || !/^https?:\/\//i.test(appUrl)) {
    return false;
  }

  try {
    const url = new URL('/api/ai/dispatch', appUrl);
    url.searchParams.set('limit', String(normalizeDispatchLimit(limit)));

    void fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dispatchToken}`,
      },
    }).catch((error) => {
      logAITaskEvent('dispatch_trigger_failed', {
        limit,
        error: error?.message || String(error),
      });
      console.log('trigger queued image dispatch failed', error);
    });

    return true;
  } catch (error) {
    logAITaskEvent('dispatch_trigger_failed', {
      limit,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('trigger queued image dispatch failed', error);
    return false;
  }
}

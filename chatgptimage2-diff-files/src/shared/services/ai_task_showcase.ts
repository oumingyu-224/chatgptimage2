import { AITaskStatus } from '@/extensions/ai';

import { runInBackground } from '@/shared/lib/background-task';
import { buildShowcaseTitleFromPrompt } from '@/shared/lib/showcase-title';
import { extractHairstyleTags } from '@/shared/lib/tags';
import {
  findAITaskById,
  updateAITaskById,
  updateAITaskByIdAndTaskInfo,
} from '@/shared/models/ai_task';
import { addShowcaseIfAbsent, NewShowcase } from '@/shared/models/showcase';

const syncingTaskIds = new Set<string>();
const SHOWCASE_SAVING_TIMEOUT_MS = 10 * 60 * 1000;

function parseJson(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getPreferredManagedImageUrl(taskInfo: any) {
  if (Array.isArray(taskInfo?.storage?.images)) {
    for (const item of taskInfo.storage.images) {
      if (typeof item?.r2Url === 'string' && item.r2Url) {
        return item.r2Url;
      }
    }
    return '';
  }

  const output = Array.isArray(taskInfo?.output) ? taskInfo.output : [];
  for (const item of output) {
    if (typeof item === 'string' && item) {
      return item;
    }
    if (typeof item?.url === 'string' && item.url) {
      return item.url;
    }
  }

  return '';
}

function buildNextTaskInfo(taskInfo: any, patch: Record<string, any>) {
  return {
    ...(taskInfo || {}),
    showcase: {
      ...(taskInfo?.showcase || {}),
      ...patch,
    },
  };
}

function isExpiredStatus(updatedAt?: string | null, timeoutMs = SHOWCASE_SAVING_TIMEOUT_MS) {
  if (!updatedAt) {
    return true;
  }

  const value = new Date(updatedAt).getTime();
  if (!Number.isFinite(value)) {
    return true;
  }

  return Date.now() - value >= timeoutMs;
}

export async function syncAITaskShowcase(taskId: string) {
  const task = await findAITaskById(taskId);
  if (!task || task.mediaType !== 'image' || task.status !== AITaskStatus.SUCCESS) {
    return { ok: false, skipped: true, reason: 'task not ready' as const };
  }

  const options = parseJson(task.options) || {};
  if (options.__saveShowcase !== true) {
    return { ok: false, skipped: true, reason: 'showcase disabled' as const };
  }

  const taskInfo = parseJson(task.taskInfo);
  if (!taskInfo) {
    return { ok: false, skipped: true, reason: 'invalid task info' as const };
  }

  if (taskInfo?.showcase?.status === 'success') {
    return { ok: true, skipped: true, reason: 'already saved' as const };
  }

  if (
    taskInfo?.showcase?.status === 'saving' &&
    !isExpiredStatus(taskInfo?.showcase?.updatedAt)
  ) {
    return { ok: true, skipped: true, reason: 'already saving' as const };
  }

  const image = getPreferredManagedImageUrl(taskInfo);
  if (!image) {
    return { ok: false, skipped: true, reason: 'image not ready' as const };
  }

  const title = buildShowcaseTitleFromPrompt(task.prompt);
  let tags =
    typeof options.__showcaseTags === 'string' && options.__showcaseTags.trim()
      ? options.__showcaseTags.trim()
      : null;
  if (tags === 'hairstyles' && task.prompt) {
    tags = extractHairstyleTags(task.prompt, title);
  }

  const currentTaskInfoText = task.taskInfo || JSON.stringify(taskInfo);
  const savingTaskInfo = buildNextTaskInfo(taskInfo, {
    status: 'saving',
    image,
    error: null,
    updatedAt: new Date().toISOString(),
  });
  const claimedTask = await updateAITaskByIdAndTaskInfo({
    id: task.id,
    expectedTaskInfo: currentTaskInfoText,
    updateAITask: {
      taskInfo: JSON.stringify(savingTaskInfo),
      creditId: task.creditId,
    },
  });

  if (!claimedTask) {
    return { ok: true, skipped: true, reason: 'concurrent saving' as const };
  }

  const newShowcase: NewShowcase = {
    id: task.id,
    userId: task.userId,
    title: title.trim(),
    prompt: task.prompt?.trim() || null,
    image,
    tags,
    isPublic:
      options.__showcaseIsPublic === true ||
      options.__showcaseIsPublic === 'true' ||
      options.__showcaseIsPublic === 1,
  };
  const showcase = await addShowcaseIfAbsent(newShowcase);

  if (!showcase) {
    await updateAITaskById(task.id, {
      taskInfo: JSON.stringify(
        buildNextTaskInfo(savingTaskInfo, {
          status: 'failed',
          image,
          error: 'save showcase failed',
          updatedAt: new Date().toISOString(),
        })
      ),
      creditId: task.creditId,
    });
    return { ok: false, skipped: false, reason: 'save failed' as const };
  }

  await updateAITaskById(task.id, {
    taskInfo: JSON.stringify(
      buildNextTaskInfo(savingTaskInfo, {
        status: 'success',
        image,
        showcaseId: showcase.id,
        error: null,
        updatedAt: new Date().toISOString(),
      })
    ),
    creditId: task.creditId,
  });

  return { ok: true, skipped: false };
}

export function triggerAsyncAITaskShowcaseSync(taskId: string) {
  if (syncingTaskIds.has(taskId)) {
    return;
  }

  syncingTaskIds.add(taskId);

  const run = syncAITaskShowcase(taskId)
    .catch((error) => {
      console.error('async showcase sync failed:', error);
    })
    .finally(() => {
      syncingTaskIds.delete(taskId);
    });

  runInBackground(run);
}

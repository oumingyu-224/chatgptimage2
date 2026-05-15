import { getTranslations } from 'next-intl/server';

import { redirect } from '@/core/i18n/navigation';
import { AITaskStatus } from '@/extensions/ai';
import { Empty } from '@/shared/blocks/common';
import { findAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import {
  dispatchImageAITask,
  recoverExpiredImageTaskClaims,
  triggerQueuedImageDispatch,
} from '@/shared/services/ai_task_dispatch';
import { refreshAITaskStatus } from '@/shared/services/ai_task_status';

export default async function RefreshAITaskPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations('activity.ai-tasks');
  const user = await getUserInfo();
  if (!user) {
    return <Empty message={t('messages.auth_required')} />;
  }

  const task = await findAITaskById(id);
  if (!task || task.userId !== user.id || !task.status) {
    return <Empty message={t('messages.task_not_found')} />;
  }

  if (
    task.mediaType === 'image' &&
    !task.taskId &&
    [AITaskStatus.QUEUED, AITaskStatus.PENDING].includes(
      task.status as AITaskStatus
    )
  ) {
    if (task.status === AITaskStatus.PENDING) {
      await recoverExpiredImageTaskClaims(1, task.id);
    }
    const latestTask = (await findAITaskById(task.id)) || task;
    const dispatchedTask = await dispatchImageAITask(latestTask);
    if (dispatchedTask?.status === AITaskStatus.QUEUED) {
      await triggerQueuedImageDispatch();
    }
  } else if (
    task.taskId &&
    [AITaskStatus.PENDING, AITaskStatus.PROCESSING].includes(
      task.status as AITaskStatus
    )
  ) {
    await refreshAITaskStatus(task);
  }

  redirect({ href: `/activity/ai-tasks`, locale });
}

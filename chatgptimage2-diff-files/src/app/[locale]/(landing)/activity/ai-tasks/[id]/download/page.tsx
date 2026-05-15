import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { getAITaskImageUrls } from '@/shared/lib/ai-task-media';
import { findAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';

import DownloadClient from './download-client';

function getTaskDownloadUrls(task: {
  provider?: string | null;
  model?: string | null;
  taskInfo?: string | null;
  taskResult?: string | null;
}) {
  return getAITaskImageUrls(task);
}

export default async function DownloadAITaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('activity.ai-tasks');
  const user = await getUserInfo();

  if (!user) {
    return <Empty message={t('messages.auth_required')} />;
  }

  const task = await findAITaskById(id);
  if (!task || task.userId !== user.id) {
    return <Empty message={t('messages.task_not_found')} />;
  }

  const downloads = getTaskDownloadUrls(task);
  if (downloads.length === 0) {
    return <Empty message={t('list.empty_message')} />;
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {t('list.buttons.downloading')}
      <DownloadClient taskId={task.id} downloads={downloads} />
    </div>
  );
}

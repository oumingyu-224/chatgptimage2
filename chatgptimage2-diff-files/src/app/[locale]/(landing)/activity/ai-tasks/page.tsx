import { getTranslations } from 'next-intl/server';

import { AITaskStatus } from '@/extensions/ai';
import { formatAITaskErrorMessage } from '@/shared/lib/ai-task-error';
import {
  getAITaskImageUrls,
  parseAITaskPayload,
} from '@/shared/lib/ai-task-media';
import {
  ActivityTaskImageGallery,
  AudioPlayer,
  Empty,
  PromptEllipsis,
} from '@/shared/blocks/common';
import { TableCard } from '@/shared/blocks/table';
import { AITask, getAITasks, getAITasksCount } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { Button, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

function getTaskImageUrls(item: AITask) {
  return getAITaskImageUrls(item);
}

function parseTaskInfo(taskInfoRaw: string | null) {
  return parseAITaskPayload(taskInfoRaw);
}

function renderTaskResult(item: AITask, t: Awaited<ReturnType<typeof getTranslations>>) {
  const taskInfo = parseTaskInfo(item.taskInfo);
  if (item.status === AITaskStatus.FAILED) {
    return (
      <div className="text-sm text-red-500">
        {formatAITaskErrorMessage({
          input: taskInfo,
          t: (key) => t(`messages.failure_reasons.${key}`),
          keyPrefix: '',
        })}
      </div>
    );
  }

  if (!taskInfo) {
    return '-';
  }

  if (taskInfo.songs && taskInfo.songs.length > 0) {
    const songs: any[] = taskInfo.songs.filter((song: any) => song.audioUrl);
    if (songs.length > 0) {
      return (
        <div className="flex flex-col gap-2">
          {songs.map((song: any) => (
            <AudioPlayer
              key={song.id}
              src={song.audioUrl}
              title={song.title}
              className="w-full max-w-80"
            />
          ))}
        </div>
      );
    }
  }

  const imageUrls = getTaskImageUrls(item);
  if (imageUrls.length > 0) {
    return (
      <ActivityTaskImageGallery
        images={imageUrls.map((imageUrl) => ({ imageUrl }))}
        thumbnailClassName="h-[50px] w-[50px] cursor-zoom-in object-cover"
      />
    );
  }

  return '-';
}

export default async function AiTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number; type?: string }>;
}) {
  const t = await getTranslations('activity.ai-tasks');
  const { page: pageNum, pageSize, type } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const user = await getUserInfo();
  if (!user) {
    return <Empty message={t('messages.auth_required')} />;
  }

  const aiTasks = await getAITasks({
    userId: user.id,
    mediaType: type,
    page,
    limit,
  });

  const total = await getAITasksCount({
    userId: user.id,
    mediaType: type,
  });

  const columns: Table['columns'] = [
    {
      name: 'prompt',
      title: t('fields.prompt'),
      callback: (item: AITask) => (
        <PromptEllipsis
          value={item.prompt}
          enableCopy
          copyLabel={t('list.buttons.copy_prompt')}
          copiedLabel={t('list.messages.prompt_copied')}
        />
      ),
    },
    { name: 'mediaType', title: t('fields.media_type'), type: 'label' },
    { name: 'model', title: t('fields.model'), type: 'label' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'costCredits', title: t('fields.cost_credits'), type: 'label' },
    {
      name: 'result',
      title: t('fields.result'),
      callback: (item: AITask) => renderTaskResult(item, t),
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'action',
      title: t('fields.action'),
      type: 'dropdown',
      callback: (item: AITask) => {
        const items: Button[] = [];
        const downloadUrls = getTaskImageUrls(item);

        if (downloadUrls.length > 0) {
          items.push({
            title: t('list.buttons.download'),
            icon: 'RiDownloadLine',
            downloads: downloadUrls,
            taskId: item.id,
          });
        }

        if (
          item.mediaType === 'image' &&
          (item.status === AITaskStatus.QUEUED ||
            item.status === AITaskStatus.PENDING ||
            item.status === AITaskStatus.PROCESSING)
        ) {
          items.push({
            title: t('list.buttons.refresh'),
            url: `/activity/ai-tasks/${item.id}/refresh`,
            icon: 'RiRefreshLine',
          });
        }

        return items;
      },
    },
  ];

  if (type !== 'image') {
    columns.splice(2, 0, {
      name: 'provider',
      title: t('fields.provider'),
      callback: (item: AITask) => (item.mediaType === 'image' ? '-' : item.provider || '-'),
    });
  }

  const table: Table = {
    title: t('list.title'),
    columns,
    data: aiTasks,
    emptyMessage: t('list.empty_message'),
    pagination: {
      total,
      page,
      limit,
    },
  };

  const tabs: Tab[] = [
    {
      name: 'all',
      title: t('list.tabs.all'),
      url: '/activity/ai-tasks',
      is_active: !type || type === 'all',
    },
    {
      name: 'music',
      title: t('list.tabs.music'),
      url: '/activity/ai-tasks?type=music',
      is_active: type === 'music',
    },
    {
      name: 'image',
      title: t('list.tabs.image'),
      url: '/activity/ai-tasks?type=image',
      is_active: type === 'image',
    },
    {
      name: 'video',
      title: t('list.tabs.video'),
      url: '/activity/ai-tasks?type=video',
      is_active: type === 'video',
    },
    {
      name: 'audio',
      title: t('list.tabs.audio'),
      url: '/activity/ai-tasks?type=audio',
      is_active: type === 'audio',
    },
    {
      name: 'text',
      title: t('list.tabs.text'),
      url: '/activity/ai-tasks?type=text',
      is_active: type === 'text',
    },
  ];

  const refreshParams = new URLSearchParams();
  if (pageNum) {
    refreshParams.set('page', String(pageNum));
  }
  if (pageSize) {
    refreshParams.set('pageSize', String(pageSize));
  }
  if (type) {
    refreshParams.set('type', type);
  }

  const buttons: Button[] = [
    {
      title: t('list.buttons.refresh_page'),
      url: refreshParams.toString()
        ? `/activity/ai-tasks?${refreshParams.toString()}`
        : '/activity/ai-tasks',
      icon: 'RiRefreshLine',
      variant: 'outline',
    },
  ];

  return (
    <div className="space-y-8">
      <TableCard title={t('list.title')} buttons={buttons} tabs={tabs} table={table} />
    </div>
  );
}

import { getTranslations } from 'next-intl/server';

import { AITaskStatus } from '@/extensions/ai';
import { Empty, LazyImage } from '@/shared/blocks/common';
import { TableCard } from '@/shared/blocks/table';
import { getAITasks, getAITasksCount, type AITask } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';
import { type Table } from '@/shared/types/blocks/table';
import { type Button, type Tab } from '@/shared/types/blocks/common';

function parseTaskInfo(taskInfo?: string | null) {
  if (!taskInfo) return null;

  try {
    return JSON.parse(taskInfo);
  } catch {
    return null;
  }
}

function parseTaskOptions(options?: string | null) {
  if (!options) return null;

  try {
    return JSON.parse(options);
  } catch {
    return null;
  }
}

function getInputImageUrl(task: AITask) {
  const options = parseTaskOptions(task.options);

  if (Array.isArray(options?.image_input) && options.image_input.length > 0) {
    return options.image_input[0] || '';
  }

  return '';
}

function getOutputImageUrl(task: AITask) {
  const taskInfo = parseTaskInfo(task.taskInfo);

  if (taskInfo?.images?.length > 0) {
    return taskInfo.images[0]?.imageUrl || '';
  }

  return '';
}

function getStatusLabel(status: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (status === AITaskStatus.SUCCESS) return t('status.completed');
  if (status === AITaskStatus.PROCESSING || status === AITaskStatus.PENDING) {
    return t('status.processing');
  }
  if (status === AITaskStatus.FAILED) return t('status.failed');
  return status;
}

export default async function MyWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number; status?: string }>;
}) {
  const { page: pageNum, pageSize, status } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;
  const taskStatus =
    !status || status === 'all'
      ? undefined
      : status === 'completed'
        ? AITaskStatus.SUCCESS
        : status === 'processing'
          ? AITaskStatus.PROCESSING
          : status === 'failed'
            ? AITaskStatus.FAILED
            : undefined;

  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.my_works');
  const tasks = await getAITasks({
    userId: user.id,
    mediaType: 'image',
    status: taskStatus,
    page,
    limit,
  });
  const total = await getAITasksCount({
    userId: user.id,
    mediaType: 'image',
    status: taskStatus,
  });

  const table: Table = {
    title: t('list.title'),
    columns: [
      {
        title: t('fields.input'),
        callback: (item: AITask) => {
          const inputImage = getInputImageUrl(item);

          if (!inputImage) {
            return <span className="text-slate-400">-</span>;
          }

          return (
            <LazyImage
              src={inputImage}
              alt="Input"
              width={72}
              height={72}
              style={{ width: '72px', height: '72px' }}
              className="overflow-hidden rounded-md object-cover"
            />
          );
        },
      },
      {
        title: t('fields.output'),
        callback: (item: AITask) => {
          const outputImage = getOutputImageUrl(item);

          if (!outputImage) {
            return <span className="text-slate-400">-</span>;
          }

          return (
            <LazyImage
              src={outputImage}
              alt="Output"
              width={72}
              height={72}
              style={{ width: '72px', height: '72px' }}
              className="overflow-hidden rounded-md object-cover"
            />
          );
        },
      },
      {
        name: 'prompt',
        title: t('fields.prompt'),
        type: 'copy',
        className: 'max-w-[360px] truncate',
      },
      {
        name: 'costCredits',
        title: t('fields.credits'),
        callback: (item: AITask) => (
          <div className="text-primary font-medium">{item.costCredits}</div>
        ),
      },
      {
        name: 'status',
        title: t('fields.status'),
        type: 'label',
        metadata: { variant: 'outline' },
        callback: (item: AITask) => getStatusLabel(item.status, t),
      },
      {
        name: 'createdAt',
        title: t('fields.created_at'),
        type: 'time',
      },
      {
        name: 'action',
        title: t('fields.action'),
        type: 'dropdown',
        callback: (item: AITask) => {
          const outputImage = getOutputImageUrl(item);
          const items: Button[] = [];

          if (outputImage) {
            items.push({
              title: t('fields.actions.download'),
              url: `/api/proxy/file?url=${encodeURIComponent(outputImage)}`,
              download: true as any,
              icon: 'Download',
            });
          }

          return items;
        },
      },
    ],
    data: tasks,
    emptyMessage: t('list.empty'),
    pagination: {
      total,
      page,
      limit,
    },
  };

  const tabs: Tab[] = [
    {
      title: t('list.tabs.all'),
      name: 'all',
      url: '/settings/my-works',
      is_active: !status || status === 'all',
    },
    {
      title: t('list.tabs.completed'),
      name: 'completed',
      url: '/settings/my-works?status=completed',
      is_active: status === 'completed',
    },
    {
      title: t('list.tabs.processing'),
      name: 'processing',
      url: '/settings/my-works?status=processing',
      is_active: status === 'processing',
    },
    {
      title: t('list.tabs.failed'),
      name: 'failed',
      url: '/settings/my-works?status=failed',
      is_active: status === 'failed',
    },
  ];

  return (
    <div className="profile-settings-panel space-y-8">
      <TableCard
        title={t('list.title')}
        description={t('list.description')}
        tabs={tabs}
        table={table}
        className="profile-settings-card"
      />
    </div>
  );
}

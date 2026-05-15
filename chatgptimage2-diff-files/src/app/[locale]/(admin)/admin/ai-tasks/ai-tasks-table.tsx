import { getTranslations } from 'next-intl/server';

import { AITaskStatus } from '@/extensions/ai';
import {
  ActivityTaskImageGallery,
  PromptEllipsis,
} from '@/shared/blocks/common';
import { type Table } from '@/shared/types/blocks/table';
import { Filter, Search } from '@/shared/types/blocks/common';
import { getAllConfigs } from '@/shared/models/config';
import { getAITasks, getAITasksCount } from '@/shared/models/ai_task';
import { getAIProviderRows } from '@/shared/services/ai_channels';

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export type AITasksListSearchParams = {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
  keyword?: string;
};

type BuildAITasksTableOptions = {
  t: Translator;
  searchParams: AITasksListSearchParams;
  mediaType?: string;
  fixedStatus?: string;
  hideStatusFilter?: boolean;
};

function formatJsonText(value?: string | null) {
  if (!value) {
    return '';
  }

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

const aiTaskJsonDrawerClassName =
  'data-[vaul-drawer-direction=right]:w-[92vw] data-[vaul-drawer-direction=right]:sm:w-[46vw] data-[vaul-drawer-direction=right]:sm:max-w-3xl';

export async function buildAITasksTable({
  t,
  searchParams,
  mediaType,
  fixedStatus,
  hideStatusFilter,
}: BuildAITasksTableOptions): Promise<{
  table: Table;
  filters: Filter[];
  search: Search;
}> {
  const page = searchParams.page || 1;
  const limit = searchParams.pageSize || 30;
  const statusValue =
    fixedStatus || (searchParams.status && searchParams.status !== 'all'
      ? searchParams.status
      : undefined);
  const typeValue = mediaType || searchParams.type;

  const total = await getAITasksCount({
    mediaType: typeValue,
    status: statusValue,
    keyword: searchParams.keyword,
  });

  const aiTasks = await getAITasks({
    getUser: true,
    page,
    limit,
    mediaType: typeValue,
    status: statusValue,
    keyword: searchParams.keyword,
  });
  const configs = await getAllConfigs();
  const channelById = new Map(
    getAIProviderRows(configs).map((channel) => [channel.id, channel])
  );

  const tableData = aiTasks.map((item) => {
    let options: Record<string, any> = {};
    let taskInfo: Record<string, any> = {};

    try {
      options = item.options ? JSON.parse(item.options) : {};
    } catch {}

    try {
      taskInfo = item.taskInfo ? JSON.parse(item.taskInfo) : {};
    } catch {}

    const providerAttempts = Array.isArray(options?.__providerAttempts)
      ? options.__providerAttempts
      : [];
    const providerChannelId = String(options?.__providerChannelId || '');
    const providerChannel = providerChannelId
      ? channelById.get(providerChannelId)
      : undefined;
    const providerDisplay =
      item.provider === 'custom'
        ? `custom${providerChannel?.name ? `(${providerChannel.name})` : ''}`
        : item.provider;
    const providerAttemptsDetail = providerAttempts.map((attempt: any) => {
      const name = String(attempt?.channelName || attempt?.provider || '');
      const priority =
        attempt?.priority !== undefined && attempt?.priority !== null
          ? `#${attempt.priority}`
          : '';
      const status = String(attempt?.status || '');
      const error = String(attempt?.error || '');
      return [name, priority, status, error].filter(Boolean).join(' | ');
    });
    const generationChainDisplay = formatJsonText(
      JSON.stringify(
        {
          currentChannel: providerChannel?.name || '',
          currentProvider: item.provider || '',
          dispatchCount: options?.__dispatchCount || 0,
          attempts:
            providerAttempts.length > 0
              ? providerAttempts.map((attempt: any, index: number) => ({
                  level: index + 1,
                  channel: attempt?.channelName || '',
                  provider: attempt?.provider || '',
                  model: attempt?.model || '',
                  priority: attempt?.priority,
                  status: attempt?.status || '',
                  error: attempt?.error || '',
                }))
              : [],
        },
        null,
        2
      )
    );
    const failedDetailDisplay =
      item.status === AITaskStatus.FAILED
        ? formatJsonText(
            JSON.stringify(
              {
                reason:
                  taskInfo?.errorMessage ||
                  taskInfo?.message ||
                  options?.__lastDispatchError ||
                  '',
                retryReason:
                  options?.__queueRetryReason || taskInfo?.retryReason || '',
                attempts:
                  providerAttempts.length > 0
                    ? providerAttempts.map((attempt: any, index: number) => ({
                        level: index + 1,
                        channel: attempt?.channelName || '',
                        provider: attempt?.provider || '',
                        model: attempt?.model || '',
                        priority: attempt?.priority,
                        error: attempt?.error || '',
                      }))
                    : [],
              },
              null,
              2
            )
          )
        : '';

    return {
      ...item,
      rowClassName:
        item.status === AITaskStatus.FAILED
          ? 'bg-red-50/70 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-950/35'
          : '',
      providerDisplay,
      promptDisplay: item.prompt || '',
      idDisplay: item.id || '',
      providerTaskIdDisplay: item.taskId || '',
      generationChainDisplay,
      failedDetailDisplay,
      optionsDisplay: formatJsonText(item.options),
      queueDebugDisplay: formatJsonText(
        JSON.stringify(
          {
            activeChannelId: providerChannelId || null,
            activeChannelName: providerChannel?.name || '',
            dispatchCount: options?.__dispatchCount || 0,
            nextDispatchAt: options?.__nextDispatchAt || null,
            retryReason: options?.__queueRetryReason || taskInfo?.retryReason || '',
            lastDispatchError:
              options?.__lastDispatchError || taskInfo?.lastDispatchError || '',
            providerAttempts: providerAttempts.length,
            providerAttemptsDetail,
          },
          null,
          2
        )
      ),
      taskInfoDisplay: formatJsonText(item.taskInfo),
      taskResultDisplay: formatJsonText(item.taskResult),
    };
  });

  const filters: Filter[] = hideStatusFilter
    ? []
    : [
        {
          name: 'status',
          title: t('list.filters.status.title'),
          value: searchParams.status,
          options: [
            { value: 'all', label: t('list.filters.status.options.all') },
            { value: AITaskStatus.QUEUED, label: t('list.filters.status.options.queued') },
            { value: AITaskStatus.PENDING, label: t('list.filters.status.options.pending') },
            {
              value: AITaskStatus.PROCESSING,
              label: t('list.filters.status.options.processing'),
            },
            { value: AITaskStatus.SUCCESS, label: t('list.filters.status.options.success') },
            { value: AITaskStatus.FAILED, label: t('list.filters.status.options.failed') },
            {
              value: AITaskStatus.CANCELED,
              label: t('list.filters.status.options.canceled'),
            },
          ],
        },
      ];

  const search: Search = {
    name: 'keyword',
    title: t('list.search.keyword.title'),
    placeholder: t('list.search.keyword.placeholder'),
    value: searchParams.keyword,
    showButtons: true,
  };

  return {
    filters,
    search,
    table: {
      columns: [
        {
          name: 'idDisplay',
          title: t('fields.task_id'),
          callback: (item) => (
            <PromptEllipsis
              value={item.idDisplay}
              enableCopy
              className="max-w-[220px]"
            />
          ),
        },
        {
          name: 'createdAt',
          title: t('fields.created_at'),
          type: 'time',
        },
        {
          name: 'user',
          title: t('fields.user'),
          type: 'user',
        },
        {
          name: 'status',
          title: t('fields.status'),
          type: 'label',
        },
        { name: 'costCredits', title: t('fields.cost_credits'), type: 'label' },
        { name: 'mediaType', title: t('fields.media_type'), type: 'label' },
        { name: 'scene', title: t('fields.scene'), type: 'label' },
        { name: 'providerDisplay', title: t('fields.provider'), type: 'label' },
        { name: 'model', title: t('fields.model'), type: 'label' },
        {
          name: 'generationChainDisplay',
          title: t('fields.generation_chain'),
          type: 'json_preview',
          metadata: { drawerClassName: aiTaskJsonDrawerClassName },
          className: 'max-w-[260px]',
        },
        {
          name: 'failedDetailDisplay',
          title: t('fields.failed_detail'),
          type: 'json_preview',
          metadata: { drawerClassName: aiTaskJsonDrawerClassName },
          className: 'max-w-[260px]',
        },
        {
          name: 'promptDisplay',
          title: t('fields.prompt'),
          callback: (item) => (
            <PromptEllipsis
              value={item.promptDisplay}
              enableCopy
              className="max-w-[280px]"
            />
          ),
        },
        {
          name: 'queueDebugDisplay',
          title: t('fields.queue_debug'),
          callback: (item) => (
            <PromptEllipsis
              value={item.queueDebugDisplay}
              enableCopy
              className="max-w-[240px]"
            />
          ),
        },
        {
          name: 'optionsDisplay',
          title: t('fields.options'),
          callback: (item) => (
            <PromptEllipsis
              value={item.optionsDisplay}
              enableCopy
              className="max-w-[240px]"
            />
          ),
        },
        {
          name: 'providerTaskIdDisplay',
          title: t('fields.provider_task_id'),
          callback: (item) => (
            <PromptEllipsis
              value={item.providerTaskIdDisplay}
              enableCopy
              className="max-w-[220px]"
            />
          ),
        },
        {
          name: 'taskInfoDisplay',
          title: t('fields.task_info'),
          callback: (item) => (
            <PromptEllipsis
              value={item.taskInfoDisplay}
              enableCopy
              className="max-w-[240px]"
            />
          ),
        },
        {
          name: 'taskResultDisplay',
          title: t('fields.result'),
          callback: (item) => {
            if (item.mediaType === 'image' && item.taskInfo) {
              try {
                const taskInfo = JSON.parse(item.taskInfo);
                if (Array.isArray(taskInfo?.images) && taskInfo.images.length > 0) {
                  return <ActivityTaskImageGallery images={taskInfo.images} />;
                }
              } catch {}
            }

            return (
              <PromptEllipsis
                value={item.taskResultDisplay}
                enableCopy
                className="max-w-[240px]"
              />
            );
          },
        },
      ],
      data: tableData,
      emptyMessage: t('list.empty_message'),
      pagination: {
        total,
        page,
        limit,
      },
    },
  };
}

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AITaskStatus } from '@/extensions/ai';
import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { Crumb } from '@/shared/types/blocks/common';

import { buildAITasksTable } from '../../ai-tasks/ai-tasks-table';

export default async function AIImageFailedTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    keyword?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.AITASKS_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.ai-tasks');
  const resolvedSearchParams = await searchParams;
  const { table, search } = await buildAITasksTable({
    t,
    searchParams: resolvedSearchParams,
    mediaType: 'image',
    fixedStatus: AITaskStatus.FAILED,
    hideStatusFilter: true,
  });

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('board.crumbs.ai-image-dashboard'), url: '/admin/ai-image-dashboard' },
    { title: t('board.crumbs.ai-image-failed-tasks'), is_active: true },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title={t('board.failed_tasks.title')}
          description={t('board.failed_tasks.description')}
          search={search}
        />
        <TableCard table={table} />
      </Main>
    </>
  );
}

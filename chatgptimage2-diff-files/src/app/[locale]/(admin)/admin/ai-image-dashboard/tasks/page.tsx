import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { Crumb } from '@/shared/types/blocks/common';

import { buildAITasksTable } from '../../ai-tasks/ai-tasks-table';

export default async function AIImageTasksPage({
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
    hideStatusFilter: true,
  });

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('board.crumbs.ai-image-dashboard'), url: '/admin/ai-image-dashboard' },
    { title: t('board.crumbs.ai-image-tasks'), is_active: true },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title={t('board.image_tasks.title')}
          description={t('board.image_tasks.description')}
          search={search}
        />
        <TableCard table={table} />
      </Main>
    </>
  );
}

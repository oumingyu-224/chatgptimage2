import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { Button, Crumb, Filter, Search, Tab } from '@/shared/types/blocks/common';
import { Table } from '@/shared/types/blocks/table';

import { buildAITasksTable } from './ai-tasks-table';

export default async function AiTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    type?: string;
    status?: string;
    keyword?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Check if user has permission to read api keys
  await requirePermission({
    code: PERMISSIONS.AITASKS_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.ai-tasks');

  const { page: pageNum, pageSize, type, status, keyword } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 30;

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.ai-tasks'), is_active: true },
  ];

  const {
    table,
    filters,
    search,
  }: { table: Table; filters: Filter[]; search: Search } = await buildAITasksTable({
    t,
    searchParams: { page, pageSize: limit, type, status, keyword },
  });

  const actions: Button[] = [];

  const tabs: Tab[] = [
    {
      title: t('list.tabs.all'),
      name: 'all',
      url: '/admin/ai-tasks',
      is_active: !type || type === 'all',
    },
    {
      title: t('list.tabs.music'),
      name: 'music',
      url: '/admin/ai-tasks?type=music',
      is_active: type === 'music',
    },
    {
      title: t('list.tabs.image'),
      name: 'image',
      url: '/admin/ai-tasks?type=image',
      is_active: type === 'image',
    },
    {
      title: t('list.tabs.video'),
      name: 'video',
      url: '/admin/ai-tasks?type=video',
      is_active: type === 'video',
    },
    {
      title: t('list.tabs.audio'),
      name: 'audio',
      url: '/admin/ai-tasks?type=audio',
      is_active: type === 'audio',
    },
    {
      title: t('list.tabs.text'),
      name: 'text',
      url: '/admin/ai-tasks?type=text',
      is_active: type === 'text',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title={t('list.title')}
          tabs={tabs}
          actions={actions}
          filters={filters}
          search={search}
        />
        <TableCard table={table} />
      </Main>
    </>
  );
}

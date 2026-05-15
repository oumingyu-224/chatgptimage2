import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAnyPermission } from '@/core/rbac';
import { ActivityTaskImageGallery, PromptEllipsis } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { SHOWCASE_READ_PERMISSION_CODES } from '@/shared/lib/admin-content';
import {
  getShowcases,
  getShowcasesCount,
  isShowcasePublicValue,
  type Showcase,
} from '@/shared/models/showcase';
import { Badge } from '@/shared/components/ui/badge';
import { Button, Crumb, Search } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function ShowcasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: number; pageSize?: number; keyword?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAnyPermission({
    codes: SHOWCASE_READ_PERMISSION_CODES,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.showcases');

  const { page: pageNum, pageSize, keyword } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 15;
  const listParams = new URLSearchParams();
  listParams.set('page', String(page));
  if (pageSize) {
    listParams.set('pageSize', String(pageSize));
  }
  if (keyword) {
    listParams.set('keyword', keyword);
  }
  const returnTo = `/admin/showcases?${listParams.toString()}`;

  const crumbs: Crumb[] = [
    { title: 'Admin', url: '/admin' },
    { title: 'Showcases', is_active: true },
  ];

  const total = await getShowcasesCount({ keyword });
  const data = await getShowcases({ page, limit, keyword });

  const search: Search = {
    name: 'keyword',
    title: t('search.keyword.title'),
    placeholder: t('search.keyword.placeholder'),
    value: keyword,
    showButtons: true,
  };

  const table: Table = {
    columns: [
      {
        name: 'image',
        title: t('form.image'),
        callback: (item: Showcase) =>
          item.image ? (
            <ActivityTaskImageGallery images={[{ imageUrl: item.image }]} />
          ) : (
            '-'
          ),
      },
      {
        name: 'title',
        title: t('form.title'),
        type: 'copy',
        callback: (item: Showcase) => <PromptEllipsis value={item.title} />,
      },
      {
        name: 'prompt',
        title: t('form.prompt'),
        type: 'copy',
        callback: (item: Showcase) => <PromptEllipsis value={item.prompt} />,
      },
      {
        name: 'tags',
        title: t('form.tags'),
        type: 'copy',
        callback: (item: Showcase) => <PromptEllipsis value={item.tags} />,
      },
      {
        name: 'isPublic',
        title: t('form.visibility'),
        callback: (item: Showcase) => (
          <Badge variant="outline">
            {isShowcasePublicValue(item.isPublic)
              ? t('form.public')
              : t('form.private')}
          </Badge>
        ),
      },
      { name: 'createdAt', title: t('form.createdAt'), type: 'time' },
      {
        name: 'action',
        title: '',
        type: 'dropdown',
        callback: (item: Showcase) => {
          return [
            {
              id: 'edit',
              title: t('edit'),
              icon: 'RiEditLine',
              url: `/admin/showcases/${item.id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
            },
            {
              id: 'delete',
              title: t('delete'),
              icon: 'RiDeleteBinLine',
              url: `/admin/showcases/${item.id}/delete`,
            },
          ];
        },
      },
    ],
    actions: [
      {
        id: 'edit',
        title: t('edit'),
        icon: 'RiEditLine',
        url: '/admin/showcases/[id]/edit',
      },
    ],
    data,
    pagination: {
      total,
      page,
      limit,
    },
  };

  const actions: Button[] = [
    {
      id: 'add',
      title: t('add'),
      icon: 'RiAddLine',
      url: '/admin/showcases/add',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('title')} actions={actions} search={search} />
        <TableCard table={table} />
      </Main>
    </>
  );
}

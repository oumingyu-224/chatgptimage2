import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAnyPermission } from '@/core/rbac';
import { ActivityTaskImageGallery, PromptEllipsis } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { TableCard } from '@/shared/blocks/table';
import { PROMPT_READ_PERMISSION_CODES } from '@/shared/lib/admin-content';
import { getPrompts, getPromptsCount, type Prompt } from '@/shared/models/prompt';
import { Button, Crumb, Search } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function PromptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: number; pageSize?: number; keyword?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAnyPermission({
    codes: PROMPT_READ_PERMISSION_CODES,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.prompts');

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
  const returnTo = `/admin/prompts?${listParams.toString()}`;

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.prompts'), is_active: true },
  ];

  const total = await getPromptsCount({ keyword });
  const data = await getPrompts({ page, limit, keyword });

  const search: Search = {
    name: 'keyword',
    title: t('list.search.keyword.title'),
    placeholder: t('list.search.keyword.placeholder'),
    value: keyword,
    showButtons: true,
  };

  const table: Table = {
    columns: [
      {
        name: 'image',
        title: t('fields.image'),
        callback: (item: Prompt) =>
          item.image ? (
            <ActivityTaskImageGallery images={[{ imageUrl: item.image }]} />
          ) : (
            '-'
          ),
      },
      {
        name: 'promptTitle',
        title: t('fields.prompt_title'),
        type: 'copy',
        callback: (item: Prompt) => <PromptEllipsis value={item.promptTitle} />,
      },
      {
        name: 'promptDescription',
        title: t('fields.prompt_description'),
        type: 'copy',
        callback: (item: Prompt) => (
          <PromptEllipsis value={item.promptDescription} />
        ),
      },
      {
        name: 'status',
        title: t('fields.status'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
      { name: 'updatedAt', title: t('fields.updated_at'), type: 'time' },
      {
        name: 'action',
        title: '',
        type: 'dropdown',
        callback: (item: Prompt) => {
          return [
            {
              id: 'edit',
              title: t('list.buttons.edit'),
              icon: 'RiEditLine',
              url: `/admin/prompts/${item.id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
            },
            {
              id: 'delete',
              title: t('list.buttons.delete'),
              icon: 'RiDeleteBinLine',
              url: `/admin/prompts/${item.id}/delete`,
            },
          ];
        },
      },
    ],
    actions: [
      {
        id: 'edit',
        title: t('list.buttons.edit'),
        icon: 'RiEditLine',
        url: '/admin/prompts/[id]/edit',
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
      title: t('list.buttons.add'),
      icon: 'RiAddLine',
      url: '/admin/prompts/add',
    },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('list.title')} actions={actions} search={search} />
        <TableCard table={table} />
      </Main>
    </>
  );
}

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAnyPermission } from '@/core/rbac';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PROMPT_WRITE_PERMISSION_CODES } from '@/shared/lib/admin-content';
import { findPrompt, updatePrompt, UpdatePrompt, PromptStatus } from '@/shared/models/prompt';
import { getUserInfo } from '@/shared/models/user';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function PromptEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { locale, id } = await params;
  const { returnTo } = await searchParams;
  setRequestLocale(locale);

  await requireAnyPermission({
    codes: PROMPT_WRITE_PERMISSION_CODES,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.prompts');

  const promptData = await findPrompt({ id });
  if (!promptData) {
    return <Empty message={t('empty.not_found')} />;
  }

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.prompts'), url: '/admin/prompts' },
    { title: t('edit.crumbs.edit'), is_active: true },
  ];

  const form: Form = {
    fields: [
      {
        name: 'image',
        type: 'upload_image',
        title: t('fields.image'),
        tip: t('tips.image'),
      },
      {
        name: 'promptTitle',
        type: 'text',
        title: t('fields.prompt_title'),
        validation: { required: true },
      },
      {
        name: 'promptDescription',
        type: 'textarea',
        title: t('fields.prompt_description'),
      },
    ],
    passby: {
      prompt: promptData,
    },
    data: promptData,
    submit: {
      button: {
        title: 'Update',
      },
      handler: async (data, passby) => {
        'use server';

        const user = await getUserInfo();
        if (!user) {
          throw new Error('no auth');
        }

        const { prompt } = passby;
        if (!user || !prompt) {
          throw new Error('access denied');
        }

        const image = data.get('image') as string;
        const promptTitle = data.get('promptTitle') as string;
        const promptDescription = data.get('promptDescription') as string;

        if (!promptTitle?.trim()) {
          throw new Error('prompt title is required');
        }

        const normalizedPromptTitle = promptTitle.trim();
        const normalizedPromptDescription = promptDescription?.trim() || '';

        const updateData: UpdatePrompt = {
          title: normalizedPromptTitle,
          description: normalizedPromptDescription,
          image: image?.trim() || '',
          promptTitle: normalizedPromptTitle,
          promptDescription: normalizedPromptDescription,
          status: PromptStatus.PUBLISHED,
        };

        const result = await updatePrompt(prompt.id, updateData);

        if (!result) {
          throw new Error('update prompt failed');
        }

        return {
          status: 'success',
          message: t('feedback.updated'),
          redirect_url: returnTo || '/admin/prompts',
        };
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}

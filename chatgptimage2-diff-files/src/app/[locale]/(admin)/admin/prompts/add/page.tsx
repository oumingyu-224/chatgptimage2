import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAnyPermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PROMPT_WRITE_PERMISSION_CODES } from '@/shared/lib/admin-content';
import { getUuid } from '@/shared/lib/hash';
import { addPrompt, NewPrompt, PromptStatus } from '@/shared/models/prompt';
import { getUserInfo } from '@/shared/models/user';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function PromptAddPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { locale } = await params;
  const { returnTo } = await searchParams;
  setRequestLocale(locale);

  await requireAnyPermission({
    codes: PROMPT_WRITE_PERMISSION_CODES,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.prompts');

  const crumbs: Crumb[] = [
    { title: t('add.crumbs.admin'), url: '/admin' },
    { title: t('add.crumbs.prompts'), url: '/admin/prompts' },
    { title: t('add.crumbs.add'), is_active: true },
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
    passby: {},
    data: {},
    submit: {
      button: {
        title: 'Submit',
      },
      handler: async (data, passby) => {
        'use server';

        const user = await getUserInfo();
        if (!user) {
          throw new Error('no auth');
        }

        const image = data.get('image') as string;
        const promptTitle = data.get('promptTitle') as string;
        const promptDescription = data.get('promptDescription') as string;

        if (!promptTitle?.trim()) {
          throw new Error('prompt title is required');
        }

        const normalizedPromptTitle = promptTitle.trim();
        const normalizedPromptDescription = promptDescription?.trim() || '';

        const newPrompt: NewPrompt = {
          id: getUuid(),
          userId: user.id,
          title: normalizedPromptTitle,
          description: normalizedPromptDescription,
          image: image?.trim() || '',
          promptTitle: normalizedPromptTitle,
          promptDescription: normalizedPromptDescription,
          status: PromptStatus.PUBLISHED,
        };

        const result = await addPrompt(newPrompt);

        if (!result) {
          throw new Error('add prompt failed');
        }

        return {
          status: 'success',
          message: t('feedback.added'),
          redirect_url: returnTo || '/admin/prompts',
        };
      },
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('add.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}

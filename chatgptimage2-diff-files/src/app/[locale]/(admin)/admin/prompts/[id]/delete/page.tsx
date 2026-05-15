import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAnyPermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Button } from '@/shared/components/ui/button';
import { Link } from '@/core/i18n/navigation';
import { PROMPT_DELETE_PERMISSION_CODES, createPromptDeleteAction } from '@/shared/lib/admin-content';
import { deletePrompt, findPrompt } from '@/shared/models/prompt';
import { getUserInfo } from '@/shared/models/user';
import { Crumb } from '@/shared/types/blocks/common';

export default async function PromptDeletePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.prompts');

  await requireAnyPermission({
    codes: PROMPT_DELETE_PERMISSION_CODES,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const user = await getUserInfo();
  if (!user) {
    redirect('/sign-in');
  }

  const promptData = await findPrompt({ id });
  if (!promptData) {
    redirect('/admin/prompts');
  }

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.prompts'), url: '/admin/prompts' },
    { title: t('confirm_delete.crumbs.delete'), is_active: true },
  ];

  const confirmDelete = async () => {
    'use server';

    const authUser = await getUserInfo();
    if (!authUser) {
      redirect('/sign-in');
    }

    const removePrompt = createPromptDeleteAction({
      findPrompt,
      deletePrompt,
    });

    await removePrompt(id);
    redirect('/admin/prompts');
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('confirm_delete.title')} />
        <div className="md:max-w-xl space-y-4 rounded-lg border p-6">
          <p>{t('confirm_delete.description', { title: promptData.promptTitle })}</p>
          <form action={confirmDelete} className="flex items-center gap-3">
            <Button type="submit" variant="destructive">
              {t('confirm_delete.confirm')}
            </Button>
            <Button asChild variant="outline" type="button">
              <Link href="/admin/prompts">{t('confirm_delete.cancel')}</Link>
            </Button>
          </form>
        </div>
      </Main>
    </>
  );
}

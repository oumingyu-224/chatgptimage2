import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireAnyPermission } from '@/core/rbac';
import { Link } from '@/core/i18n/navigation';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { Button } from '@/shared/components/ui/button';
import { SHOWCASE_DELETE_PERMISSION_CODES, createShowcaseDeleteAction } from '@/shared/lib/admin-content';
import { deleteShowcase, getShowcase } from '@/shared/models/showcase';
import { getUserInfo } from '@/shared/models/user';
import { Crumb } from '@/shared/types/blocks/common';

export default async function ShowcaseDeletePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.showcases');

  await requireAnyPermission({
    codes: SHOWCASE_DELETE_PERMISSION_CODES,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const user = await getUserInfo();
  if (!user) {
    redirect('/sign-in');
  }

  const showcase = await getShowcase(id);
  if (!showcase) {
    redirect('/admin/showcases');
  }

  const crumbs: Crumb[] = [
    { title: 'Admin', url: '/admin' },
    { title: 'Showcases', url: '/admin/showcases' },
    { title: t('confirm_delete.crumbs.delete'), is_active: true },
  ];

  const confirmDelete = async () => {
    'use server';

    const authUser = await getUserInfo();
    if (!authUser) {
      redirect('/sign-in');
    }

    const removeShowcase = createShowcaseDeleteAction({
      getShowcase,
      deleteShowcase,
    });

    await removeShowcase(id);
    redirect('/admin/showcases');
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('confirm_delete.title')} />
        <div className="md:max-w-xl space-y-4 rounded-lg border p-6">
          <p>{t('confirm_delete.description', { title: showcase.title })}</p>
          <form action={confirmDelete} className="flex items-center gap-3">
            <Button type="submit" variant="destructive">
              {t('confirm_delete.confirm')}
            </Button>
            <Button asChild variant="outline" type="button">
              <Link href="/admin/showcases">{t('confirm_delete.cancel')}</Link>
            </Button>
          </form>
        </div>
      </Main>
    </>
  );
}

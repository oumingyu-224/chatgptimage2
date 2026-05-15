import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requirePermission } from '@/core/rbac';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { getAdminAIImageDashboardData } from '@/shared/services/admin-ai-image-dashboard';
import { getAdminDashboardData } from '@/shared/services/admin-dashboard';
import { Crumb } from '@/shared/types/blocks/common';

import { AIImageDashboardClient } from './ai-image-dashboard-client';

export default async function AIImageDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requirePermission({
    code: PERMISSIONS.AITASKS_READ,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.ai-tasks');
  const [data, trends] = await Promise.all([
    getAdminAIImageDashboardData(),
    getAdminDashboardData(),
  ]);

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('board.crumbs.ai-image-dashboard'), is_active: true },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('board.title')} description={t('board.description')} />
        <AIImageDashboardClient data={data} trends={trends} />
      </Main>
    </>
  );
}

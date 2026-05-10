import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { ConsoleLayout } from '@/shared/blocks/console/layout';

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations('settings.sidebar');

  // settings title
  const title = t('title');

  // settings nav
  const nav = t.raw('nav');

  return (
    <ConsoleLayout
      nav={nav}
      // topNav={topNav}
      className="py-8 md:py-10"
    >
      {children}
    </ConsoleLayout>
  );
}

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
  const filteredNav = {
    ...nav,
    items: nav.items.filter((item: { url?: string }) => item.url !== '/settings/apikeys'),
  };

  const topNav = t.raw('top_nav');

  return (
    <ConsoleLayout
      title={title}
      nav={filteredNav}
      topNav={topNav}
      className="py-16 md:py-20"
    >
      {children}
    </ConsoleLayout>
  );
}

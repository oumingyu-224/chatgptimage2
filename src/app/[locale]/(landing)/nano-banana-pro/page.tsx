import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { ImageGenerator } from '@/shared/blocks/generator';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const generateMetadata = getMetadata({
  metadataKey: 'pages.nanobananapro.metadata',
  canonicalUrl: '/nano-banana-pro',
});

export default async function NanoBananaProPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { locale } = await params;
  const { prompt: promptKey } = await searchParams;
  setRequestLocale(locale);

  // get translations
  const t = await getTranslations('pages.nanobananapro');

  // build page sections
  const page: DynamicPage = {
    sections: {
      features: {
        block: 'custom-features',
        title: t.raw('page.title'),
        description: t.raw('page.description'),
      },
      generator: {
        component: <ImageGenerator srOnlyTitle={t.raw('generator.title')} promptKey={promptKey} />,
      },
      faq: {
        block: 'faq',
        title: t.raw('faq.title'),
        items: t.raw('faq.items'),
      },
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
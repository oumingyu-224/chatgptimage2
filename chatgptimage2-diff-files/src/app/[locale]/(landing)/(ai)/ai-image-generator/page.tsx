import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { defaultLocale } from '@/config/locale';
import { ImageGenerator } from '@/shared/blocks/generator';
import { StructuredData } from '@/shared/components/seo/structured-data';
import { getAppBranding } from '@/shared/lib/branding';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const generateMetadata = getMetadata({
  metadataKey: 'ai.image.metadata',
  canonicalUrl: '/ai-image-generator',
});

export default async function AiImageGeneratorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // get ai image data
  const t = await getTranslations('ai.image');
  const branding = await getAppBranding();

  // get landing page data
  const tl = await getTranslations('landing');
  const heroBackgroundAlt = t.raw('page.hero_background_alt') as string;
  const featureList = t.raw('page.feature_list') as string[];

  // build page sections
  const page: DynamicPage = {
    sections: {
      hero: {
        title: t.raw('page.title'),
        description: t.raw('page.description'),
        background_image: {
          src: '/imgs/bg/tree.jpg',
          alt: heroBackgroundAlt,
        },
      },
      generator: {
        component: <ImageGenerator srOnlyTitle={t.raw('generator.title')} />,
      },
      faq: tl.raw('faq'),
      cta: tl.raw('cta'),
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');
  const pageUrl = `${envConfigs.app_url}${
    locale === defaultLocale ? '' : `/${locale}`
  }/ai-image-generator`;
  const pageTitle = t.raw('page.title') as string;
  const pageDescription = t.raw('page.description') as string;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: pageTitle,
      url: pageUrl,
      description: pageDescription,
      inLanguage: locale,
      isPartOf: {
        '@type': 'WebSite',
        name: branding.appName,
        url: envConfigs.app_url,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: pageTitle,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description: pageDescription,
      inLanguage: locale,
      featureList,
    },
  ];

  return (
    <>
      <StructuredData data={jsonLd} />
      <Page locale={locale} page={page} />
    </>
  );
}

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { ImageGenerator } from '@/shared/blocks/generator';
import { findPublishedPromptByPromptTitle } from '@/shared/models/prompt';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const generateMetadata = getMetadata({
  metadataKey: 'pages.create.metadata',
  canonicalUrl: '/create',
});

export default async function CreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ prompt?: string; mock?: string }>;
}) {
  const { locale } = await params;
  const { prompt: promptKey, mock } = await searchParams;
  setRequestLocale(locale);
  const isMockMode = mock === '1';
  const promptData = promptKey
    ? await findPublishedPromptByPromptTitle(promptKey)
    : null;
  const effectivePromptKey = promptData ? promptKey : undefined;

  // get ai image data
  const t = await getTranslations('pages.create');

  // get landing page data
  const tl = await getTranslations('landing');

  // build page sections
  const page: DynamicPage = {
    sections: {
      "features": {
        "block": "custom-features",
        title: t.raw('page.title'),
        description: t.raw('page.description'),
      },
      generator: {
        component: <ImageGenerator srOnlyTitle={t.raw('generator.title')} promptKey={effectivePromptKey} initialPromptValue={promptData?.promptDescription || ''} initialPreviewImage={promptData?.image || ''} showProviderModelSelector={false} preferResolutionCapableModel={true} simpleResolutionHint={true} mockGenerate={isMockMode} />,
      },
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}

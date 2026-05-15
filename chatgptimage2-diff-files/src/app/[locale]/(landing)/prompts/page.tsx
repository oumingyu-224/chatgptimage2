import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage, Section } from '@/shared/types/blocks/landing';
import { PromptsContent } from './prompts-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.prompts.metadata',
  canonicalUrl: '/prompts',
});

export default async function PromptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.prompts');
  const promptsData = t.raw('showcases-flow') as Section;
  const page: DynamicPage = {
    sections: {
      'prompts-content': {
        component: <PromptsContent sectionData={promptsData} />,
      },
    },
  };
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}

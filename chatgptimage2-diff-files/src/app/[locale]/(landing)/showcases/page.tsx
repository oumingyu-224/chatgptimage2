import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { getLatestShowcases } from '@/shared/models/showcase';
import { ShowcasesFlowDynamic } from '@/themes/default/blocks/showcases-flow-dynamic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.showcases.metadata',
  canonicalUrl: '/showcases',
});

export default async function ShowcasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.showcases');
  const showcasesData = t.raw('showcases-flow');
  const rawShowcases = await getLatestShowcases({
    excludeTags: 'hairstyles',
    sortOrder: 'desc',
    limit: 20,
    publicOnly: true,
  });
  const initialShowcases = rawShowcases.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <ShowcasesFlowDynamic
      title={showcasesData.title}
      description={showcasesData.description}
      containerClassName="py-14"
      initialItems={initialShowcases}
      excludeTags="hairstyles"
      sortOrder="desc"
      hideCreateButton={true}
    />
  );
}

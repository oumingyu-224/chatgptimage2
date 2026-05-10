import showcasesImport from '../../../showcases-import.json';

type ShowcaseImportItem = {
  title: string;
  description?: string;
  prompt?: string;
  image: string;
  tags?: string;
};

export type GeneratorFeaturedShowcase = {
  id: string;
  title: string;
  description?: string;
  prompt?: string;
  image: string;
  tags?: string;
};

export const GENERATOR_FEATURED_SHOWCASES: GeneratorFeaturedShowcase[] = (
  showcasesImport as ShowcaseImportItem[]
)
  .slice(0, 10)
  .map((item, index) => ({
    id: `generator-featured-showcase-${index + 1}`,
    title: item.title,
    description: item.description,
    prompt: item.prompt,
    image: item.image,
    tags: item.tags,
  }));

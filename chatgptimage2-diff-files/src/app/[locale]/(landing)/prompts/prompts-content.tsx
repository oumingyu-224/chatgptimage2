'use client';

import { motion } from 'framer-motion';

import { Section } from '@/shared/types/blocks/landing';
import { ShowcasesFlowDynamic } from '@/themes/default/blocks/showcases-flow-dynamic';

export function PromptsContent({
  sectionData,
}: {
  sectionData: Section;
}) {
  return (
    <section className="py-24 md:py-36">
      <motion.div
        className="container mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1] as const,
        }}
      >
        {sectionData.sr_only_title && (
          <h1 className="sr-only">{sectionData.sr_only_title}</h1>
        )}
        <h2 className="mx-auto mb-6 max-w-full text-3xl font-bold text-pretty md:max-w-5xl lg:text-4xl">
          {sectionData.title}
        </h2>
        <p className="text-muted-foreground text-md mx-auto mb-4 line-clamp-3 max-w-full md:max-w-5xl">
          {sectionData.description}
        </p>
      </motion.div>

      <ShowcasesFlowDynamic
        containerClassName="py-8"
        usePrompts={true}
        i18nNamespace="pages.prompts.ui"
      />
    </section>
  );
}

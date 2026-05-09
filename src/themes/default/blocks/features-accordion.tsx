'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { LazyImage, SmartIcon } from '@/shared/blocks/common';
import { BorderBeam } from '@/shared/components/magicui/border-beam';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function FeaturesAccordion({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const [activeItem, setActiveItem] = useState<string>('item-1');

  const images: any = {};
  section.items?.forEach((item, idx) => {
    images[`item-${idx + 1}`] = {
      image: item.image?.src ?? '',
      alt: item.image?.alt || item.title || '',
    };
  });

  return (
    <section
      className={cn(
        'overflow-x-hidden py-20 md:py-28',
        section.className,
        className
      )}
    >
      <div className="container overflow-x-hidden px-3 sm:px-6 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <ScrollAnimation>
          <div className="mx-auto max-w-3xl text-center text-balance">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-500 dark:text-sky-400">
              {section.id}
            </p>
            <h2 className="text-foreground mb-4 text-[28px] leading-[1.05] font-semibold tracking-[-0.04em] md:text-[44px]">
              {section.title}
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-sm leading-6 md:text-[15px] md:leading-7">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <div className="mt-10 grid min-w-0 gap-10 md:mt-14 md:grid-cols-[1fr_1.05fr] md:gap-8 lg:gap-10">
          <ScrollAnimation delay={0.08} direction="left">
            <Accordion
              type="single"
              value={activeItem}
              onValueChange={(value) => setActiveItem(value as string)}
              className="w-full space-y-3"
            >
              {section.items?.map((item, idx) => (
                <AccordionItem
                  value={`item-${idx + 1}`}
                  key={idx}
                  className={cn(
                    'group overflow-hidden rounded-3xl border bg-white/80 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:bg-white/[0.03] dark:shadow-none dark:hover:border-white/15 dark:hover:bg-white/[0.05]',
                    activeItem === `item-${idx + 1}` &&
                      'border-sky-200/80 bg-sky-50/70 shadow-[0_18px_40px_rgba(56,189,248,0.12)] dark:border-sky-400/30 dark:bg-sky-400/[0.06]'
                  )}
                >
                  <AccordionTrigger className="py-0 hover:no-underline [&[data-state=open]>svg]:text-sky-500 dark:[&[data-state=open]>svg]:text-sky-400">
                    <div className="flex items-center gap-3 text-left">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 dark:bg-sky-400/10 dark:text-sky-400">
                        {item.icon && (
                          <SmartIcon name={item.icon as string} size={18} />
                        )}
                      </span>
                      <span className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground md:text-base">
                        {item.title}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0 pt-3 text-sm leading-6 text-muted-foreground md:text-[14px]">
                    {item.description}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollAnimation>

          <ScrollAnimation delay={0.16} direction="right">
            <div className="bg-background relative min-w-0 overflow-hidden rounded-[28px] border p-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_80px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.08),transparent_24%)]" />
              <div className="relative aspect-[1.17/1] min-w-0 overflow-hidden rounded-[22px] border border-black/5 bg-[#f8fafc] dark:border-white/5 dark:bg-[#0b0b0f]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeItem}-id`}
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.985 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="size-full overflow-hidden"
                  >
                    <LazyImage
                      src={images[activeItem].image}
                      className="size-full object-cover object-center dark:mix-blend-lighten"
                      alt={images[activeItem].alt}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              <BorderBeam
                duration={6}
                size={200}
                className="from-transparent via-sky-400/70 to-transparent dark:via-white/40"
              />
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

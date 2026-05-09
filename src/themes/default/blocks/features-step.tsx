'use client';

import { Download, ImagePlus, Sparkles, SquarePen } from 'lucide-react';

import { SmartIcon } from '@/shared/blocks/common';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function FeaturesStep({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const stepIcons = [SquarePen, ImagePlus, Sparkles, Download];

  return (
    <section
      id={section.id}
      className={cn('py-20 md:py-28', section.className, className)}
    >
      <div className="container px-3 sm:px-6">
        <div className="@container relative">
          <ScrollAnimation>
            <div className="mx-auto max-w-3xl text-center text-balance">
              {section.label && (
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-500 dark:text-sky-400">
                  {section.label}
                </p>
              )}
              <h2 className="text-foreground text-[28px] leading-[1.06] font-semibold tracking-[-0.04em] md:text-[42px]">
                {section.title}
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-sm leading-6 md:text-[15px] md:leading-7">
                {section.description}
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={0.2}>
            <div className="mt-12 grid gap-4 @3xl:grid-cols-4 md:mt-16 md:gap-5">
              {section.items?.map((item, idx) => (
                (() => {
                  const StepIcon = stepIcons[idx] || Sparkles;
                  return (
                <div
                  className="rounded-[24px] border border-slate-200/80 bg-white/72 px-5 py-7 text-center shadow-[0_10px_30px_rgba(15,23,42,0.03)] backdrop-blur-sm dark:border-white/6 dark:bg-white/[0.02] dark:shadow-none"
                  key={idx}
                >
                  <div className="mx-auto flex min-h-[162px] max-w-[210px] flex-col items-center justify-start">
                    <span className="inline-flex items-center justify-center rounded-full bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-500 dark:bg-sky-400/10 dark:text-sky-400">
                      Step {idx + 1}
                    </span>
                    <div className="mt-5 flex size-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-sky-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-white/8 dark:bg-white/[0.03] dark:text-sky-400 dark:shadow-none">
                      {item.icon ? (
                        <SmartIcon name={item.icon as string} size={18} />
                      ) : (
                        <StepIcon size={18} strokeWidth={2} />
                      )}
                    </div>
                    <h3 className="text-foreground mt-5 text-[15px] font-semibold md:text-base">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground mt-3 text-[13px] leading-6 text-balance md:text-sm">
                      {item.description}
                    </p>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

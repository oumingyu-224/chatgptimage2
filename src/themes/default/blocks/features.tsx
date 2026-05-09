'use client';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Features({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="container px-3 sm:px-6">
        <ScrollAnimation>
          <div className="mx-auto max-w-3xl text-center text-balance">
            {section.label && (
              <p className="mb-3 text-[11px] font-semibold tracking-[0.3em] text-sky-500 uppercase dark:text-sky-400">
                {section.label}
              </p>
            )}
            <h2 className="text-foreground mb-4 text-[28px] leading-[1.08] font-semibold tracking-[-0.04em] md:text-[42px]">
              {section.title}
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-sm leading-6 md:text-[15px] md:leading-7">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:mt-14 md:grid-cols-2">
            {section.items?.map((item, idx) => (
              <div
                className="rounded-[24px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-white/6 dark:bg-white/[0.025] dark:shadow-none"
                key={idx}
              >
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500 dark:bg-sky-400/10 dark:text-sky-400">
                    <SmartIcon name={item.icon as string} size={18} />
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-foreground text-[15px] font-semibold leading-6 md:text-base">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-[13px] leading-6 md:text-sm">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

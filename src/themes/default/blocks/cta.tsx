'use client';

import type { MouseEvent } from 'react';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function CTA({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const focusPromptInput = () => {
    const promptInput = document.getElementById('image-prompt');
    promptInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => promptInput?.focus(), 320);
  };

  const handleButtonClick = (
    event: MouseEvent<HTMLAnchorElement>,
    url?: string
  ) => {
    if (url?.includes('#generator') || url === '/create') {
      event.preventDefault();
      focusPromptInput();
    }
  };

  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className="container">
        <div className="text-center">
          <ScrollAnimation>
            <h2 className="landing-title text-4xl font-semibold text-balance lg:text-5xl">
              {section.title}
            </h2>
          </ScrollAnimation>
          <ScrollAnimation delay={0.15}>
            <p
              className="landing-body mt-4"
              dangerouslySetInnerHTML={{ __html: section.description ?? '' }}
            />
          </ScrollAnimation>

          <ScrollAnimation delay={0.3}>
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {section.buttons?.map((button, idx) => (
                <Button
                  asChild
                  size={button.size || 'default'}
                  variant={button.variant || 'default'}
                  key={idx}
                >
                  <Link
                    href={button.url || ''}
                    target={button.target || '_self'}
                    onClick={(event) => handleButtonClick(event, button.url)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1890ff] px-6 text-sm font-medium text-white transition-colors hover:bg-[#1677ff] dark:bg-[#1890ff] dark:text-white dark:hover:bg-[#1677ff]"
                  >
                    {button.icon && <SmartIcon name={button.icon as string} />}
                    <span>{button.title}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

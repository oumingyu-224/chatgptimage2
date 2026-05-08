import { Send } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import {
  BrandLogo,
  Copyright,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';
import { NavItem } from '@/shared/types/blocks/common';
import { Footer as FooterType } from '@/shared/types/blocks/landing';

export function Footer({ footer }: { footer: FooterType }) {
  const emailItem = footer.social?.items?.find((item) =>
    item.url?.startsWith('mailto:')
  );

  return (
    <footer
      id={footer.id}
      className={`landing-surface-footer border-t ${footer.className || ''}`}
    >
      <div className="bg-transparent">
        <div className="container py-14">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
            <div className="space-y-5">
              {footer.brand ? <BrandLogo brand={footer.brand} /> : null}

              {footer.brand?.description ? (
                <p
                  className="landing-soft-text max-w-sm text-[15px] leading-8"
                  dangerouslySetInnerHTML={{ __html: footer.brand.description }}
                />
              ) : null}

              <a
                href={emailItem?.url || 'mailto:ai-image@chatgptimage2.app'}
                target={emailItem?.target || '_self'}
                aria-label={emailItem?.title || 'Subscribe'}
                className="inline-flex size-11 items-center justify-center rounded-xl bg-[#1773ea] text-white shadow-[0_12px_24px_rgba(23,115,234,0.22)] transition-transform hover:-translate-y-0.5"
              >
                <Send className="size-4" />
              </a>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {footer.nav?.items.map((item, idx) => (
                <div key={idx}>
                  <div className="landing-strong mb-4 text-xs font-semibold tracking-[0.08em] uppercase">
                    {item.title}
                  </div>
                  <div className="space-y-3">
                    {item.children?.map((subItem, iidx) => (
                      <Link
                        key={iidx}
                        href={subItem.url || ''}
                        target={subItem.target || ''}
                        className="landing-soft-text block text-sm transition-colors hover:text-[var(--landing-nav-text-hover)]"
                      >
                        {subItem.title || ''}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex justify-end">
            <div className="flex items-center gap-3">
              {footer.show_theme !== false ? (
                <ThemeToggler type="toggle" />
              ) : null}
              {footer.show_locale !== false ? (
                <LocaleSelector type="button" />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="landing-divider-soft border-t">
        <div className="container py-4">
          <div className="landing-muted flex flex-wrap items-center gap-3 text-[11px]">
            <span className="font-medium tracking-[0.12em] uppercase">
              Featured on
            </span>
            {Array.from({ length: 14 }).map((_, idx) => (
              <span
                key={idx}
                className="landing-input-surface inline-flex h-5 min-w-14 items-center justify-center rounded border px-2"
              >
                Media {idx + 1}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-divider-soft border-t">
        <div className="container py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {footer.copyright ? (
                <p
                  className="landing-body text-sm"
                  dangerouslySetInnerHTML={{ __html: footer.copyright }}
                />
              ) : footer.brand ? (
                <Copyright brand={footer.brand} />
              ) : null}

              {footer.agreement?.items?.length ? (
                <div className="flex flex-wrap items-center gap-4">
                  {footer.agreement.items.map(
                    (item: NavItem, index: number) => (
                      <Link
                        key={index}
                        href={item.url || ''}
                        target={item.target || ''}
                        className="landing-body text-sm transition-colors hover:text-[var(--landing-nav-text-hover)]"
                      >
                        {item.title || ''}
                      </Link>
                    )
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

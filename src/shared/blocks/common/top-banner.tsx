'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { cacheGet, cacheSet } from '@/shared/lib/cache';
import { getTimestamp } from '@/shared/lib/time';
import { cn } from '@/shared/lib/utils';

type TopBannerLinkTarget = '_self' | '_blank';

export type TopBannerProps = {
  enabled?: boolean;
  /**
   * Used to build the dismiss cache key. Change it when you change the banner.
   */
  id?: string;
  /**
   * Banner main text.
   */
  text: ReactNode;
  /**
   * CTA button text. When omitted, the button is hidden.
   */
  buttonText?: string;
  /**
   * CTA link. When provided, clicking the button navigates to this URL.
   */
  href?: string;
  /**
   * Open the link in a new tab. Defaults to false.
   */
  target?: TopBannerLinkTarget;
  /**
   * Whether the banner can be dismissed. Defaults to true.
   */
  closable?: boolean;
  /**
   * Remember dismiss state in cache. Defaults to true.
   */
  rememberDismiss?: boolean;
  /**
   * Dismiss expiry in days. Defaults to 7.
   */
  dismissedExpiryDays?: number;
  /**
   * Extra class names for the banner wrapper.
   */
  className?: string;
  /**
   * Optional callback when user clicks the CTA and no `href` is provided.
   */
  onAction?: () => void;
};

function isExternalHref(href: string) {
  return (
    /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)
  );
}

export function TopBanner({
  enabled = true,
  id = 'default',
  text,
  buttonText,
  href,
  target = '_self',
  closable = true,
  rememberDismiss = true,
  dismissedExpiryDays = 7,
  className,
  onAction,
}: TopBannerProps) {
  const dismissKey = useMemo(() => `top-banner-dismissed:${id}`, [id]);

  const [showBanner, setShowBanner] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);
  const hasCheckedRef = useRef(false);

  const isDismissed = (): boolean => {
    if (!rememberDismiss) return false;
    return Boolean(cacheGet(dismissKey));
  };

  const setDismissed = () => {
    if (!rememberDismiss) return;
    const expiresAt = getTimestamp() + dismissedExpiryDays * 24 * 60 * 60;
    cacheSet(dismissKey, 'true', expiresAt);
  };

  useEffect(() => {
    // Only run initial check once to avoid flicker in strict mode / rerenders
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    if (!enabled) return;
    if (isDismissed()) return;

    setShowBanner(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Adjust header and layout spacing when banner visibility changes
  useEffect(() => {
    if (showBanner && bannerRef.current) {
      const bannerHeight = bannerRef.current.offsetHeight;
      setBannerHeight(bannerHeight);

      const header = document.querySelector('header');
      if (header) {
        header.style.top = `${bannerHeight}px`;
      }

      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]'
      );
      if (sidebarContainer) {
        (sidebarContainer as HTMLElement).style.top = `${bannerHeight}px`;
        (sidebarContainer as HTMLElement).style.height =
          `calc(100vh - ${bannerHeight}px)`;
      }

      const sidebarWrapper = document.querySelector(
        '[data-slot="sidebar-wrapper"]'
      );
      if (sidebarWrapper) {
        (sidebarWrapper as HTMLElement).style.paddingTop = `${bannerHeight}px`;
      }
    } else {
      setBannerHeight(0);
    }

    return () => {
      const header = document.querySelector('header');
      if (header) {
        header.style.top = '0px';
      }

      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]'
      );
      if (sidebarContainer) {
        (sidebarContainer as HTMLElement).style.top = '0px';
        (sidebarContainer as HTMLElement).style.height = '100vh';
      }

      const sidebarWrapper = document.querySelector(
        '[data-slot="sidebar-wrapper"]'
      );
      if (sidebarWrapper) {
        (sidebarWrapper as HTMLElement).style.paddingTop = '0px';
      }
    };
  }, [showBanner]);

  useEffect(() => {
    if (!showBanner || !bannerRef.current) return;

    const updateHeight = () => {
      if (bannerRef.current) {
        setBannerHeight(bannerRef.current.offsetHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(bannerRef.current);

    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [showBanner]);

  const handleDismiss = () => {
    setDismissed();
    setShowBanner(false);
    setBannerHeight(0);

    const header = document.querySelector('header');
    if (header) {
      header.style.top = '0px';
    }

    const sidebarContainer = document.querySelector(
      '[data-slot="sidebar-container"]'
    );
    if (sidebarContainer) {
      (sidebarContainer as HTMLElement).style.top = '0px';
      (sidebarContainer as HTMLElement).style.height = '100vh';
    }

    const sidebarWrapper = document.querySelector(
      '[data-slot="sidebar-wrapper"]'
    );
    if (sidebarWrapper) {
      (sidebarWrapper as HTMLElement).style.paddingTop = '0px';
    }
  };

  if (!enabled || !showBanner) {
    return null;
  }

  const showButton =
    Boolean(buttonText) && (Boolean(href) || Boolean(onAction));

  return (
    <>
      <div
        ref={bannerRef}
        className={cn(
          'fixed top-0 right-0 left-0 z-[51] bg-gradient-to-r from-[#ff8a00] via-[#ff6a00] to-[#ff4d00] text-white',
          className
        )}
      >
        <div className="container">
          <div className="relative flex min-h-11 items-center justify-center px-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-1 text-sm font-medium">
              <div
                className="inline"
                dangerouslySetInnerHTML={{ __html: String(text ?? '') }}
              />
              {showButton ? (
                href ? (
                  isExternalHref(href) ? (
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="h-auto px-0 text-sm font-semibold text-white no-underline hover:underline"
                    >
                      <a
                        href={href}
                        target={target}
                        rel={
                          target === '_blank'
                            ? 'noreferrer noopener'
                            : undefined
                        }
                      >
                        {buttonText}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="h-auto px-0 text-sm font-semibold text-white no-underline hover:underline"
                    >
                      <Link href={href}>{buttonText}</Link>
                    </Button>
                  )
                ) : (
                  <Button
                    onClick={onAction}
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-sm font-semibold text-white no-underline hover:underline"
                  >
                    {buttonText}
                  </Button>
                )
              ) : null}
            </div>
            {closable ? (
              <button
                onClick={handleDismiss}
                className="sr-only"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{ height: bannerHeight }}
        className="pointer-events-none"
      />
    </>
  );
}

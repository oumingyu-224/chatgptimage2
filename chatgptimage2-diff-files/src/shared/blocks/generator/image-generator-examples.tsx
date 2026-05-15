'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';

type ExampleItem = {
  beforeImage: string;
  afterImage: string;
  prompt: string;
};

const EXAMPLES: ExampleItem[] = [
  {
    beforeImage: '/imgs/demos/reference-beach-model.jpg',
    afterImage: '/imgs/demos/result-red-bikini.jpg',
    prompt: 'change the bikini to red',
  },
  {
    beforeImage: '/imgs/demos/reference-beach-model.jpg',
    afterImage: '/imgs/demos/result-anime-figure-showcase.jpg',
    prompt:
      'Transform this anime character into a collectible figure product showcase: Create a physical PVC figure standing on a clear round base, place a product box with the character artwork behind it, and add a computer monitor showing the 3D modeling process in Blender.',
  },
  {
    beforeImage: '/imgs/demos/reference-vintage-photo.jpg',
    afterImage: '/imgs/demos/result-restored-color-photo.jpg',
    prompt: 'Repair and color this photo',
  },
  {
    beforeImage: '/imgs/demos/reference-beach-model.jpg',
    afterImage: '/imgs/demos/result-crochet-doll.jpg',
    prompt:
      'Transform the subject into a handmade crocheted yarn doll with a cute, chibi-style appearance.',
  },
  {
    beforeImage: '/imgs/demos/reference-beach-model.jpg',
    afterImage: '/imgs/demos/result-starry-night-style.jpg',
    prompt: "Reimagine the photo in the style of Van Gogh's 'Starry Night'.",
  },
  {
    beforeImage: '/imgs/demos/reference-beach-model.jpg',
    afterImage: '/imgs/demos/result-blue-hair.jpg',
    prompt: 'Change the hair to blue.',
  },
  {
    beforeImage: '/imgs/demos/reference-beach-model.jpg',
    afterImage: '/imgs/demos/result-lego-minifigure.jpg',
    prompt:
      'Transform the person into a LEGO minifigure, inside its packaging box.',
  },
];

export function ImageGeneratorExamples({
  onApplyPrompt,
  onApply,
}: {
  onApplyPrompt: (prompt: string) => void;
  onApply?: () => void;
}) {
  const t = useTranslations('ai.image.generator.examples');
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedImage, setSelectedImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const current = EXAMPLES[index];

  const handlePrevious = useCallback(() => {
    setDirection(-1);
    setIndex((prev) => (prev === 0 ? EXAMPLES.length - 1 : prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setDirection(1);
    setIndex((prev) => (prev === EXAMPLES.length - 1 ? 0 : prev + 1));
  }, []);

  const handleGoTo = useCallback(
    (itemIndex: number) => {
      if (itemIndex === index) {
        return;
      }
      setDirection(itemIndex > index ? 1 : -1);
      setIndex(itemIndex);
    },
    [index]
  );

  useEffect(() => {
    if (selectedImage) {
      return;
    }

    const timer = window.setInterval(() => {
      setDirection(1);
      setIndex((prev) => (prev === EXAMPLES.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => window.clearInterval(timer);
  }, [selectedImage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedImage) {
        if (event.key === 'Escape') {
          setSelectedImage(null);
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        handlePrevious();
      }
      if (event.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, selectedImage]);

  useEffect(() => {
    const className = 'showcase-preview-open';

    if (selectedImage) {
      document.body.classList.add(className);
      return () => document.body.classList.remove(className);
    }

    document.body.classList.remove(className);
    return () => document.body.classList.remove(className);
  }, [selectedImage]);

  const handleApplyPrompt = async () => {
    await navigator.clipboard.writeText(current.prompt);
    onApplyPrompt(current.prompt);
    onApply?.();
    toast.success(t('messages.pasted'));
  };

  const renderExampleImages = (item: ExampleItem, isHidden = false) => (
    <div
      aria-hidden={isHidden}
      className={`grid grid-cols-2 gap-3 ${isHidden ? 'invisible' : ''}`}
    >
      <div className="space-y-2">
        <button
          type="button"
          className="relative block w-full overflow-hidden rounded-2xl border-2 border-border/70 bg-muted/30 shadow-sm"
          onClick={() =>
            setSelectedImage({
              src: item.beforeImage,
              alt: t('alts.before'),
            })
          }
          tabIndex={isHidden ? -1 : 0}
        >
          <div className="relative aspect-[9/16]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.beforeImage}
              alt={t('alts.before')}
              className="absolute inset-0 block h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
              loading="lazy"
              draggable={false}
            />
          </div>
        </button>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="relative block w-full overflow-hidden rounded-2xl border-2 border-primary/25 bg-muted/30 shadow-md"
          onClick={() =>
            setSelectedImage({
              src: item.afterImage,
              alt: t('alts.after'),
            })
          }
          tabIndex={isHidden ? -1 : 0}
        >
          <div className="relative aspect-[9/16]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.afterImage}
              alt={t('alts.after')}
              className="absolute inset-0 block h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
              loading="lazy"
              draggable={false}
            />
            <div className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              <Sparkles className="h-3 w-3" />
              {t('badge')}
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-3xl bg-gradient-to-br from-sky-50 via-background to-violet-50 p-5 shadow-sm dark:bg-[linear-gradient(145deg,rgba(17,24,39,0.98),rgba(15,23,42,0.96)_55%,rgba(12,18,32,0.98))] dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>{t('title')}</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {index + 1} / {EXAMPLES.length}
          </span>
        </div>

        <div className="relative rounded-[28px] border border-white/55 bg-white/45 p-5 backdrop-blur-sm dark:border-slate-600/60 dark:bg-slate-900/40">
          <div className="mb-2 grid grid-cols-2 gap-3">
            <p className="text-center text-sm font-medium text-muted-foreground">
              {t('before')}
            </p>
            <p className="text-center text-sm font-medium text-muted-foreground">
              {t('after')}
            </p>
          </div>

          <div className="relative overflow-visible">
            <button
              type="button"
              aria-label={t('actions.previous')}
              className="absolute top-1/2 left-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/70 bg-background/95 p-2 shadow-md transition-colors hover:bg-background dark:border-slate-600/70 dark:bg-slate-900/95 dark:hover:bg-slate-900"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              type="button"
              aria-label={t('actions.next')}
              className="absolute top-1/2 right-0 z-10 translate-x-1/2 -translate-y-1/2 rounded-full border border-border/70 bg-background/95 p-2 shadow-md transition-colors hover:bg-background dark:border-slate-600/70 dark:bg-slate-900/95 dark:hover:bg-slate-900"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="relative overflow-hidden rounded-[1.65rem]">
              {renderExampleImages(current, true)}
              <AnimatePresence custom={direction} initial={false}>
                <motion.div
                  key={index}
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 72 : -72 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -72 : 72 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  {renderExampleImages(current)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-background/90 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/55">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{t('prompt_used')}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
              onClick={handleApplyPrompt}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              {t('actions.paste')}
            </Button>
          </div>
          <p className="min-h-[4.5rem] line-clamp-3 text-sm leading-6 font-medium italic text-foreground/80">
            &quot;{current.prompt}&quot;
          </p>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {EXAMPLES.map((_, itemIndex) => (
            <button
              key={itemIndex}
              type="button"
              aria-label={t('actions.go_to', { index: itemIndex + 1 })}
              className={`h-2 rounded-full transition-all duration-300 ${
                itemIndex === index
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-primary/20 hover:bg-primary/35 dark:bg-primary/30 dark:hover:bg-primary/45'
              }`}
              onClick={() => handleGoTo(itemIndex)}
            />
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t('hint')}
        </p>
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm md:p-8"
            onClick={() => setSelectedImage(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 z-50 text-white/70 transition-colors hover:text-white"
              onClick={() => setSelectedImage(null)}
            >
              <X className="size-8" />
            </button>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-full w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative max-h-full max-w-full overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  className="h-auto max-h-[90vh] w-auto max-w-full object-contain"
                  loading="eager"
                  draggable={false}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

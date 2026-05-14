'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CreditCard,
  Download,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  Settings2,
  Sparkles,
  User,
  Wand,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

import enPricingMessages from '@/config/locale/messages/en/pages/pricing.json';
import zhPricingMessages from '@/config/locale/messages/zh/pages/pricing.json';
import { Link } from '@/core/i18n/navigation';
import { ROLES } from '@/shared/constants/rbac';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
import { Pricing as PricingBlock } from '@/themes/default/blocks/pricing';
import {
  ImageUploader,
  ImageUploaderValue,
  LazyImage,
} from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { GENERATOR_FEATURED_SHOWCASES } from '@/shared/constants/generator-featured-showcases';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';
import { Pricing as PricingData } from '@/shared/types/blocks/pricing';

interface ImageGeneratorProps {
  allowMultipleImages?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  srOnlyTitle?: string;
  className?: string;
  promptKey?: string;
  defaultModel?: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
}

type FeaturedShowcaseItem = {
  id: string;
  title: string;
  description?: string;
  prompt?: string;
  image: string;
  tags?: string;
};

interface BackendTask {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string | null;
  taskInfo: string | null;
  taskResult: string | null;
}

type ImageGeneratorTab = 'text-to-image' | 'image-to-image';

const POLL_INTERVAL = 5000;
const GENERATION_TIMEOUT = 180000;
const MAX_PROMPT_LENGTH = 2000;

const MODEL_OPTIONS = [
  {
    value: 'gpt-image-2-image-to-image',
    label: 'GPT Image 2',
    provider: 'kie',
    scenes: ['image-to-image'],
  },
  {
    value: 'gpt-image-2-text-to-image',
    label: 'GPT Image 2',
    provider: 'kie',
    scenes: ['text-to-image'],
  },
  {
    value: 'flux-2/pro-image-to-image',
    label: 'Flux Klein',
    provider: 'kie',
    scenes: ['image-to-image'],
  },
  {
    value: 'flux-2/pro-text-to-image',
    label: 'Flux Klein',
    provider: 'kie',
    scenes: ['text-to-image'],
  },
  {
    value: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'kie',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'google/nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'replicate',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'bytedance/seedream-4',
    label: 'Seedream 4',
    provider: 'replicate',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'fal-ai/nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'fal',
    scenes: ['text-to-image'],
  },
  {
    value: 'fal-ai/nano-banana-pro/edit',
    label: 'Nano Banana Pro Edit',
    provider: 'fal',
    scenes: ['image-to-image'],
  },
  {
    value: 'fal-ai/bytedance/seedream/v4/edit',
    label: 'Seedream 4',
    provider: 'fal',
    scenes: ['image-to-image'],
  },
  {
    value: 'fal-ai/z-image/turbo',
    label: 'Z-Image Turbo',
    provider: 'fal',
    scenes: ['text-to-image'],
  },
  {
    value: 'fal-ai/flux-2-flex',
    label: 'Flux 2 Flex',
    provider: 'fal',
    scenes: ['text-to-image'],
  },
  {
    value: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview',
    provider: 'gemini',
    scenes: ['text-to-image', 'image-to-image'],
  },
];

const PROVIDER_OPTIONS = [
  {
    value: 'kie',
    label: 'Kie',
  },
  {
    value: 'replicate',
    label: 'Replicate',
  },
  {
    value: 'fal',
    label: 'Fal',
  },
  {
    value: 'gemini',
    label: 'Gemini',
  },
];

// 宽高比选项
const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '3:4', label: '3:4 (Vertical)' },
  { value: '3:2', label: '3:2 (Classic)' },
  { value: '2:3', label: '2:3 (Portrait Classic)' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
];

// 分辨率选项 - 必须与 Kie API 要求完全匹配（大写 K，且只有 1K 和 2K）
const RESOLUTION_OPTIONS = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
];

const OUTPUT_COUNT_OPTIONS = ['1', '2', '3', '4'];
const QUALITY_OPTIONS = [
  { value: 'standard', labelKey: 'settings.quality_standard', badge: '1K' },
  { value: 'hd', labelKey: 'settings.quality_hd', badge: '2K' },
  { value: 'ultra', labelKey: 'settings.quality_ultra', badge: '4K' },
];

function getImageBaseCredits(hasReferenceImages: boolean) {
  return hasReferenceImages ? 6 : 4;
}

function getQualityMultiplier(qualityStyle: string) {
  if (qualityStyle === 'hd') return 2;
  if (qualityStyle === 'ultra') return 4;
  return 1;
}

function calculateImageCredits({
  hasReferenceImages,
  qualityStyle,
  outputCount,
}: {
  hasReferenceImages: boolean;
  qualityStyle: string;
  outputCount: string;
}) {
  const baseCredits = getImageBaseCredits(hasReferenceImages);
  const qualityMultiplier = getQualityMultiplier(qualityStyle);
  const quantityMultiplier = Math.max(1, Number.parseInt(outputCount, 10) || 1);

  return baseCredits * qualityMultiplier * quantityMultiplier;
}

function parseTaskResult(taskResult: string | null): any {
  if (!taskResult) {
    return null;
  }

  try {
    return JSON.parse(taskResult);
  } catch (error) {
    console.warn('Failed to parse taskResult:', error);
    return null;
  }
}

function extractImageUrls(result: any): string[] {
  if (!result) {
    return [];
  }

  const output = result.output ?? result.images ?? result.data;

  if (!output) {
    return [];
  }

  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === 'string') return [item];
        if (typeof item === 'object') {
          const candidate =
            item.url ?? item.uri ?? item.image ?? item.src ?? item.imageUrl;
          return typeof candidate === 'string' ? [candidate] : [];
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof output === 'object') {
    const candidate =
      output.url ?? output.uri ?? output.image ?? output.src ?? output.imageUrl;
    if (typeof candidate === 'string') {
      return [candidate];
    }
  }

  return [];
}

export function ImageGenerator({
  allowMultipleImages = true,
  maxImages = 9,
  maxSizeMB = 5,
  srOnlyTitle,
  className,
  promptKey,
  defaultModel,
}: ImageGeneratorProps) {
  const locale = useLocale();
  const t = useTranslations('ai.image.generator');

  const [activeTab, setActiveTab] =
    useState<ImageGeneratorTab>('text-to-image');

  const [provider, setProvider] = useState(PROVIDER_OPTIONS[0]?.value ?? '');
  const [model, setModel] = useState(MODEL_OPTIONS[0]?.value ?? '');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9'); // 默认宽高比
  const [resolution, setResolution] = useState<string>('2K'); // 默认分辨率（大写 K）
  const [qualityStyle, setQualityStyle] = useState<string>('standard');
  const [outputCountStyle, setOutputCountStyle] = useState<string>('1');
  const [prompt, setPrompt] = useState('');
  const [previewImage, setPreviewImage] = useState<string>(
    promptKey
      ? ''
      : 'https://kie.ai/cdn-cgi/image/width=1920,quality=85,fit=scale-down,format=webp/https://static.aiquickdraw.com/tools/example/1764234173157_0nmhDbXC.png'
  );
  const [referenceImageItems, setReferenceImageItems] = useState<
    ImageUploaderValue[]
  >([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null
  );
  const [taskStatus, setTaskStatus] = useState<AITaskStatus | null>(null);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(
    null
  );
  const [isMounted, setIsMounted] = useState(false);
  const savedTaskIdsRef = useRef<Set<string>>(new Set());
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const hasLoadedCreditsRef = useRef(false);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const [selectedShowcaseIndex, setSelectedShowcaseIndex] = useState<number | null>(
    null
  );
  const [copiedShowcaseId, setCopiedShowcaseId] = useState<string | null>(null);
  const [showPricingDialog, setShowPricingDialog] = useState(false);

  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();

  const featuredShowcases = GENERATOR_FEATURED_SHOWCASES;
  const pricingConfig = useMemo(
    () =>
      (locale.startsWith('zh')
        ? zhPricingMessages.pricing
        : enPricingMessages.pricing) as PricingData,
    [locale]
  );
  const activeFeaturedItem =
    featuredShowcases[activeFeaturedIndex] ?? featuredShowcases[0] ?? null;
  const selectedShowcaseItem =
    selectedShowcaseIndex !== null
      ? featuredShowcases[selectedShowcaseIndex] ?? null
      : null;
  const visibleFeaturedShowcases = useMemo(() => {
    return featuredShowcases.slice(0, 4);
  }, [featuredShowcases]);

  useEffect(() => {
    setIsMounted(true);

    // Fetch available AI providers
    fetch('/api/ai/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 0 && data.data?.providers !== undefined) {
          const providers = data.data.providers || [];
          console.log('Available AI providers:', providers);
          setAvailableProviders(providers);

          // Set initial provider and model based on available providers
          if (providers.length > 0) {
            const firstProvider = providers[0];
            setProvider(firstProvider);

            // Find first available model for this provider
            const availableModel = MODEL_OPTIONS.find(
              (option) =>
                option.scenes.includes(activeTab) &&
                option.provider === firstProvider
            );

            if (availableModel) {
              setModel(availableModel.value);
            }
          } else {
            // No providers configured, clear provider and model
            console.log(
              'No AI providers configured, clearing provider and model'
            );
            setProvider('');
            setModel('');
          }
        }
      })
      .catch((error) => {
        console.error('Failed to fetch AI providers:', error);
        setAvailableProviders([]);
      })
      .finally(() => {
        setIsLoadingProviders(false);
      });
  }, []);

  // Track user ID to reset credits loading flag when user changes
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset flag when user changes
    if (user?.id !== userIdRef.current) {
      userIdRef.current = user?.id || null;
      hasLoadedCreditsRef.current = false;
    }

    // Only fetch credits once per user session
    if (user && !user.credits && !hasLoadedCreditsRef.current) {
      hasLoadedCreditsRef.current = true;
      setIsLoadingCredits(true);
      fetchUserCredits().finally(() => {
        setIsLoadingCredits(false);
      });
    }
  }, [user?.id, user?.credits, fetchUserCredits]);

  useEffect(() => {
    if (promptKey) {
      setPrompt(promptKey);
      setActiveTab('text-to-image');

      if (availableProviders.length > 0) {
        const firstProvider = availableProviders[0];
        setProvider(firstProvider);

        const availableModel = MODEL_OPTIONS.find(
          (option) =>
            option.scenes.includes('text-to-image') &&
            option.provider === firstProvider
        );

        if (availableModel) {
          setModel(availableModel.value);
        }
      }
    } else {
      setPrompt('');
      setPreviewImage(
        'https://kie.ai/cdn-cgi/image/width=1920,quality=85,fit=scale-down,format=webp/https://static.aiquickdraw.com/tools/example/1767778245494_Yf0asfLH.png'
      );
      setActiveTab('text-to-image');

      // Reset to default provider and model for text-to-image
      if (availableProviders.length > 0) {
        const firstProvider = availableProviders[0];
        setProvider(firstProvider);

        const availableModel = MODEL_OPTIONS.find(
          (option) =>
            option.scenes.includes('text-to-image') &&
            option.provider === firstProvider
        );

        if (availableModel) {
          setModel(availableModel.value);
        }
      }
    }
  }, [promptKey, availableProviders]);

  const promptLength = prompt.trim().length;
  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const hasActiveSubscription = !!user?.currentSubscription;
  const isPromptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const isTextToImageMode = activeTab === 'text-to-image';
  const hasReferenceImages = referenceImageUrls.length > 0;
  const costCredits = useMemo(
    () =>
      calculateImageCredits({
        hasReferenceImages,
        qualityStyle,
        outputCount: outputCountStyle,
      }),
    [hasReferenceImages, qualityStyle, outputCountStyle]
  );
  const promptNote = t('form.prompt_note');
  const optionalLabel = t('form.optional');
  const canSaveShowcase = useMemo(
    () => user?.roles?.some((role) => role.name === ROLES.SUPER_ADMIN) ?? false,
    [user?.roles]
  );

  const focusPromptInput = useCallback(() => {
    const promptInput = document.getElementById('image-prompt');
    promptInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => promptInput?.focus(), 320);
  }, []);

  const handleTryShowcasePrompt = useCallback(() => {
    if (selectedShowcaseItem?.prompt) {
      setPrompt(selectedShowcaseItem.prompt);
    }
    setSelectedShowcaseIndex(null);
    window.setTimeout(focusPromptInput, 80);
  }, [focusPromptInput, selectedShowcaseItem?.prompt]);

  const handlePreviousFeatured = useCallback(() => {
    setActiveFeaturedIndex((prev) =>
      prev === 0 ? featuredShowcases.length - 1 : prev - 1
    );
  }, [featuredShowcases.length]);

  const handleNextFeatured = useCallback(() => {
    setActiveFeaturedIndex((prev) =>
      prev === featuredShowcases.length - 1 ? 0 : prev + 1
    );
  }, [featuredShowcases.length]);

  const copyShowcasePrompt = useCallback(
    async (item?: FeaturedShowcaseItem | null) => {
      if (!item?.prompt) {
        toast.error(t('errors.no_prompt'));
        return;
      }

      try {
        await navigator.clipboard.writeText(item.prompt);
        setCopiedShowcaseId(item.id);
        toast.success(t('featured.copied_prompt'));
        window.setTimeout(() => {
          setCopiedShowcaseId((current) => (current === item.id ? null : current));
        }, 1600);
      } catch (error) {
        toast.error(t('featured.copy_failed'));
      }
    },
    [t]
  );

  const handleQualitySelect = useCallback(
    (value: string, badge: string) => {
      if (badge === '4K' && !hasActiveSubscription) {
        setShowPricingDialog(true);
        return;
      }

      setQualityStyle(value);
      if (badge === '2K') setResolution('2K');
      if (badge === '1K') setResolution('1K');
      if (badge === '4K') setResolution('4K');
    },
    [hasActiveSubscription]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedShowcaseIndex === null) return;
      if (e.key === 'Escape') setSelectedShowcaseIndex(null);
      if (e.key === 'ArrowLeft') {
        setSelectedShowcaseIndex((prev) =>
          prev !== null ? (prev === 0 ? featuredShowcases.length - 1 : prev - 1) : null
        );
      }
      if (e.key === 'ArrowRight') {
        setSelectedShowcaseIndex((prev) =>
          prev !== null ? (prev === featuredShowcases.length - 1 ? 0 : prev + 1) : null
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [featuredShowcases.length, selectedShowcaseIndex]);

  const handleTabChange = (value: string) => {
    const tab = value as ImageGeneratorTab;
    setActiveTab(tab);

    const availableModels = MODEL_OPTIONS.filter(
      (option) =>
        option.scenes.includes(tab) &&
        option.provider === provider &&
        availableProviders.includes(option.provider)
    );

    if (availableModels.length > 0) {
      setModel(availableModels[0].value);
    } else {
      setModel('');
    }

  };

  const handleProviderChange = (value: string) => {
    setProvider(value);

    const availableModels = MODEL_OPTIONS.filter(
      (option) =>
        option.scenes.includes(activeTab) &&
        option.provider === value &&
        availableProviders.includes(option.provider)
    );

    if (availableModels.length > 0) {
      setModel(availableModels[0].value);
    } else {
      setModel('');
    }
  };

  const taskStatusLabel = useMemo(() => {
    if (!taskStatus) {
      return '';
    }

    switch (taskStatus) {
      case AITaskStatus.PENDING:
        return t('progress_pending');
      case AITaskStatus.PROCESSING:
        return t('progress_processing');
      case AITaskStatus.SUCCESS:
        return t('progress_success');
      case AITaskStatus.FAILED:
        return t('progress_failed');
      default:
        return '';
    }
  }, [taskStatus, t]);

  const handleReferenceImagesChange = useCallback(
    (items: ImageUploaderValue[]) => {
      setReferenceImageItems(items);
      const uploadedUrls = items
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);
      setReferenceImageUrls(uploadedUrls);
    },
    []
  );

  const isReferenceUploading = useMemo(
    () => referenceImageItems.some((item) => item.status === 'uploading'),
    [referenceImageItems]
  );

  const hasReferenceUploadError = useMemo(
    () => referenceImageItems.some((item) => item.status === 'error'),
    [referenceImageItems]
  );

  const resetTaskState = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setTaskId(null);
    setGenerationStartTime(null);
    setTaskStatus(null);
    // Don't clear savedTaskIds here - keep it to prevent duplicates across generations
  }, []);

  const saveShowcase = useCallback(
    async (imageUrl: string, taskIdForTracking: string, promptText: string) => {
      // Prevent duplicate saves for the same task
      if (savedTaskIdsRef.current.has(taskIdForTracking)) {
        console.log('Already saved, skipping:', taskIdForTracking);
        return;
      }

      // Mark as saved immediately to prevent race conditions
      savedTaskIdsRef.current.add(taskIdForTracking);
      console.log('Saving showcase for task:', taskIdForTracking);

      try {
        const compressImageFile = async (imageUrl: string): Promise<string> => {
          console.log('Fetching image from proxy...');
          const response = await fetch(
            `/api/proxy/file?url=${encodeURIComponent(imageUrl)}`
          );
          if (!response.ok) throw new Error('Failed to fetch image');

          const blob = await response.blob();
          const file = new File([blob], 'showcase.jpg', { type: blob.type });

          // Use shared compressImage function
          const { compressImage } = await import('@/shared/blocks/common');
          const compressedFile = await compressImage(file);

          return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', compressedFile);

            console.log('Uploading compressed image...');
            fetch('/api/upload', {
              method: 'POST',
              body: formData,
            })
              .then((res) => {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
              })
              .then((result) => {
                if (!result.success || !result.url) {
                  throw new Error(result.error || 'Upload failed');
                }
                console.log('Upload successful:', result.url);
                resolve(result.url);
              })
              .catch(reject);
          });
        };

        const compressedImageUrl = await compressImageFile(imageUrl);

        console.log('Adding showcase to database...');
        await fetch('/api/showcases/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: promptText.trim().substring(0, 100),
            prompt: promptText.trim(),
            image: compressedImageUrl,
            tags: promptKey || null,
          }),
        });
        console.log('Showcase saved successfully');
        toast.success(t('success.saved_to_showcase'));
      } catch (error) {
        console.error('Failed to save showcase:', error);
        toast.error(t('errors.save_showcase_failed'));
        // Remove from saved set if failed
        savedTaskIdsRef.current.delete(taskIdForTracking);
      }
    },
    [prompt, promptKey, t]
  );

  const pollTaskStatus = useCallback(
    async (id: string) => {
      try {
        // Check if already saved to prevent duplicate processing
        if (savedTaskIdsRef.current.has(id)) {
          console.log('Task already processed, stopping poll:', id);
          return true;
        }

        if (
          generationStartTime &&
          Date.now() - generationStartTime > GENERATION_TIMEOUT
        ) {
          resetTaskState();
          toast.error(t('errors.timed_out'));
          return true;
        }

        const resp = await fetch('/api/ai/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: id }),
        });

        if (!resp.ok) {
          throw new Error(`request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Query task failed');
        }

        const task = data as BackendTask;
        const currentStatus = task.status as AITaskStatus;
        setTaskStatus(currentStatus);

        const parsedResult = parseTaskResult(task.taskInfo);
        const imageUrls = extractImageUrls(parsedResult);

        if (currentStatus === AITaskStatus.PENDING) {
          setProgress((prev) => Math.max(prev, 20));
          return false;
        }

        if (currentStatus === AITaskStatus.PROCESSING) {
          if (imageUrls.length > 0) {
            setGeneratedImages(
              imageUrls.map((url, index) => ({
                id: `${task.id}-${index}`,
                url,
                provider: task.provider,
                model: task.model,
                prompt: task.prompt ?? undefined,
              }))
            );
            setProgress((prev) => Math.max(prev, 85));
          } else {
            setProgress((prev) => Math.min(prev + 10, 80));
          }
          return false;
        }

        if (currentStatus === AITaskStatus.SUCCESS) {
          if (imageUrls.length === 0) {
            toast.error(t('errors.provider_returned_no_images'));
          } else {
            const images = imageUrls.map((url, index) => ({
              id: `${task.id}-${index}`,
              url,
              provider: task.provider,
              model: task.model,
              prompt: task.prompt ?? undefined,
            }));
            setGeneratedImages(images);

            if (
              canSaveShowcase &&
              images.length > 0 &&
              !savedTaskIdsRef.current.has(task.id)
            ) {
              await saveShowcase(
                images[0].url,
                task.id,
                task.prompt ?? prompt
              );
            }
            toast.success(t('success.generated_successfully'));
          }

          setProgress(100);
          resetTaskState();
          return true;
        }

        if (currentStatus === AITaskStatus.FAILED) {
          const errorMessage =
            parsedResult?.errorMessage || 'Generate image failed';
          toast.error(errorMessage);
          resetTaskState();

          fetchUserCredits();

          return true;
        }

        setProgress((prev) => Math.min(prev + 5, 95));
        return false;
      } catch (error: any) {
        console.error('Error polling image task:', error);
        toast.error(t('errors.query_task_failed', { message: error.message }));
        resetTaskState();

        fetchUserCredits();

        return true;
      }
    },
    [
      generationStartTime,
      resetTaskState,
      fetchUserCredits,
      saveShowcase,
      canSaveShowcase,
      prompt,
      t,
    ]
  );

  useEffect(() => {
    if (!taskId || !isGenerating) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (!taskId) {
        return;
      }
      const completed = await pollTaskStatus(taskId);
      if (completed) {
        cancelled = true;
      }
    };

    tick();

    const interval = setInterval(async () => {
      if (cancelled || !taskId) {
        clearInterval(interval);
        return;
      }
      const completed = await pollTaskStatus(taskId);
      if (completed) {
        clearInterval(interval);
      }
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId, isGenerating, pollTaskStatus]);

  const handleGenerate = async () => {
    console.log('=== Generate Debug Info ===');
    console.log('availableProviders:', availableProviders);
    console.log('current provider:', provider);
    console.log('current model:', model);
    console.log('remainingCredits:', remainingCredits);
    console.log('costCredits:', costCredits);

    // Check AI providers FIRST - highest priority
    if (availableProviders.length === 0) {
      console.log('No AI providers configured - showing error');
      toast.error(t('errors.no_providers_configured'));
      return;
    }

    // Check if current provider is in available providers
    if (!availableProviders.includes(provider)) {
      console.log(
        'Current provider not in available providers - showing error'
      );
      toast.error(t('errors.no_providers_configured'));
      return;
    }

    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    if (qualityStyle === 'ultra' && !hasActiveSubscription) {
      setShowPricingDialog(true);
      return;
    }

    if (remainingCredits < costCredits) {
      toast.error('Insufficient credits. Please top up to keep creating.');
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error(t('errors.no_prompt'));
      return;
    }

    if (!provider || !model) {
      toast.error(t('errors.no_provider_or_model'));
      return;
    }

    if (!isTextToImageMode && referenceImageUrls.length === 0) {
      toast.error(t('errors.no_reference_image'));
      return;
    }

    setIsGenerating(true);
    setProgress(15);
    setTaskStatus(AITaskStatus.PENDING);
    setGeneratedImages([]);
    setGenerationStartTime(Date.now());

    try {
      const options: any = {};

      if (hasReferenceImages) {
        options.image_input = referenceImageUrls;
      }

      options.quality_style = qualityStyle;
      options.output_count = outputCountStyle;

      // 添加宽高比参数
      if (aspectRatio) {
        options.aspect_ratio = aspectRatio;
      }

      // 添加分辨率参数
      if (resolution) {
        options.resolution = resolution;
      }

      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: AIMediaType.IMAGE,
          scene: hasReferenceImages ? 'image-to-image' : 'text-to-image',
          provider,
          model,
          prompt: trimmedPrompt,
          options,
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        if (message === 'NSFW_PROMPT_BLOCKED') {
          toast.error(t('errors.prompt_blocked'));
          resetTaskState();
          return;
        }

        if (
          message === 'NSFW_MODERATION_CONFIG_MISSING' ||
          message === 'NSFW_MODERATION_FAILED'
        ) {
          toast.error(t('errors.moderation_unavailable'));
          resetTaskState();
          return;
        }

        throw new Error(message || 'Failed to create an image task');
      }

      const newTaskId = data?.id;
      if (!newTaskId) {
        throw new Error('Task id missing in response');
      }

      if (data.status === AITaskStatus.SUCCESS && data.taskInfo) {
        const parsedResult = parseTaskResult(data.taskInfo);
        const imageUrls = extractImageUrls(parsedResult);

        if (imageUrls.length > 0) {
          const images = imageUrls.map((url, index) => ({
            id: `${newTaskId}-${index}`,
            url,
            provider,
            model,
            prompt: trimmedPrompt,
          }));
          setGeneratedImages(images);
          setProgress(100);
          resetTaskState();
          await fetchUserCredits();

          if (
            canSaveShowcase &&
            images.length > 0 &&
            !savedTaskIdsRef.current.has(newTaskId)
          ) {
            await saveShowcase(images[0].url, newTaskId, trimmedPrompt);
          }
          toast.success(t('success.generated_successfully'));
          return;
        }
      }
      setTaskId(newTaskId);
      setProgress(25);

      await fetchUserCredits();
    } catch (error: any) {
      console.error('Failed to generate image:', error);
      toast.error(`Failed to generate image: ${error.message}`);
      resetTaskState();
    }
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    if (!image.url) {
      return;
    }

    try {
      setDownloadingImageId(image.id);
      // fetch image via proxy
      const resp = await fetch(
        `/api/proxy/file?url=${encodeURIComponent(image.url)}`
      );
      if (!resp.ok) {
        throw new Error(t('errors.download_fetch_failed'));
      }

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
      toast.success(t('success.downloaded'));
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error(t('errors.download_failed'));
    } finally {
      setDownloadingImageId(null);
    }
  };

  return (
    <section className={cn('py-0', className)}>
      <div className="container">
        <div className="mx-auto max-w-6xl">
          {srOnlyTitle && <h2 className="sr-only">{srOnlyTitle}</h2>}
          <div className="landing-panel overflow-hidden rounded-[24px] border">
            <div className="landing-panel-inner overflow-hidden rounded-[23px]">
              <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_1.08fr]">
                <div className="landing-divider-soft border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="landing-title text-[18px] font-semibold tracking-[-0.03em] sm:text-[20px]">
                            {t('form.prompt')}
                            <span className="landing-muted ml-1 text-[12px] font-normal">
                              ({promptNote})
                            </span>
                          </div>
                          <p className="landing-body mt-1 text-[12px] leading-5">
                            {t('form.prompt_placeholder')}
                          </p>
                        </div>
                      </div>

                      <Textarea
                        id="image-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('form.prompt_placeholder')}
                        className="landing-input-surface landing-generator-accent-border-hover mt-3 min-h-[124px] rounded-[16px] px-4 py-4 text-[13px] leading-6 shadow-none placeholder:text-[var(--landing-input-placeholder)] focus-visible:ring-0"
                      />

                      <div className="landing-muted flex items-center justify-between text-xs">
                        <span>
                          {isPromptTooLong ? t('form.prompt_too_long') : ' '}
                        </span>
                        <span>
                          {promptLength} / {MAX_PROMPT_LENGTH}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="landing-title text-[18px] font-semibold tracking-[-0.03em] sm:text-[20px]">
                        {t('form.reference_image')}
                        <span className="landing-muted ml-1 text-[12px] font-normal">
                          ({optionalLabel})
                        </span>
                      </div>
                      <p className="landing-body text-[12px] leading-5">
                        {t('form.reference_image_placeholder')}
                      </p>
                      <ImageUploader
                        title=""
                        allowMultiple={allowMultipleImages}
                        maxImages={allowMultipleImages ? maxImages : 1}
                        maxSizeMB={maxSizeMB}
                        onChange={handleReferenceImagesChange}
                        emptyHint={t('form.reference_image_hint')}
                        compactMetaHint={t('form.reference_image_format', {
                          maxImages: allowMultipleImages ? maxImages : 1,
                          maxSizeMB,
                        })}
                        compact
                      />

                      {hasReferenceUploadError && (
                        <p className="text-xs text-[#ef4444]">
                          {t('form.some_images_failed_to_upload')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="landing-title flex items-center gap-2 text-[18px] font-semibold tracking-[-0.03em] sm:text-[20px]">
                        <Settings2 className="landing-soft-text h-5 w-5" />
                        <span>{t('settings.title')}</span>
                      </div>

                      <div className="space-y-4">
                        {/*
                        <div className="grid gap-3 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                          <Label className="landing-soft-text text-[13px] font-medium">
                            {t('form.output_number')}
                          </Label>
                          <div className="grid grid-cols-4 gap-2">
                            {OUTPUT_COUNT_OPTIONS.map((option) => {
                              const active = outputCountStyle === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => setOutputCountStyle(option)}
                                  className={cn(
                                    'landing-generator-accent-border-hover flex h-9 items-center justify-center rounded-xl border text-[13px] font-medium transition-colors',
                                    active
                                      ? 'landing-generator-selected'
                                      : 'landing-generator-secondary'
                                  )}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        */}

                        <div className="grid gap-3 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                          <Label className="landing-soft-text text-[13px] font-medium">
                            {t('form.quality')}
                          </Label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {QUALITY_OPTIONS.map((option) => {
                              const active = qualityStyle === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    handleQualitySelect(
                                      option.value,
                                      option.badge
                                    )
                                  }
                                  className={cn(
                                    'landing-generator-accent-border-hover flex h-10 items-center justify-center gap-1 rounded-xl border px-3 text-[13px] font-medium transition-colors',
                                    active
                                      ? 'landing-generator-selected'
                                      : 'landing-generator-secondary'
                                  )}
                                >
                                  <span>{t(option.labelKey)}</span>
                                  {option.badge === '4K' &&
                                    !hasActiveSubscription && (
                                      <Lock className="h-3.5 w-3.5 text-[#ff9b21]" />
                                    )}
                                  <span
                                    className={cn(
                                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                      option.value === 'ultra'
                                        ? 'bg-[#fff3e4] text-[#ff9b21]'
                                        : active
                                          ? 'landing-generator-selected-badge'
                                          : 'bg-[#edf2ff] text-[#7a86a7]'
                                    )}
                                  >
                                    {option.badge}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                          <Label className="landing-soft-text text-[13px] font-medium">
                            {t('form.aspect_ratio')}
                          </Label>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                            {['1:1', '2:3', '3:2', '9:16', '16:9'].map(
                              (option) => {
                                const active = aspectRatio === option;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => setAspectRatio(option)}
                                    className={cn(
                                      'landing-generator-accent-border-hover flex h-9 items-center justify-center rounded-xl border text-[13px] font-medium transition-colors',
                                      active
                                        ? 'landing-generator-selected'
                                        : 'landing-generator-secondary'
                                    )}
                                  >
                                    {option}
                                  </button>
                                );
                              }
                            )}
                          </div>
                        </div>

                        <div className="hidden">
                          <Select
                            value={provider}
                            onValueChange={handleProviderChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t('form.select_provider')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDER_OPTIONS.filter((option) =>
                                availableProviders.includes(option.value)
                              ).map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select value={model} onValueChange={setModel}>
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t('form.select_model')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {MODEL_OPTIONS.filter(
                                (option) =>
                                  option.provider === provider &&
                                  option.scenes.includes(activeTab) &&
                                  availableProviders.includes(option.provider)
                              ).map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {!isMounted ? (
                        <Button
                          className="h-12 w-full rounded-[14px] bg-[linear-gradient(90deg,#b897f8_0%,#f0a0ea_52%,#ffca76_100%)] text-[15px] font-semibold text-white shadow-none hover:opacity-95"
                          disabled
                        >
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('loading')}
                        </Button>
                      ) : isCheckSign ? (
                        <Button
                          className="h-12 w-full rounded-[14px] bg-[linear-gradient(90deg,#b897f8_0%,#f0a0ea_52%,#ffca76_100%)] text-[15px] font-semibold text-white shadow-none hover:opacity-95"
                          disabled
                        >
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('checking_account')}
                        </Button>
                      ) : user ? (
                        <Button
                          className="h-12 w-full rounded-[14px] bg-[linear-gradient(90deg,#b897f8_0%,#f0a0ea_52%,#ffca76_100%)] text-[15px] font-semibold text-white shadow-none hover:opacity-95"
                          onClick={handleGenerate}
                          disabled={
                            isGenerating ||
                            isLoadingCredits ||
                            isLoadingProviders ||
                            !prompt.trim() ||
                            isPromptTooLong ||
                            isReferenceUploading ||
                            hasReferenceUploadError ||
                            (!isLoadingCredits &&
                              remainingCredits < costCredits)
                          }
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t('generating')}
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              {t('generate')}
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          className="h-12 w-full rounded-[14px] bg-[linear-gradient(90deg,#b897f8_0%,#f0a0ea_52%,#ffca76_100%)] text-[15px] font-semibold text-white shadow-none hover:opacity-95"
                          onClick={() => setIsShowSignModal(true)}
                        >
                          <User className="mr-2 h-4 w-4" />
                          {t('sign_in_to_generate')}
                        </Button>
                      )}

                      <div className="landing-muted text-center text-[11px]">
                        <span className="mr-1 text-[#f1b759]">💡</span>
                        {t('tip_message')}
                      </div>

                      {!isMounted || isLoadingCredits || isLoadingProviders ? (
                        <div className="landing-soft-text flex items-center justify-between text-[13px]">
                          <span>
                            {t('credits_cost', { credits: costCredits })}
                          </span>
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('credits_remaining', { credits: 0 })}
                          </span>
                        </div>
                      ) : user && remainingCredits > 0 ? (
                      <div className="landing-soft-text flex items-center justify-between text-[13px]">
                          <span>
                            {t('credits_cost', { credits: costCredits })}
                          </span>
                          <span>
                            {t('credits_remaining', {
                              credits: remainingCredits,
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="landing-soft-text flex items-center justify-between text-[13px]">
                            <span>
                              {t('credits_cost', { credits: costCredits })}
                            </span>
                            <span>
                              {t('credits_remaining', {
                                credits: remainingCredits,
                              })}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            className="landing-input-surface h-11 w-full rounded-[14px] text-[14px] hover:opacity-90"
                            onClick={() => setShowPricingDialog(true)}
                          >
                            <CreditCard className="mr-2 h-4 w-4" />
                            {t('buy_credits')}
                          </Button>
                        </div>
                      )}

                      {isGenerating && (
                        <div className="landing-generator-preview rounded-[16px] border p-4">
                          <div className="landing-soft-text mb-2 flex items-center justify-between text-[13px]">
                            <span>{t('progress')}</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} />
                          {taskStatusLabel && (
                            <p className="mt-2 text-center text-[11px] text-[#8f96a3]">
                              {taskStatusLabel}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex h-full min-h-0 self-stretch p-5 sm:p-6">
                  <div className="flex h-full min-h-0 w-full flex-col">
                    <div className="space-y-2">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {generatedImages.length > 0 ? (
                              <Sparkles className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Wand className="h-4 w-4 text-[#d44dff]" />
                            )}
                            <div className="landing-title text-[18px] font-semibold tracking-[-0.03em] sm:text-[20px]">
                              {generatedImages.length > 0
                                ? t('result.ready')
                                : t('featured.title')}
                            </div>
                          </div>
                          {generatedImages.length === 0 ? (
                            <p className="landing-body mt-1 text-[12px] leading-5">
                              {t('featured.description')}
                            </p>
                          ) : null}
                        </div>
                        {generatedImages.length === 0 ? (
                          <Link
                            href="/showcases"
                            className="hidden self-start pt-1 text-[12px] font-semibold text-[#d570ff] md:inline-flex"
                          >
                            {t('featured.more_examples')} →
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[18px]">
                      {generatedImages.length > 0 ? (
                        <div className="flex h-full min-h-[420px] w-full flex-col overflow-hidden rounded-[22px] border-2 border-emerald-400 bg-white p-4 shadow-[0_18px_50px_rgba(16,185,129,0.14)] dark:bg-white">
                          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-white">
                            <img
                              src={generatedImages[0].url}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl saturate-110"
                            />
                            <div className="absolute inset-0 bg-white/35" />
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
                              <img
                                src={generatedImages[0].url}
                                alt={generatedImages[0].prompt || 'Generated image'}
                                className="block h-full max-h-full w-full max-w-full object-contain"
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex shrink-0 items-center justify-center gap-3">
                            <Button
                              size="sm"
                              className="h-9 rounded-full bg-[#0874e8] px-6 text-white shadow-[0_8px_24px_rgba(8,116,232,0.28)] hover:bg-[#0767cf]"
                              onClick={() => handleDownloadImage(generatedImages[0])}
                              disabled={downloadingImageId === generatedImages[0].id}
                            >
                              {downloadingImageId === generatedImages[0].id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="mr-2 h-4 w-4" />
                              )}
                              {t('result.download')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-full border-slate-200 bg-white px-6 text-slate-900 shadow-none hover:bg-slate-50"
                              onClick={handleGenerate}
                              disabled={isGenerating}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {t('result.retry')}
                            </Button>
                          </div>
                        </div>
                      ) : activeFeaturedItem ? (
                        <div className="flex h-full w-full flex-col">
                          <div
                            role="button"
                            tabIndex={0}
                            className="group relative min-h-[320px] flex-1 cursor-zoom-in overflow-hidden rounded-[22px] border border-slate-200 bg-white text-left dark:border-white/10 dark:bg-white"
                            onClick={() => setSelectedShowcaseIndex(activeFeaturedIndex)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedShowcaseIndex(activeFeaturedIndex);
                              }
                            }}
                          >
                            <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
                              <img
                                src={activeFeaturedItem.image}
                                alt=""
                                aria-hidden="true"
                                className="h-full w-full scale-110 object-cover opacity-55 blur-2xl saturate-115"
                              />
                              <div className="absolute inset-0 bg-white/18 dark:bg-white/6" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
                              <img
                                src={activeFeaturedItem.image}
                                alt={activeFeaturedItem.title}
                                className="block h-full max-h-full w-full max-w-full object-contain"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-transparent" />
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                              <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/22 text-white/92 opacity-0 backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:bg-black/34"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviousFeatured();
                                }}
                              >
                                <ChevronLeft className="size-5" />
                              </button>
                            </div>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                              <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/22 text-white/92 opacity-0 backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:bg-black/34"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNextFeatured();
                                }}
                              >
                                <ChevronRight className="size-5" />
                              </button>
                            </div>
                            <div className="absolute right-3 bottom-3 rounded-full border border-white/28 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                              {activeFeaturedIndex + 1}/{featuredShowcases.length}
                            </div>
                            <div className="absolute right-0 bottom-0 left-0 p-4 sm:p-5">
                              <div className="max-w-[78%]">
                                <p className="line-clamp-2 text-[15px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.28)] sm:text-[17px]">
                                  {activeFeaturedItem.title}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid shrink-0 grid-cols-4 gap-2.5">
                            {visibleFeaturedShowcases.map((item) => {
                              const index = featuredShowcases.findIndex(
                                (showcase) => showcase.id === item.id
                              );
                              const isActive = index === activeFeaturedIndex;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="space-y-1.5 text-left"
                                  onClick={() => {
                                    setActiveFeaturedIndex(index);
                                  }}
                                >
                                  <div
                                    className={cn(
                                      'relative aspect-square overflow-hidden rounded-[14px] border border-transparent bg-white p-0 transition-all dark:bg-white',
                                      isActive
                                        ? 'border-[#1773ea] shadow-[0_0_0_2px_rgba(23,115,234,0.18)]'
                                        : 'hover:border-[#1773ea]'
                                    )}
                                  >
                                    <img
                                      src={item.image}
                                      alt={item.title}
                                      className="h-full w-full rounded-[inherit] object-cover object-top"
                                    />
                                    {isActive ? (
                                      <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1773ea] text-white shadow-[0_6px_18px_rgba(23,115,234,0.35)]">
                                        <Check className="h-3 w-3" />
                                      </div>
                                    ) : null}
                                  </div>
                                  <p className="landing-body line-clamp-1 px-0.5 text-center text-[10px] leading-4 sm:text-[11px]">
                                    {item.title}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[320px] w-full items-center justify-center">
                          <div className="landing-muted text-center">
                            <ImageIcon className="mx-auto mb-3 h-8 w-8" />
                            <p>{t('no_images_generated')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent
          className="!w-[calc(100vw-32px)] !max-w-none max-h-[calc(100svh-32px)] overflow-hidden rounded-[26px] p-0 sm:!w-[min(calc(100vw-2rem),1180px)] sm:overflow-visible sm:rounded-2xl sm:p-5 sm:pt-0"
          overlayClassName="bg-black/25 backdrop-blur-sm"
        >
          <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-5 pt-4 pb-3 text-left backdrop-blur sm:static sm:border-b-0 sm:bg-transparent sm:px-0 sm:pb-0">
            <DialogTitle className="text-xl font-bold">
              {t('pricing_dialog_title')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {pricingConfig.description}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(100svh-92px)] overflow-y-auto px-4 pb-4 pt-3 sm:max-h-none sm:overflow-visible sm:px-0 sm:pb-0 sm:pt-0">
            <PricingBlock
              pricing={pricingConfig}
              className="pt-0 sm:pt-2"
              hideHeader
              compact
            />
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {selectedShowcaseIndex !== null && selectedShowcaseItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md md:p-8"
            onClick={() => setSelectedShowcaseIndex(null)}
          >
            <button
              className="absolute top-4 right-4 z-50 rounded-full bg-black/10 p-1 text-white/70 transition-colors hover:bg-black/20 hover:text-white dark:bg-white/10 dark:hover:bg-white/20"
              onClick={() => setSelectedShowcaseIndex(null)}
            >
              <X className="size-8" />
            </button>

            <button
              className="absolute top-1/2 left-4 z-50 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-500 shadow-lg transition-colors hover:bg-white hover:text-[#1773ea] dark:bg-[#111827]/85 dark:text-slate-300 dark:hover:bg-[#111827] dark:hover:text-sky-300"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShowcaseIndex((prev) =>
                  prev !== null
                    ? prev === 0
                      ? featuredShowcases.length - 1
                      : prev - 1
                    : null
                );
              }}
            >
              <ChevronLeft className="size-8 md:size-12" />
            </button>

            <button
              className="absolute top-1/2 right-4 z-50 -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-500 shadow-lg transition-colors hover:bg-white hover:text-[#1773ea] dark:bg-[#111827]/85 dark:text-slate-300 dark:hover:bg-[#111827] dark:hover:text-sky-300"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShowcaseIndex((prev) =>
                  prev !== null
                    ? prev === featuredShowcases.length - 1
                      ? 0
                      : prev + 1
                    : null
                );
              }}
            >
              <ChevronRight className="size-8 md:size-12" />
            </button>

            <motion.div
              key={selectedShowcaseItem.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-full w-full items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid h-[min(88vh,860px)] w-full max-w-[1440px] overflow-hidden rounded-[28px] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.26)] md:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.78fr)] dark:bg-[#0f172a]">
                <div className="relative h-full min-h-[320px] overflow-hidden bg-white dark:bg-white">
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={selectedShowcaseItem.image}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full scale-110 object-cover opacity-55 blur-2xl saturate-115"
                    />
                    <div className="absolute inset-0 bg-white/18 dark:bg-white/6" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={selectedShowcaseItem.image}
                      alt={selectedShowcaseItem.title}
                      className="block h-full max-h-full w-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-col border-t border-slate-200 bg-white md:border-t-0 md:border-l dark:border-white/10 dark:bg-[#0f172a]">
                  <div className="flex items-start gap-4 px-7 pt-7 pb-5">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                        {selectedShowcaseItem.title}
                      </h3>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
                    {selectedShowcaseItem.prompt ? (
                      <p className="text-[17px] leading-9 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                        {selectedShowcaseItem.prompt}
                      </p>
                    ) : (
                      <div className="text-[15px] text-slate-500 dark:text-slate-400">
                        {t('errors.no_prompt')}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 px-7 py-5 dark:border-white/10">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyShowcasePrompt(selectedShowcaseItem)}
                        disabled={!selectedShowcaseItem.prompt}
                        className="h-13 flex-1 rounded-2xl border-slate-200 bg-white text-base font-medium text-slate-700 hover:border-sky-200 hover:bg-sky-500/10 hover:text-[#1773ea] dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:border-sky-400/20 dark:hover:bg-sky-400/10 dark:hover:text-sky-300"
                      >
                        {copiedShowcaseId === selectedShowcaseItem.id ? (
                          <Check className="size-5" />
                        ) : (
                          <Copy className="size-5" />
                        )}
                        {t('featured.copy_prompt')}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleTryShowcasePrompt}
                        className="h-13 flex-1 rounded-2xl bg-[#1773ea] text-base font-semibold text-white hover:bg-[#1569d5] dark:bg-[#1773ea] dark:text-white dark:hover:bg-[#1569d5]"
                      >
                        <Wand className="size-5" />
                        {t('featured.try_now')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

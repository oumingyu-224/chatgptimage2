'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CreditCard,
  Download,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Settings,
  Sparkles,
  User,
  Upload,
  Wand,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
import {
  ImageUploader,
  ImageUploaderValue,
  LazyImage,
} from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppContext } from '@/shared/contexts/app';
import { formatAITaskErrorMessage } from '@/shared/lib/ai-task-error';
import {
  GEMINI_IMAGE_RESOLUTION_MODELS,
  getImageGenerationCostCredits,
  IMAGE_RESOLUTION_VALUES,
  ImageResolution,
  isFourKAspectRatioSupported,
  supportsImageResolution,
} from '@/shared/lib/image-generation';
import { buildImageGenerateIdempotencyKey } from '@/shared/lib/idempotency';
import { normalizeAITaskImageUrls } from '@/shared/lib/ai-task-media';
import { cn } from '@/shared/lib/utils';
import { ImageGeneratorExamples } from './image-generator-examples';

interface ImageGeneratorProps {
  allowMultipleImages?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  srOnlyTitle?: string;
  className?: string;
  promptKey?: string;
  initialPromptValue?: string;
  initialPreviewImage?: string;
  showProviderModelSelector?: boolean;
  preferResolutionCapableModel?: boolean;
  simpleResolutionHint?: boolean;
  mockGenerate?: boolean;
}

interface GeneratedImage {
  id: string;
  url: string;
  sourceUrl?: string;
  provider?: string;
  model?: string;
  prompt?: string;
}

interface BackendTask {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string | null;
  taskInfo: string | null;
  taskResult: string | null;
}

interface ProviderChannel {
  id: string;
  name: string;
  provider: string;
  model: string;
  priority: number;
}

type ImageGeneratorTab = 'text-to-image' | 'image-to-image';

const POLL_INTERVAL = 5000;
const GENERATION_TIMEOUT = 30 * 60 * 1000;
const MOCK_QUERY_WARMUP_POLLS = 5;
const MAX_PROMPT_LENGTH = 3000;
const buildProxyImageUrl = (url: string) =>
  `/api/proxy/file?url=${encodeURIComponent(url)}`;

const MODEL_OPTIONS = [
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
    label: 'Nano Banana Pro',
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
  {
    value: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview',
    provider: 'custom',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'gemini-3-pro-image-preview-official',
    label: 'Gemini 3 Pro Image Preview Official',
    provider: 'custom',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'custom',
    scenes: ['text-to-image', 'image-to-image'],
  },
];

const ASPECT_RATIO_OPTIONS = [
  'Auto',
  '1:1',
  '16:9',
  '9:16',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '4:3',
  '3:4',
] as const;

const ASPECT_RATIO_PREVIEW_SIZE: Record<string, { width: number; height: number }> =
  {
    Auto: { width: 24, height: 24 },
    '1:1': { width: 33, height: 33 },
    '16:9': { width: 44, height: 25 },
    '9:16': { width: 25, height: 44 },
    '3:2': { width: 42, height: 28 },
    '2:3': { width: 28, height: 42 },
    '5:4': { width: 37, height: 30 },
    '4:5': { width: 30, height: 37 },
    '4:3': { width: 40, height: 30 },
    '3:4': { width: 30, height: 40 },
  };

const IMAGE_RESOLUTION_LABELS: Record<ImageResolution, string> = {
  '1k': '1K',
  '2k': '2K',
  '4k': '4K',
};

function getModelMeta(model: string, provider: string) {
  return MODEL_OPTIONS.find(
    (option) => option.value === model && option.provider === provider
  );
}

function getProviderLabel(provider: string) {
  return (
    {
      kie: 'Kie',
      replicate: 'Replicate',
      fal: 'Fal',
      gemini: 'Gemini',
      custom: 'Custom',
    }[provider] || provider
  );
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
  maxImages = 10,
  maxSizeMB = 5,
  srOnlyTitle,
  className,
  promptKey,
  initialPromptValue = '',
  initialPreviewImage = '',
  showProviderModelSelector = true,
  preferResolutionCapableModel = false,
  simpleResolutionHint = false,
  mockGenerate = false,
}: ImageGeneratorProps) {
  const t = useTranslations('ai.image.generator');

  const [activeTab, setActiveTab] =
    useState<ImageGeneratorTab>('text-to-image');

  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string>('Auto');
  const [resolution, setResolution] = useState<ImageResolution>('1k');
  const [isPublic, setIsPublic] = useState(false);
  const [prompt, setPrompt] = useState(promptKey ? initialPromptValue : '');
  const [previewImage, setPreviewImage] = useState<string>(
    promptKey ? initialPreviewImage : ''
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
  const [loadedGeneratedImageIds, setLoadedGeneratedImageIds] = useState<Set<string>>(
    new Set()
  );
  const [failedGeneratedImageIds, setFailedGeneratedImageIds] = useState<Set<string>>(
    new Set()
  );
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableChannels, setAvailableChannels] = useState<ProviderChannel[]>(
    []
  );
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isGenerateFailedAlertOpen, setIsGenerateFailedAlertOpen] =
    useState(false);
  const [generateFailedAlertMessage, setGenerateFailedAlertMessage] =
    useState('');
  const hasLoadedCreditsRef = useRef(false);
  const pendingGenerateBodyRef = useRef<string | null>(null);
  const hasSentUnloadBeaconRef = useRef(false);
  const pollSessionRef = useRef(0);

  const {
    user,
    userCreditsError,
    isCheckSign,
    setIsShowSignModal,
    fetchUserCredits,
  } = useAppContext();

  useEffect(() => {
    setIsMounted(true);

    fetch('/api/ai/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 0 && data.data?.providers !== undefined) {
          const providers = data.data.providers || [];
          const channels = data.data.channels || [];
          setAvailableProviders(providers);
          setAvailableChannels(channels);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch AI providers:', error);
        setAvailableProviders([]);
        setAvailableChannels([]);
      })
      .finally(() => {
        setIsLoadingProviders(false);
      });
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      if (
        !isGenerating ||
        taskId ||
        !pendingGenerateBodyRef.current ||
        hasSentUnloadBeaconRef.current ||
        typeof navigator.sendBeacon !== 'function'
      ) {
        return;
      }

      const payload = new Blob([pendingGenerateBodyRef.current], {
        type: 'application/json',
      });
      hasSentUnloadBeaconRef.current = navigator.sendBeacon(
        '/api/ai/generate',
        payload
      );
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [isGenerating, taskId]);

  // Track user ID to reset credits loading flag when user changes
  const userIdRef = useRef<string | null>(null);
  const currentUserId = user?.id || null;
  const hasUserCredits = !!user?.credits;

  useEffect(() => {
    // Reset flag when user changes
    if (currentUserId !== userIdRef.current) {
      userIdRef.current = currentUserId;
      hasLoadedCreditsRef.current = false;
    }

    // Only fetch credits once per user session
    if (currentUserId && !hasUserCredits && !hasLoadedCreditsRef.current) {
      hasLoadedCreditsRef.current = true;
      setIsLoadingCredits(true);
      fetchUserCredits().finally(() => {
        setIsLoadingCredits(false);
      });
    }
  }, [currentUserId, hasUserCredits, fetchUserCredits]);

  useEffect(() => {
    if (promptKey) {
      setPrompt(initialPromptValue);
      setPreviewImage(initialPreviewImage);
      setReferenceImageItems([]);
      setReferenceImageUrls([]);
      setActiveTab('image-to-image');
      setResolution('1k');
    } else {
      setPrompt('');
      setPreviewImage('');
      setReferenceImageItems([]);
      setReferenceImageUrls([]);
      setActiveTab('text-to-image');
      setResolution('1k');
    }
  }, [promptKey, initialPromptValue, initialPreviewImage]);

  useEffect(() => {
    setLoadedGeneratedImageIds(new Set());
    setFailedGeneratedImageIds(new Set());
  }, [generatedImages]);

  const promptLength = prompt.trim().length;
  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const isPromptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const isTextToImageMode = activeTab === 'text-to-image';
  const currentScene = isTextToImageMode ? 'text-to-image' : 'image-to-image';

  const sceneChannels = useMemo(
    () =>
      availableChannels.filter((channel) => {
        const meta = getModelMeta(channel.model, channel.provider);
        return meta ? meta.scenes.includes(currentScene) : true;
      }),
    [availableChannels, currentScene]
  );

  const sceneProviders = useMemo(
    () =>
      Array.from(new Set(sceneChannels.map((channel) => channel.provider))),
    [sceneChannels]
  );

  const providerModels = useMemo(
    () => sceneChannels.filter((channel) => channel.provider === provider),
    [sceneChannels, provider]
  );

  const selectedChannel = useMemo(
    () =>
      sceneChannels.find(
        (channel) => channel.provider === provider && channel.model === model
      ),
    [sceneChannels, provider, model]
  );

  const selectedModelMeta = useMemo(
    () => getModelMeta(model, provider),
    [model, provider]
  );
  const supportsResolution = useMemo(
    () => supportsImageResolution(provider, model),
    [model, provider]
  );
  const supportsResolutionForUi =
    !isLoadingProviders && (!selectedChannel || supportsResolution);
  const isGemini3ProModel = useMemo(
    () => GEMINI_IMAGE_RESOLUTION_MODELS.has(model),
    [model]
  );
  const effectiveMaxImages = maxImages;
  const effectiveMaxSizeMB = maxSizeMB;
  const effectiveResolution =
    selectedChannel && !supportsResolution ? '1k' : resolution;
  const costCredits = useMemo(
    () =>
      getImageGenerationCostCredits({
        scene: currentScene,
        resolution: effectiveResolution,
      }),
    [currentScene, effectiveResolution]
  );
  const hasResolvedCredits =
    isMounted &&
    !isCheckSign &&
    !isLoadingProviders &&
    Boolean(user) &&
    Boolean(user?.credits) &&
    !isLoadingCredits &&
    !userCreditsError;
  const isCreditsPending =
    Boolean(user) && !user?.credits && !userCreditsError;
  const hasInsufficientCredits =
    hasResolvedCredits && remainingCredits < costCredits;

  const showGenerateFailedAlert = useCallback((input?: any) => {
    setGenerateFailedAlertMessage(
      formatAITaskErrorMessage({
        input,
        t: (key) => t(`errors.${key}`),
      })
    );
    setIsGenerateFailedAlertOpen(true);
  }, [t]);

  useEffect(() => {
    if (selectedChannel && !supportsResolution) {
      if (resolution !== '1k') {
        setResolution('1k');
      }
      return;
    }
  }, [resolution, selectedChannel, supportsResolution]);

  useEffect(() => {
    if (sceneChannels.length === 0) {
      setProvider('');
      setModel('');
      return;
    }
    const preferredChannel = preferResolutionCapableModel
      ? sceneChannels.find((channel) =>
          supportsImageResolution(channel.provider, channel.model)
        )
      : undefined;
    const fallbackChannel = preferredChannel || sceneChannels[0];

    if (
      !provider ||
      !sceneProviders.includes(provider) ||
      !model ||
      !sceneChannels.some(
        (channel) => channel.provider === provider && channel.model === model
      )
    ) {
      setProvider(fallbackChannel.provider);
      setModel(fallbackChannel.model);
      return;
    }

    if (
      preferResolutionCapableModel &&
      preferredChannel &&
      !supportsImageResolution(provider, model)
    ) {
      setProvider(preferredChannel.provider);
      setModel(preferredChannel.model);
      return;
    }

    const providerChannelModels = sceneChannels.filter(
      (channel) => channel.provider === provider
    );

    if (providerChannelModels.length === 0) {
      setModel('');
      return;
    }

    if (!providerChannelModels.some((channel) => channel.model === model)) {
      setModel(providerChannelModels[0].model);
    }
  }, [sceneProviders, sceneChannels, provider, model, preferResolutionCapableModel]);

  const handleTabChange = (value: string) => {
    const tab = value as ImageGeneratorTab;
    setActiveTab(tab);
  };

  const switchToImageToImage = useCallback(() => {
    setActiveTab('image-to-image');
  }, []);

  const handleProviderChange = (value: string) => {
    setProvider(value);
  };

  const handleResolutionChange = (value: ImageResolution) => {
    if (!supportsResolutionForUi) {
      return;
    }

    setResolution(value);

    if (isGemini3ProModel) {
      return;
    }

    if (value === '4k') {
      if (!isFourKAspectRatioSupported(aspectRatio)) {
        setAspectRatio('16:9');
      }
      return;
    }

    if (aspectRatio === '16:9' || aspectRatio === '9:16') {
      return;
    }

    setAspectRatio('Auto');
  };

  const taskStatusLabel = useMemo(() => {
    if (!taskStatus) {
      return '';
    }

    switch (taskStatus) {
      case AITaskStatus.QUEUED:
      case AITaskStatus.PENDING:
        return t('status.pending');
      case AITaskStatus.PROCESSING:
        return t('status.processing');
      case AITaskStatus.SUCCESS:
        return t('status.success');
      case AITaskStatus.FAILED:
        return t('status.failed');
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
    pollSessionRef.current += 1;
    setIsGenerating(false);
    setProgress(0);
    setTaskId(null);
    setGenerationStartTime(null);
    setTaskStatus(null);
  }, []);

  const finishSuccessfulGeneration = useCallback(async () => {
    setProgress(100);
    await new Promise((resolve) => setTimeout(resolve, 350));
    resetTaskState();
  }, [resetTaskState]);

  useEffect(() => {
    if (!isGenerating || !generationStartTime) {
      return;
    }

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (taskStatus === AITaskStatus.QUEUED || taskStatus === AITaskStatus.PENDING) {
          const elapsed = Date.now() - generationStartTime;
          const target = Math.min(35, 18 + Math.floor(elapsed / 4000) * 2);
          return Math.max(prev, target);
        }

        if (taskStatus === AITaskStatus.PROCESSING) {
          const elapsed = Date.now() - generationStartTime;
          const target = Math.min(92, 40 + Math.floor(elapsed / 3500) * 3);
          return Math.max(prev, target);
        }

        return prev;
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [generationStartTime, isGenerating, taskStatus]);

  const pollTaskStatus = useCallback(
    async (id: string, pollSession: number) => {
      try {
        if (pollSession !== pollSessionRef.current) {
          return true;
        }

        if (
          generationStartTime &&
          Date.now() - generationStartTime > GENERATION_TIMEOUT
        ) {
          resetTaskState();
          toast.error(t('errors.timeout'));
          return true;
        }

        const resp = await fetch('/api/ai/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: id }),
        });

        if (pollSession !== pollSessionRef.current) {
          return true;
        }

        if (!resp.ok) {
          throw new Error(`request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (pollSession !== pollSessionRef.current) {
          return true;
        }
        if (code !== 0) {
          throw new Error(message || t('errors.query_failed'));
        }

        const task = data as BackendTask;
        const currentStatus = task.status as AITaskStatus;
        setTaskStatus(currentStatus);

        const parsedResult = parseTaskResult(task.taskInfo);
        const imageUrls = normalizeAITaskImageUrls(
          task,
          extractImageUrls(parsedResult)
        );

        if (
          currentStatus === AITaskStatus.QUEUED ||
          currentStatus === AITaskStatus.PENDING
        ) {
          setProgress((prev) => Math.max(prev, 18));
          return false;
        }

        if (currentStatus === AITaskStatus.PROCESSING) {
          setProgress((prev) => Math.max(prev, 42));
          if (imageUrls.length > 0) {
            setGeneratedImages(
              imageUrls.map((url, index) => ({
                id: `${task.id}-${index}`,
                url: buildProxyImageUrl(url),
                sourceUrl: url,
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
            toast.error(t('errors.no_images_returned'));
          } else {
            const images = imageUrls.map((url, index) => ({
              id: `${task.id}-${index}`,
              url: buildProxyImageUrl(url),
              sourceUrl: url,
              provider: task.provider,
              model: task.model,
              prompt: task.prompt ?? undefined,
            }));
            setGeneratedImages(images);
            toast.success(t('messages.generated_success'));
          }

          await finishSuccessfulGeneration();
          return true;
        }

        if (currentStatus === AITaskStatus.FAILED) {
          showGenerateFailedAlert(parsedResult);
          resetTaskState();

          fetchUserCredits();

          return true;
        }

        setProgress((prev) => Math.min(prev + 5, 95));
        return false;
      } catch (error: any) {
        if (pollSession !== pollSessionRef.current) {
          return true;
        }
        console.error('Error polling image task:', error);
        showGenerateFailedAlert(error?.message);
        resetTaskState();

        fetchUserCredits();

        return true;
      }
    },
    [
      fetchUserCredits,
      finishSuccessfulGeneration,
      generationStartTime,
      resetTaskState,
      showGenerateFailedAlert,
      t,
    ]
  );

  const warmupMockTaskPolling = useCallback(
    async (id: string, pollSession: number) => {
      for (let index = 0; index < MOCK_QUERY_WARMUP_POLLS; index += 1) {
        if (pollSession !== pollSessionRef.current) {
          return true;
        }

        const completed = await pollTaskStatus(id, pollSession);
        if (completed) {
          return true;
        }

        if (index < MOCK_QUERY_WARMUP_POLLS - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, POLL_INTERVAL)
          );
        }
      }

      return false;
    },
    [pollTaskStatus]
  );

  useEffect(() => {
    if (!taskId || !isGenerating) {
      return;
    }

    let cancelled = false;
    const currentPollSession = pollSessionRef.current;
    let timeoutId: number | null = null;

    const tick = async () => {
      if (!taskId || cancelled) {
        return;
      }
      const completed = await pollTaskStatus(taskId, currentPollSession);
      if (
        cancelled ||
        currentPollSession !== pollSessionRef.current ||
        completed
      ) {
        return;
      }

      timeoutId = window.setTimeout(tick, POLL_INTERVAL);
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [taskId, isGenerating, pollTaskStatus]);

  const handleGenerate = async () => {
    if (availableProviders.length === 0) {
      toast.error(t('errors.no_models_configured'));
      return;
    }

    if (!selectedChannel) {
      toast.error(t('errors.no_models_configured'));
      return;
    }

    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    if (isLoadingCredits || !user.credits) {
      return;
    }

    if (remainingCredits < costCredits) {
      toast.error(t('errors.insufficient_credits'));
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error(t('errors.prompt_required'));
      return;
    }

    if (!provider || !model) {
      toast.error(t('errors.invalid_model_config'));
      return;
    }

    if (!isTextToImageMode && referenceImageUrls.length === 0) {
      toast.error(t('errors.reference_image_required'));
      return;
    }

    pollSessionRef.current += 1;
    setIsGenerating(true);
    setProgress(15);
    setTaskStatus(AITaskStatus.PENDING);
    setGeneratedImages([]);
    setGenerationStartTime(Date.now());

    try {
      const options: any = {};

      if (!isTextToImageMode) {
        options.image_input = referenceImageUrls.slice(0, effectiveMaxImages);
      }
      if (aspectRatio && aspectRatio !== 'Auto') {
        options.aspect_ratio = aspectRatio;
      }
      if (supportsResolution) {
        options.resolution = effectiveResolution;
      }
      if (mockGenerate) {
        options.mock_generation = true;
      }
      options.__saveShowcase = true;
      options.__showcaseTags = promptKey || null;
      options.__showcaseIsPublic = isPublic;
      options.output_format = 'png';
      const idempotencyKey = buildImageGenerateIdempotencyKey({
        provider: selectedChannel.provider,
        model: selectedChannel.model,
        prompt: trimmedPrompt,
        scene: isTextToImageMode ? 'text-to-image' : 'image-to-image',
        options,
      });

      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: (() => {
          const body = JSON.stringify({
            mediaType: AIMediaType.IMAGE,
            scene: isTextToImageMode ? 'text-to-image' : 'image-to-image',
            provider: selectedChannel.provider,
            model: selectedChannel.model,
            prompt: trimmedPrompt,
            options,
            idempotencyKey,
          });
          pendingGenerateBodyRef.current = body;
          hasSentUnloadBeaconRef.current = false;
          return body;
        })(),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || t('errors.create_task_failed'));
      }

      const newTaskId = data?.id;
      if (!newTaskId) {
        throw new Error(t('errors.task_id_missing'));
      }

      pendingGenerateBodyRef.current = null;

      if (data.status === AITaskStatus.SUCCESS && data.taskInfo) {
        const parsedResult = parseTaskResult(data.taskInfo);
        const imageUrls = normalizeAITaskImageUrls(
          {
            provider: selectedChannel.provider,
            model: selectedChannel.model,
          },
          extractImageUrls(parsedResult)
        );

        if (imageUrls.length > 0) {
          const images = imageUrls.map((url, index) => ({
            id: `${newTaskId}-${index}`,
            url: buildProxyImageUrl(url),
            sourceUrl: url,
            provider: selectedChannel.provider,
            model: selectedChannel.model,
            prompt: trimmedPrompt,
          }));
          setGeneratedImages(images);
          await finishSuccessfulGeneration();
          await fetchUserCredits();
          toast.success(t('messages.generated_success'));
          return;
        }
      }

      if (
        data.status === AITaskStatus.FAILED ||
        data.status === AITaskStatus.CANCELED
      ) {
        const parsedResult = parseTaskResult(data.taskInfo);
        showGenerateFailedAlert(parsedResult);
        resetTaskState();
        await fetchUserCredits();
        return;
      }

      if (mockGenerate) {
        const completed = await warmupMockTaskPolling(
          newTaskId,
          pollSessionRef.current
        );
        if (completed) {
          await fetchUserCredits();
          return;
        }
      }

      setTaskId(newTaskId);
      setProgress((prev) => Math.max(prev, 18));

      await fetchUserCredits();
    } catch (error: any) {
      pendingGenerateBodyRef.current = null;
      console.error('Failed to generate image:', error);
      showGenerateFailedAlert(error?.message);
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
        image.url
      );
      if (!resp.ok) {
        throw new Error('Failed to fetch image');
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
      toast.success(t('messages.downloaded'));
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error(t('errors.download_failed'));
    } finally {
      setDownloadingImageId(null);
    }
  };

  return (
    <section className={cn('py-8', className)}>
      <div className="container">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
            <Card className="border-border/60 bg-background/92 shadow-sm">
              <CardHeader className="space-y-4 pb-4 md:space-y-5">
                {srOnlyTitle && <h2 className="sr-only">{srOnlyTitle}</h2>}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                    <Wand className="h-5 w-5" />
                    {t('title')}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="hidden rounded-full px-3 py-1 text-xs sm:inline-flex"
                  >
                    {isTextToImageMode
                      ? t('tabs.text-to-image')
                      : t('tabs.image-to-image')}
                  </Badge>
                </div>

                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="grid w-full grid-cols-2 bg-muted/70">
                    <TabsTrigger value="text-to-image">
                      {t('tabs.text-to-image')}
                    </TabsTrigger>
                    <TabsTrigger value="image-to-image">
                      {t('tabs.image-to-image')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

              </CardHeader>

              <CardContent className="space-y-5 pb-5 md:space-y-6 md:pb-8">
                {showProviderModelSelector && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="select-text">{t('form.provider')}</Label>
                      <select
                        value={provider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        disabled={sceneProviders.length === 0}
                        className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
                      >
                        {sceneProviders.map((item) => (
                          <option key={item} value={item}>
                            {getProviderLabel(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="select-text">{t('form.model')}</Label>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={providerModels.length === 0}
                        className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm"
                      >
                        {providerModels.map((item) => (
                          <option key={`${item.provider}:${item.model}:${item.id}`} value={item.model}>
                            {getModelMeta(item.model, item.provider)?.label || item.name || item.model}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {!isTextToImageMode && (
                  <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      <Label className="select-text text-sm font-medium">
                        {t('form.reference_image')}
                      </Label>
                    </div>
                    <ImageUploader
                      title=""
                      allowMultiple={allowMultipleImages}
                      maxImages={allowMultipleImages ? effectiveMaxImages : 1}
                      maxSizeMB={effectiveMaxSizeMB}
                      defaultPreviews={[]}
                      onChange={handleReferenceImagesChange}
                      emptyHint={
                        isGemini3ProModel
                          ? t('form.reference_image_placeholder_gemini_3_pro')
                          : t('form.reference_image_placeholder')
                      }
                    />
                    {hasReferenceUploadError && (
                      <p className="text-destructive text-xs">
                        {t('form.some_images_failed_to_upload')}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="image-prompt" className="select-text">
                    {t('form.prompt')}
                  </Label>
                  <Textarea
                    id="image-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('form.prompt_placeholder')}
                    className="min-h-36 resize-none rounded-[1.25rem] border-border/70 bg-background text-base md:min-h-40 md:rounded-2xl"
                  />
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      {promptLength} / {MAX_PROMPT_LENGTH}
                    </span>
                    {isPromptTooLong && (
                      <span className="text-destructive">
                        {t('form.prompt_too_long')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="select-text">{t('form.privacy')}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t('form.privacy_hint')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      aria-pressed={isPublic}
                      onClick={() => setIsPublic(true)}
                      className={cn(
                        'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all sm:flex-none',
                        isPublic
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/15'
                          : 'border-border bg-background text-foreground hover:border-foreground/30'
                      )}
                    >
                      <Eye className="h-4 w-4" />
                      {t('form.public')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={!isPublic}
                      onClick={() => setIsPublic(false)}
                      className={cn(
                        'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all sm:flex-none',
                        !isPublic
                          ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/15'
                          : 'border-border bg-background text-foreground hover:border-foreground/30'
                      )}
                    >
                      <EyeOff className="h-4 w-4" />
                      {t('form.private')}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="select-text">{t('form.aspect_ratio')}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t('form.aspect_ratio_hint')}
                  </p>
                  <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-2.5 md:gap-3">
                      {ASPECT_RATIO_OPTIONS.map((item) => {
                        const preview = ASPECT_RATIO_PREVIEW_SIZE[item];
                        const isActive = aspectRatio === item;
                        const disabled =
                          effectiveResolution === '4k' &&
                          !isGemini3ProModel &&
                          !isFourKAspectRatioSupported(item);

                        return (
                          <button
                            key={item}
                            type="button"
                            disabled={disabled}
                            onClick={() => setAspectRatio(item)}
                            className={cn(
                              'relative overflow-hidden flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-[1rem] border-2 p-2 transition-all md:h-20 md:w-20 md:rounded-xl',
                              isActive
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20'
                                : 'border-border bg-background hover:border-foreground/30',
                              disabled &&
                                'cursor-not-allowed hover:cursor-not-allowed border-dashed border-foreground/10 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(148,163,184,0.10)_8px,rgba(148,163,184,0.10)_16px)] text-muted-foreground/45 opacity-55 shadow-none hover:border-foreground/10 dark:border-white/10 dark:bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(255,255,255,0.04)_8px,rgba(255,255,255,0.04)_16px)] dark:text-white/35'
                            )}
                          >
                            <div className="flex h-12 items-center justify-center">
                              {item === 'Auto' ? (
                                <Settings
                                  className={cn(
                                    'h-6 w-6',
                                    disabled
                                      ? 'text-muted-foreground/45 dark:text-white/35'
                                      : isActive
                                      ? 'text-primary'
                                      : 'text-muted-foreground'
                                  )}
                                />
                              ) : (
                                <div
                                  className={cn(
                                    'rounded',
                                    disabled
                                      ? 'bg-muted-foreground/15 dark:bg-white/10'
                                      : isActive
                                      ? 'bg-primary/80'
                                      : 'bg-muted-foreground/25'
                                  )}
                                  style={{
                                    width: `${preview.width}px`,
                                    height: `${preview.height}px`,
                                  }}
                                />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-xs font-medium',
                                disabled && 'opacity-75'
                              )}
                            >
                              {item}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="select-text">{t('form.resolution')}</Label>
                  <p className="text-muted-foreground text-xs">
                    {simpleResolutionHint
                      ? t('form.resolution_hint_simple')
                      : supportsResolutionForUi
                      ? isGemini3ProModel
                        ? t('form.resolution_hint_gemini_3_pro')
                        : t('form.resolution_hint')
                      : t('form.resolution_model_hint_with_model', {
                          model: selectedModelMeta?.label || model || '-',
                        })}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {IMAGE_RESOLUTION_VALUES.map((item) => {
                      const disabled = !supportsResolutionForUi;
                      const isActive = effectiveResolution === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleResolutionChange(item)}
                          className={cn(
                            'flex min-h-11 min-w-20 items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                            isActive
                              ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/15'
                              : 'border-border bg-background text-foreground hover:border-foreground/30',
                            disabled &&
                              'cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground hover:border-border/60'
                          )}
                        >
                          {IMAGE_RESOLUTION_LABELS[item]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {!isMounted ? (
                  <Button className="h-12 w-full rounded-xl md:h-14" disabled size="lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </Button>
                ) : isCheckSign ? (
                  <Button className="h-12 w-full rounded-xl md:h-14" disabled size="lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('checking_account')}
                  </Button>
                ) : user ? (
                  <div className="space-y-2">
                    <Button
                      size="lg"
                      className="h-12 w-full rounded-xl md:h-14"
                      onClick={handleGenerate}
                      disabled={
                        isGenerating ||
                        isLoadingCredits ||
                        isCreditsPending ||
                        isLoadingProviders ||
                        !!userCreditsError ||
                        !prompt.trim() ||
                        isPromptTooLong ||
                        isReferenceUploading ||
                        hasReferenceUploadError ||
                        !selectedChannel ||
                        hasInsufficientCredits
                      }
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('generating')}
                        </>
                      ) : isLoadingProviders ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('loading')}
                        </>
                      ) : hasInsufficientCredits ? (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          {t('insufficient_credits_action')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t('generate')}
                        </>
                      )}
                    </Button>
                    {isGenerating && (
                      <p className="text-muted-foreground text-center text-xs">
                        {t('messages.view_in_ai_tasks')}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="h-12 w-full rounded-xl md:h-14"
                    onClick={() => setIsShowSignModal(true)}
                  >
                    <User className="mr-2 h-4 w-4" />
                    {t('sign_in_to_generate')}
                  </Button>
                )}

                {!isMounted ||
                isCheckSign ||
                isLoadingProviders ||
                (user && !user.credits) ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('loading')}
                    </span>
                  </div>
                ) : user && isLoadingCredits ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('loading')}
                    </span>
                  </div>
                ) : user && userCreditsError ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span className="text-destructive">
                      {t('errors.credits_load_failed')}
                    </span>
                  </div>
                ) : user && remainingCredits > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span>{t('credits_remaining', { credits: remainingCredits })}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-primary">
                        {t('credits_cost', { credits: costCredits })}
                      </span>
                      <span>{t('credits_remaining', { credits: remainingCredits })}</span>
                    </div>
                    <Link href="/pricing">
                      <Button variant="outline" className="w-full" size="lg">
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t('buy_credits')}
                      </Button>
                    </Link>
                  </div>
                )}

                {isGenerating && (
                  <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 md:rounded-2xl">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('progress')}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                    {taskStatusLabel && (
                      <p className="text-muted-foreground text-xs">
                        {taskStatusLabel}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/92 shadow-sm lg:sticky lg:top-24 lg:self-start">
              <CardHeader className="space-y-3 sm:space-y-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold md:text-xl">
                  <ImageIcon className="h-5 w-5" />
                  {t('generated_images')}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {model && (
                    <Badge variant="outline">
                      {selectedModelMeta?.label || model}
                    </Badge>
                  )}
                  <Badge variant="outline">{aspectRatio}</Badge>
                  <Badge variant="outline">
                    {IMAGE_RESOLUTION_LABELS[effectiveResolution]}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pb-6 sm:space-y-5 sm:pb-8">
                {generatedImages.length > 0 ? (
                  <div
                    className={
                      generatedImages.length === 1
                        ? 'grid grid-cols-1 gap-4 md:gap-5'
                        : 'grid gap-4 sm:grid-cols-2 md:gap-5'
                    }
                  >
                    {generatedImages.map((image) => (
                      <div key={image.id} className="space-y-3">
                        {(() => {
                          const isLoaded = loadedGeneratedImageIds.has(image.id);
                          const isFailed = failedGeneratedImageIds.has(image.id);

                          return (
                        <div
                          className={
                            generatedImages.length === 1
                              ? 'relative min-h-[280px] overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/20 md:min-h-[400px] md:rounded-2xl'
                              : 'relative aspect-square overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/20 md:rounded-2xl'
                          }
                        >
                          {!isLoaded && !isFailed && (
                            <div className="absolute inset-0 z-0">
                              <Skeleton className="absolute inset-0 h-full w-full rounded-2xl border-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_90%,white)_0%,color-mix(in_oklab,var(--color-secondary)_50%,white)_55%,color-mix(in_oklab,var(--color-card)_92%,white)_100%)] dark:bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_86%,black)_0%,color-mix(in_oklab,var(--color-muted)_78%,black)_55%,color-mix(in_oklab,var(--color-card)_90%,black)_100%)] dark:shadow-none" />
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--color-primary)_18%,white)_0%,transparent_58%)] opacity-80 dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06)_0%,transparent_58%)]" />
                              <div className="absolute inset-y-0 -left-1/3 w-1/2 animate-[pulse_1.8s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_20%,rgba(255,255,255,0.55)_50%,rgba(255,255,255,0.08)_80%,transparent_100%)] blur-2xl dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_20%,rgba(255,255,255,0.18)_50%,rgba(255,255,255,0.04)_80%,transparent_100%)] [transform:skewX(-18deg)]" />
                              <div className="absolute inset-0 z-10 flex items-center justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-background/70 shadow-lg backdrop-blur-md dark:border-primary/25 dark:bg-background/40 md:h-20 md:w-20">
                                  <Loader2 className="h-8 w-8 animate-spin text-primary md:h-10 md:w-10" />
                                </div>
                              </div>
                            </div>
                          )}
                          <LazyImage
                            src={image.url}
                            alt={image.prompt || t('alts.generated_image')}
                            className={
                              generatedImages.length === 1
                                ? cn(
                                    'relative z-10 h-full w-full object-contain transition-opacity duration-300',
                                    isLoaded ? 'opacity-100' : 'opacity-0'
                                  )
                                : cn(
                                    'relative z-10 h-full w-full object-cover transition-opacity duration-300',
                                    isLoaded ? 'opacity-100' : 'opacity-0'
                                  )
                            }
                            onError={() =>
                              setFailedGeneratedImageIds((prev) => {
                                const next = new Set(prev);
                                next.add(image.id);
                                return next;
                              })
                            }
                            onLoad={() =>
                              setLoadedGeneratedImageIds((prev) => {
                                const next = new Set(prev);
                                next.add(image.id);
                                return next;
                              })
                            }
                          />
                          {isFailed && (
                            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
                              {t('errors.download_failed')}
                            </div>
                          )}

                          {isLoaded && !isFailed && (
                            <div className="absolute right-3 bottom-3 flex justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadImage(image)}
                              disabled={downloadingImageId === image.id}
                              aria-label={t('actions.download_image')}
                              className="h-9 w-9 rounded-full p-0"
                            >
                              {downloadingImageId === image.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            </div>
                          )}
                        </div>
                          );
                        })()}
                        {image.prompt && (
                          <p className="text-muted-foreground line-clamp-3 break-words text-sm leading-6">
                            {image.prompt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {isGenerating ? (
                      <div className="flex min-h-[280px] flex-col items-center justify-center gap-5 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 text-center md:min-h-[400px] md:gap-6 md:rounded-2xl md:p-6">
                        <div className="aspect-square w-full max-w-[320px] md:max-w-[400px]">
                          <div className="relative h-full w-full overflow-hidden rounded-2xl">
                            <Skeleton className="absolute inset-0 h-full w-full rounded-2xl border-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_90%,white)_0%,color-mix(in_oklab,var(--color-secondary)_50%,white)_55%,color-mix(in_oklab,var(--color-card)_92%,white)_100%)] dark:bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_86%,black)_0%,color-mix(in_oklab,var(--color-muted)_78%,black)_55%,color-mix(in_oklab,var(--color-card)_90%,black)_100%)] dark:shadow-none" />
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_oklab,var(--color-primary)_18%,white)_0%,transparent_58%)] opacity-80 dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06)_0%,transparent_58%)]" />
                            <div className="absolute inset-y-0 -left-1/3 w-1/2 animate-[pulse_1.8s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_20%,rgba(255,255,255,0.55)_50%,rgba(255,255,255,0.08)_80%,transparent_100%)] blur-2xl dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_20%,rgba(255,255,255,0.18)_50%,rgba(255,255,255,0.04)_80%,transparent_100%)] [transform:skewX(-18deg)]" />
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-background/70 shadow-lg backdrop-blur-md dark:border-primary/25 dark:bg-background/40 md:h-20 md:w-20">
                                <Loader2 className="h-8 w-8 animate-spin text-primary md:h-10 md:w-10" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-foreground text-lg font-semibold md:text-xl">
                            {t('generating')}
                          </p>
                          <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-6">
                            {t('messages.view_in_ai_tasks')}
                          </p>
                        </div>
                      </div>
                    ) : promptKey ? (
                      <>
                        <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
                          {previewImage ? (
                            <LazyImage
                              src={previewImage}
                              alt={t('alts.preview_image')}
                              className="h-auto w-full"
                            />
                          ) : (
                            <div className="flex aspect-[4/3] items-center justify-center">
                              <ImageIcon className="text-muted-foreground h-10 w-10" />
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <ImageGeneratorExamples
                        onApplyPrompt={setPrompt}
                        onApply={switchToImageToImage}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Dialog
        open={isGenerateFailedAlertOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsGenerateFailedAlertOpen(true);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t('alerts.generation_failed_title')}</DialogTitle>
            <DialogDescription>
              {generateFailedAlertMessage || t('alerts.generation_failed_message')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setIsGenerateFailedAlertOpen(false)}>
              {t('alerts.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export const IMAGE_RESOLUTION_VALUES = ['1k', '2k', '4k'] as const;

export type ImageResolution = (typeof IMAGE_RESOLUTION_VALUES)[number];

const NANO_BANANA_RESOLUTION_MODELS = new Set([
  'nano-banana-pro',
]);
export const GEMINI_IMAGE_RESOLUTION_MODELS = new Set([
  'gemini-3-pro-image-preview',
  'gemini-3-pro-image-preview-official',
]);
const FOUR_K_ASPECT_RATIOS = new Set([
  '16:9',
  '9:16',
  '2:1',
  '1:2',
  '9:21',
]);

export function normalizeImageResolution(value?: string | null): ImageResolution {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (IMAGE_RESOLUTION_VALUES.includes(normalized as ImageResolution)) {
    return normalized as ImageResolution;
  }

  return '1k';
}

export function supportsImageResolution(
  provider?: string | null,
  model?: string | null
) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedModel = String(model || '').trim().toLowerCase();

  return (
    ((normalizedProvider === 'kie' || normalizedProvider === 'custom') &&
      NANO_BANANA_RESOLUTION_MODELS.has(normalizedModel)) ||
    GEMINI_IMAGE_RESOLUTION_MODELS.has(normalizedModel)
  );
}

export function isFourKAspectRatioSupported(aspectRatio?: string | null) {
  return FOUR_K_ASPECT_RATIOS.has(String(aspectRatio || '').trim());
}

export function getImageGenerationCostCredits({
  scene,
  resolution,
}: {
  scene: string;
  resolution?: string | null;
}) {
  const baseCredits = scene === 'image-to-image' ? 6 : 4;
  const normalizedResolution = normalizeImageResolution(resolution);

  if (normalizedResolution === '2k') {
    return baseCredits * 3;
  }

  if (normalizedResolution === '4k') {
    return baseCredits * 6;
  }

  return baseCredits;
}

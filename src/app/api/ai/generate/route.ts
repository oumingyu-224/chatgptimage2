import { envConfigs } from '@/config';
import { AIMediaType } from '@/extensions/ai';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask, NewAITask } from '@/shared/models/ai_task';
import { getAllConfigs } from '@/shared/models/config';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';
import {
  isPromptModerationEnabled,
  moderatePrompt,
  PROMPT_MODERATION_ERRORS,
} from '@/shared/services/moderation';

function getImageBaseCredits(hasReferenceImages: boolean) {
  return hasReferenceImages ? 6 : 4;
}

function getQualityMultiplier(qualityStyle?: string) {
  if (qualityStyle === 'hd') return 2;
  if (qualityStyle === 'ultra') return 4;
  return 1;
}

function calculateImageCredits(options: any) {
  const hasReferenceImages =
    Array.isArray(options?.image_input) && options.image_input.length > 0;
  const baseCredits = getImageBaseCredits(hasReferenceImages);
  const qualityMultiplier = getQualityMultiplier(options?.quality_style);
  const quantityMultiplier = Math.max(
    1,
    Number.parseInt(options?.output_count || '1', 10) || 1
  );

  return baseCredits * qualityMultiplier * quantityMultiplier;
}

export async function POST(request: Request) {
  try {
    let { provider, mediaType, model, prompt, options, scene } =
      await request.json();

    if (!provider || !mediaType || !model) {
      throw new Error('invalid params');
    }

    if (!prompt && !options) {
      throw new Error('prompt or options is required');
    }

    const aiService = await getAIService();

    // check generate type
    if (!aiService.getMediaTypes().includes(mediaType)) {
      throw new Error('invalid mediaType');
    }

    // check ai provider
    const aiProvider = aiService.getProvider(provider);
    if (!aiProvider) {
      throw new Error('invalid provider');
    }

    // get current user
    const user = await getUserInfo();
    if (!user) {
      throw new Error('no auth, please sign in');
    }

    // todo: get cost credits from settings
    let costCredits = 4;

    if (mediaType === AIMediaType.IMAGE) {
      costCredits = calculateImageCredits(options);
      scene =
        Array.isArray(options?.image_input) && options.image_input.length > 0
          ? 'image-to-image'
          : 'text-to-image';
    } else if (mediaType === AIMediaType.VIDEO) {
      // generate video
      if (scene === 'text-to-video') {
        costCredits = 6;
      } else if (scene === 'image-to-video') {
        costCredits = 8;
      } else if (scene === 'video-to-video') {
        costCredits = 10;
      } else {
        throw new Error('invalid scene');
      }
    } else if (mediaType === AIMediaType.MUSIC) {
      // generate music
      costCredits = 10;
      scene = 'text-to-music';
    } else {
      throw new Error('invalid mediaType');
    }

    const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';

    let promptModerationDebugSuccess = false;

    if (mediaType === AIMediaType.IMAGE && trimmedPrompt) {
      const configs = await getAllConfigs();

      if (isPromptModerationEnabled(configs)) {
        const moderation = await moderatePrompt({
          prompt: trimmedPrompt,
          configs,
        });

        promptModerationDebugSuccess = true;

        if (!moderation.allowed) {
          return respErr(PROMPT_MODERATION_ERRORS.BLOCKED);
        }
      }
    }

    // check credits
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < costCredits) {
      throw new Error('insufficient credits');
    }

    const callbackUrl = `${envConfigs.app_url}/api/ai/notify/${provider}`;

    const params: any = {
      mediaType,
      model,
      prompt,
      callbackUrl,
      options,
    };

    // generate content
    const result = await aiProvider.generate({ params });
    if (!result?.taskId) {
      throw new Error(
        `ai generate failed, mediaType: ${mediaType}, provider: ${provider}, model: ${model}`
      );
    }

    // create ai task
    const newAITask: NewAITask = {
      id: getUuid(),
      userId: user.id,
      mediaType,
      provider,
      model,
      prompt,
      scene,
      options: options ? JSON.stringify(options) : null,
      status: result.taskStatus,
      costCredits,
      taskId: result.taskId,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
    };
    await createAITask(newAITask);

    return respData({
      ...newAITask,
      promptModerationDebugSuccess,
    });
  } catch (e: any) {
    console.log('generate failed', e);
    return respErr(e.message);
  }
}

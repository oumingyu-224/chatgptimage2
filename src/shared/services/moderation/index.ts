import { type Configs } from '@/shared/models/config';

import {
  moderatePromptWithDeepSeek,
  PROMPT_MODERATION_ERRORS,
  type PromptModerationResult,
} from './deepseek';

export { PROMPT_MODERATION_ERRORS };
export type { PromptModerationResult };

export function isPromptModerationEnabled(configs: Configs) {
  return configs.prompt_moderation_enabled === 'true';
}

export async function moderatePrompt({
  prompt,
  configs,
}: {
  prompt: string;
  configs: Configs;
}): Promise<PromptModerationResult> {
  const provider = configs.prompt_moderation_provider || 'deepseek';

  if (provider !== 'deepseek') {
    throw new Error(PROMPT_MODERATION_ERRORS.CONFIG_MISSING);
  }

  return moderatePromptWithDeepSeek({
    prompt,
    apiKey: configs.prompt_moderation_deepseek_api_key || '',
    baseUrl:
      configs.prompt_moderation_deepseek_base_url ||
      'https://api.deepseek.com',
    model: configs.prompt_moderation_deepseek_model || 'deepseek-v4-flash',
  });
}

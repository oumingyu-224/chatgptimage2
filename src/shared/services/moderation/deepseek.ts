export const PROMPT_MODERATION_ERRORS = {
  BLOCKED: 'NSFW_PROMPT_BLOCKED',
  CONFIG_MISSING: 'NSFW_MODERATION_CONFIG_MISSING',
  FAILED: 'NSFW_MODERATION_FAILED',
} as const;

export type PromptModerationResult = {
  allowed: boolean;
  reason?: string;
  categories?: string[];
};

export async function moderatePromptWithDeepSeek({
  prompt,
  apiKey,
  baseUrl = 'https://api.deepseek.com',
  model = 'deepseek-v4-flash',
}: {
  prompt: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}): Promise<PromptModerationResult> {
  if (!apiKey) {
    throw new Error(PROMPT_MODERATION_ERRORS.CONFIG_MISSING);
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            '你是图片生成提示词安全审核器。只判断用户提示词是否允许用于图片生成。请只返回 JSON 对象，不要返回 markdown。JSON 格式：{"allowed":boolean,"reason":string,"categories":string[]}。如果包含色情、裸露、未成年人性化、性暴力、露骨性行为、严重暴力血腥、违法仇恨或其他不适合图片生成的内容，allowed=false；否则 allowed=true。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(PROMPT_MODERATION_ERRORS.FAILED);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error(PROMPT_MODERATION_ERRORS.FAILED);
  }

  try {
    const parsed = JSON.parse(content);
    return {
      allowed: parsed.allowed === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch {
    throw new Error(PROMPT_MODERATION_ERRORS.FAILED);
  }
}

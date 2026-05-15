import {
  AIConfigs,
  AIGenerateParams,
  AIMediaType,
  AIProvider,
  AITaskResult,
  AITaskStatus,
} from './types';

export interface CustomProviderConfigs extends AIConfigs {
  apiKey: string;
  baseUrl: string;
}

export class CustomProvider implements AIProvider {
  readonly name = 'custom';
  configs: CustomProviderConfigs;

  constructor(configs: CustomProviderConfigs) {
    this.configs = configs;
  }

  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    if (params.mediaType !== AIMediaType.IMAGE) {
      throw new Error('custom provider only supports image generation');
    }

    if (!params.model) {
      throw new Error('model is required');
    }

    if (!params.prompt) {
      throw new Error('prompt is required');
    }

    const baseUrl = this.configs.baseUrl.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/images/generations`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.configs.apiKey}`,
    };

    const payload: any = {
      model: params.model,
      prompt: params.prompt,
      n: 1,
    };

    if (params.options?.aspect_ratio) {
      payload.size = params.options.aspect_ratio;
    }

    if (params.options?.resolution) {
      payload.resolution = params.options.resolution;
    }

    if (
      params.options?.image_input &&
      Array.isArray(params.options.image_input) &&
      params.options.image_input.length > 0
    ) {
      payload.image_urls = params.options.image_input.slice(0, 10);
    }

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data?.message || `request failed with status: ${resp.status}`);
    }

    if (data?.code !== 200) {
      throw new Error(data?.message || 'custom generate failed');
    }

    const taskId = data?.data?.[0]?.task_id;
    if (!taskId) {
      throw new Error('custom generate failed: no task_id');
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId,
      taskInfo: data,
      taskResult: data,
    };
  }

  async query({
    taskId,
  }: {
    taskId: string;
  }): Promise<AITaskResult> {
    const baseUrl = this.configs.baseUrl.replace(/\/+$/, '');
    const apiUrl = `${baseUrl}/tasks/${taskId}`;
    const headers = {
      Authorization: `Bearer ${this.configs.apiKey}`,
    };

    const resp = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data?.message || `request failed with status: ${resp.status}`);
    }

    if (data?.code !== 200) {
      throw new Error(data?.message || 'custom query failed');
    }

    const status = data?.data?.status;
    const taskStatus = this.mapStatus(status);
    const imageUrls = this.extractImageUrls(data);

    return {
      taskId,
      taskStatus,
      taskInfo: {
        status,
        errorMessage: data?.data?.error?.message || '',
        output: imageUrls,
      } as any,
      taskResult: data,
    };
  }

  private mapStatus(status: string): AITaskStatus {
    switch (status) {
      case 'pending':
        return AITaskStatus.PENDING;
      case 'processing':
        return AITaskStatus.PROCESSING;
      case 'completed':
        return AITaskStatus.SUCCESS;
      case 'failed':
        return AITaskStatus.FAILED;
      default:
        return AITaskStatus.PENDING;
    }
  }

  private extractImageUrls(data: any): string[] {
    const images = data?.data?.result?.images;
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .flatMap((item: any) => {
        if (Array.isArray(item?.url)) {
          const firstUrl = item.url.find((u: any) => typeof u === 'string');
          return firstUrl ? [firstUrl] : [];
        }
        if (typeof item?.url === 'string') {
          return [item.url];
        }
        return [];
      })
      .filter(Boolean);
  }
}

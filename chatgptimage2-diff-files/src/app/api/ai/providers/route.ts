import { NextRequest, NextResponse } from 'next/server';

import { getAllConfigs } from '@/shared/models/config';
import { getEnabledImageChannels } from '@/shared/services/ai_channels';

export async function GET(request: NextRequest) {
  try {
    const configs = await getAllConfigs();

    const channels = getEnabledImageChannels(configs);
    const providerSet = new Set<string>();
    const availableProviders: string[] = [];
    channels.forEach((channel) => {
      if (!providerSet.has(channel.provider)) {
        providerSet.add(channel.provider);
        availableProviders.push(channel.provider);
      }
    });

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        providers: availableProviders,
        channels: channels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          provider: channel.provider,
          model: channel.model,
          priority: channel.priority,
        })),
      },
    });
  } catch (error: any) {
    console.error('Failed to get AI providers:', error);
    return NextResponse.json(
      {
        code: 1,
        message: error.message || 'Failed to get AI providers',
        data: null,
      },
      { status: 500 }
    );
  }
}

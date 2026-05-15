import { and, eq, gte } from 'drizzle-orm';

import { aiTask } from '@/config/db/schema';
import { db } from '@/core/db';
import { AITaskStatus } from '@/extensions/ai';
import { getAllConfigs } from '@/shared/models/config';
import { getAIProviderRows } from '@/shared/services/ai_channels';

export type AdminAIImageDashboardPeriodKey = 'today' | '7d' | '30d';

export type AdminAIImageDashboardChannelStat = {
  channel: string;
  total: number;
  failed: number;
  attemptFailures: number;
};

export type AdminAIImageDashboardData = {
  periods: Record<
    AdminAIImageDashboardPeriodKey,
    {
      key: AdminAIImageDashboardPeriodKey;
      data: AdminAIImageDashboardChannelStat[];
    }
  >;
};

type AIImageTaskOverviewRow = {
  createdAt: Date | string;
  status: string | null;
  provider: string | null;
  options: string | null;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getPeriodKeys(createdAt: Date, today: Date) {
  const keys: AdminAIImageDashboardPeriodKey[] = [];
  const start7d = addDays(today, -6);
  const start30d = addDays(today, -29);

  if (createdAt >= start30d) {
    keys.push('30d');
  }
  if (createdAt >= start7d) {
    keys.push('7d');
  }
  if (createdAt >= today) {
    keys.push('today');
  }

  return keys;
}

function getOrCreateChannelStat(
  statsMap: Map<string, AdminAIImageDashboardChannelStat>,
  channel: string
) {
  const existing = statsMap.get(channel);
  if (existing) {
    return existing;
  }

  const next = {
    channel,
    total: 0,
    failed: 0,
    attemptFailures: 0,
  };
  statsMap.set(channel, next);
  return next;
}

export async function getAdminAIImageDashboardData(): Promise<AdminAIImageDashboardData> {
  const today = startOfDay(new Date());
  const start30d = addDays(today, -29);
  const [tasks, configs] = await Promise.all([
    db()
      .select({
        createdAt: aiTask.createdAt,
        status: aiTask.status,
        provider: aiTask.provider,
        options: aiTask.options,
      })
      .from(aiTask)
      .where(and(gte(aiTask.createdAt, start30d), eq(aiTask.mediaType, 'image'))),
    getAllConfigs(),
  ]);

  const channelById = new Map(
    getAIProviderRows(configs).map((channel) => [channel.id, channel])
  );
  const periods = {
    today: new Map<string, AdminAIImageDashboardChannelStat>(),
    '7d': new Map<string, AdminAIImageDashboardChannelStat>(),
    '30d': new Map<string, AdminAIImageDashboardChannelStat>(),
  } satisfies Record<
    AdminAIImageDashboardPeriodKey,
    Map<string, AdminAIImageDashboardChannelStat>
  >;

  (tasks as AIImageTaskOverviewRow[]).forEach((item) => {
    const createdAt = item.createdAt instanceof Date
      ? item.createdAt
      : new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return;
    }

    const matchedPeriods = getPeriodKeys(createdAt, today);
    if (!matchedPeriods.length) {
      return;
    }

    let options: Record<string, any> = {};
    try {
      options = item.options ? JSON.parse(item.options) : {};
    } catch {}

    const providerChannelId = String(options?.__providerChannelId || '');
    const providerChannel = providerChannelId
      ? channelById.get(providerChannelId)
      : undefined;
    const currentChannel =
      providerChannel?.name || providerChannel?.id || item.provider || 'unknown';
    const providerAttempts = Array.isArray(options?.__providerAttempts)
      ? options.__providerAttempts
      : [];

    matchedPeriods.forEach((key) => {
      const channelStats = getOrCreateChannelStat(periods[key], currentChannel);
      channelStats.total += 1;
      if (item.status === AITaskStatus.FAILED) {
        channelStats.failed += 1;
      }

      providerAttempts.forEach((attempt: any) => {
        const name = String(attempt?.channelName || attempt?.provider || '');
        if (!name) {
          return;
        }
        const attemptStats = getOrCreateChannelStat(periods[key], name);
        attemptStats.attemptFailures += 1;
      });
    });
  });

  return {
    periods: {
      today: {
        key: 'today',
        data: Array.from(periods.today.values()).sort((a, b) => b.total - a.total).slice(0, 8),
      },
      '7d': {
        key: '7d',
        data: Array.from(periods['7d'].values()).sort((a, b) => b.total - a.total).slice(0, 8),
      },
      '30d': {
        key: '30d',
        data: Array.from(periods['30d'].values()).sort((a, b) => b.total - a.total).slice(0, 8),
      },
    },
  };
}

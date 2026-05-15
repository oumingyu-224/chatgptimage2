'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  AdminAIImageDashboardData,
  AdminAIImageDashboardPeriodKey,
} from '@/shared/services/admin-ai-image-dashboard';
import { AdminDashboardData } from '@/shared/services/admin-dashboard';

import { AITasksOverviewCharts } from '../ai-tasks/ai-tasks-overview-charts';
import { AIImageTrendCharts } from './ai-image-trend-charts';

export function AIImageDashboardClient({
  data,
  trends,
}: {
  data: AdminAIImageDashboardData;
  trends: AdminDashboardData;
}) {
  const t = useTranslations('admin.ai-tasks');
  const [range, setRange] = useState<AdminAIImageDashboardPeriodKey>('7d');
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingRange, setPendingRange] =
    useState<AdminAIImageDashboardPeriodKey | null>(null);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (pendingRange === null) {
      return;
    }

    loadingTimerRef.current = setTimeout(() => {
      setRange(pendingRange);
      setPendingRange(null);
      loadingTimerRef.current = null;
    }, 250);
  }, [pendingRange]);

  return (
    <div className="space-y-6">
      <Tabs
        value={range}
        onValueChange={(value) => {
          const nextRange = value as AdminAIImageDashboardPeriodKey;
          if (nextRange === range || pendingRange) {
            return;
          }

          setPendingRange(nextRange);
        }}
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="today" disabled={pendingRange !== null}>
            <span className="flex items-center gap-2">
              {pendingRange === 'today' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {t('board.ranges.today')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="7d" disabled={pendingRange !== null}>
            <span className="flex items-center gap-2">
              {pendingRange === '7d' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {t('board.ranges.7d')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="30d" disabled={pendingRange !== null}>
            <span className="flex items-center gap-2">
              {pendingRange === '30d' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {t('board.ranges.30d')}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-6">
        {data.periods[range].data.length ? (
          <AITasksOverviewCharts data={data.periods[range].data} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('board.empty.title')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t('board.empty.description')}
            </CardContent>
          </Card>
        )}
        <AIImageTrendCharts data={trends} range={range} />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';

import {
  AdminDashboardData,
  AdminDashboardPeriodKey,
} from '@/shared/services/admin-dashboard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/shared/components/ui/chart';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { AIImageTrendCharts } from './ai-image-dashboard/ai-image-trend-charts';

function formatCurrency(amount: number) {
  return `$${(amount / 100).toFixed(2)}`;
}

function formatAxisLabel(dateKey: string, days: number, t: ReturnType<typeof useTranslations>) {
  if (days === 1) {
    return t('ranges.today');
  }

  const [, month, day] = dateKey.split('-');
  return `${month}-${day}`;
}

export function AdminDashboardClient({
  data,
}: {
  data: AdminDashboardData;
}) {
  const t = useTranslations('admin.dashboard');
  const [range, setRange] = useState<AdminDashboardPeriodKey>('7d');
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingRange, setPendingRange] =
    useState<AdminDashboardPeriodKey | null>(null);
  const period = data.periods[range];
  const days = range === 'today' ? 1 : Number.parseInt(range, 10);
  const showSinglePointDot = period.points.length === 1;

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

  const userChartConfig = {
    users: {
      label: t('charts.users.series'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig;

  const subscriptionChartConfig = {
    subscriptionPayments: {
      label: t('charts.subscriptions.series'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6">
      <Tabs
        value={range}
        onValueChange={(value) => {
          const nextRange = value as AdminDashboardPeriodKey;
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
              {t('ranges.today')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="7d" disabled={pendingRange !== null}>
            <span className="flex items-center gap-2">
              {pendingRange === '7d' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {t('ranges.7d')}
            </span>
          </TabsTrigger>
          <TabsTrigger value="30d" disabled={pendingRange !== null}>
            <span className="flex items-center gap-2">
              {pendingRange === '30d' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {t('ranges.30d')}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardDescription>{t('summary.new_users')}</CardDescription>
            <CardTitle className="text-3xl">{period.summary.users}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardDescription>{t('summary.subscription_payments')}</CardDescription>
            <CardTitle className="text-3xl">
              {period.summary.subscriptionPayments}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            {t('summary.revenue')}: {formatCurrency(period.summary.subscriptionRevenue)}
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardDescription>{t('summary.image_tasks')}</CardDescription>
            <CardTitle className="text-3xl">{period.summary.imageTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="gap-3">
          <CardHeader className="pb-0">
            <CardDescription>{t('summary.image_failures')}</CardDescription>
            <CardTitle className="text-3xl">{period.summary.imageFailed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('charts.users.title')}</CardTitle>
            <CardDescription>{t('charts.users.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="h-[260px] w-full" config={userChartConfig}>
              <LineChart data={period.points.map((point) => ({
                label: formatAxisLabel(point.dateKey, days, t),
                users: point.users,
              }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="var(--color-users)"
                  strokeWidth={2.5}
                  dot={showSinglePointDot ? { r: 4, strokeWidth: 2 } : false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('charts.subscriptions.title')}</CardTitle>
            <CardDescription>{t('charts.subscriptions.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="h-[260px] w-full" config={subscriptionChartConfig}>
              <BarChart data={period.points.map((point) => ({
                label: formatAxisLabel(point.dateKey, days, t),
                subscriptionPayments: point.subscriptionPayments,
              }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="subscriptionPayments"
                  fill="var(--color-subscriptionPayments)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <AIImageTrendCharts data={data} range={range} />
    </div>
  );
}

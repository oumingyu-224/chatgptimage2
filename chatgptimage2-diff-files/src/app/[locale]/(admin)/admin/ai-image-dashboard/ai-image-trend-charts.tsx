'use client';

import { useMemo } from 'react';
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

import { Badge } from '@/shared/components/ui/badge';
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
import {
  AdminDashboardData,
  AdminDashboardPeriodKey,
} from '@/shared/services/admin-dashboard';

const PROVIDER_COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
];

function formatAxisLabel(
  dateKey: string,
  days: number,
  t: ReturnType<typeof useTranslations>
) {
  if (days === 1) {
    return t('ranges.today');
  }

  const [, month, day] = dateKey.split('-');
  return `${month}-${day}`;
}

export function AIImageTrendCharts({
  data,
  range,
}: {
  data: AdminDashboardData;
  range: AdminDashboardPeriodKey;
}) {
  const t = useTranslations('admin.dashboard');
  const period = data.periods[range];
  const days = range === 'today' ? 1 : Number.parseInt(range, 10);
  const showSinglePointDot = period.points.length === 1;

  const taskChartConfig = {
    imageTasks: {
      label: t('charts.tasks.series_total'),
      color: 'var(--chart-1)',
    },
    imageSuccess: {
      label: t('charts.tasks.series_success'),
      color: 'var(--chart-2)',
    },
    imageFailed: {
      label: t('charts.tasks.series_failed'),
      color: 'var(--chart-4)',
    },
  } satisfies ChartConfig;

  const failureChartConfig = useMemo(() => {
    return period.activeProviders.reduce(
      (acc, item, index) => {
        acc[item.provider] = {
          label: item.provider,
          color: PROVIDER_COLORS[index % PROVIDER_COLORS.length],
        };
        return acc;
      },
      {} as ChartConfig
    );
  }, [period.activeProviders]);

  const failureChartData = useMemo(() => {
    return period.points.map((point) => {
      const next: Record<string, string | number> = {
        label: formatAxisLabel(point.dateKey, days, t),
      };

      period.activeProviders.forEach((provider) => {
        next[provider.provider] = point.failureProviders[provider.provider] || 0;
      });

      return next;
    });
  }, [days, period.activeProviders, period.points, t]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('charts.tasks.title')}</CardTitle>
          <CardDescription>{t('charts.tasks.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[260px] w-full" config={taskChartConfig}>
            <LineChart
              data={period.points.map((point) => ({
                label: formatAxisLabel(point.dateKey, days, t),
                imageTasks: point.imageTasks,
                imageSuccess: point.imageSuccess,
                imageFailed: point.imageFailed,
              }))}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="imageTasks" stroke="var(--color-imageTasks)" strokeWidth={2.5} dot={showSinglePointDot ? { r: 4, strokeWidth: 2 } : false} />
              <Line type="monotone" dataKey="imageSuccess" stroke="var(--color-imageSuccess)" strokeWidth={2.5} dot={showSinglePointDot ? { r: 4, strokeWidth: 2 } : false} />
              <Line type="monotone" dataKey="imageFailed" stroke="var(--color-imageFailed)" strokeWidth={2.5} dot={showSinglePointDot ? { r: 4, strokeWidth: 2 } : false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('charts.failures.title')}</CardTitle>
          <CardDescription>{t('charts.failures.description')}</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {period.activeProviders.length > 0 ? (
              period.activeProviders.map((provider) => (
                <Badge key={provider.provider} variant="outline">
                  {provider.provider} · {provider.count}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">{t('charts.failures.no_providers')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[260px] w-full" config={failureChartConfig}>
            <BarChart data={failureChartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {period.activeProviders.map((provider) => (
                <Bar
                  key={provider.provider}
                  dataKey={provider.provider}
                  stackId="failures"
                  fill={`var(--color-${provider.provider})`}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/shared/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type ChartItem = {
  channel: string;
  total: number;
  failed: number;
  attemptFailures: number;
};

export function AITasksOverviewCharts({ data }: { data: ChartItem[] }) {
  const t = useTranslations('admin.ai-tasks');

  const usageConfig = {
    total: {
      label: t('charts.total_calls'),
      color: 'var(--chart-1)',
    },
    failed: {
      label: t('charts.final_failed'),
      color: 'var(--chart-4)',
    },
  } satisfies ChartConfig;

  const attemptConfig = {
    attemptFailures: {
      label: t('charts.attempt_failed'),
      color: 'var(--chart-5)',
    },
  } satisfies ChartConfig;

  if (!data.length) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('charts.channel_usage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[260px] w-full" config={usageConfig}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="channel" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="failed" fill="var(--color-failed)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('charts.attempt_failures')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[260px] w-full" config={attemptConfig}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="channel" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="attemptFailures"
                fill="var(--color-attemptFailures)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

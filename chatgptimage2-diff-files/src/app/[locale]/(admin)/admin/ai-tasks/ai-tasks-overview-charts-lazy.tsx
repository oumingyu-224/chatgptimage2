'use client';

import dynamic from 'next/dynamic';

const AITasksOverviewCharts = dynamic(
  () =>
    import('./ai-tasks-overview-charts').then(
      (mod) => mod.AITasksOverviewCharts
    ),
  { ssr: false }
);

export function AITasksOverviewChartsLazy({
  data,
}: {
  data: {
    channel: string;
    total: number;
    failed: number;
    attemptFailures: number;
  }[];
}) {
  return <AITasksOverviewCharts data={data} />;
}

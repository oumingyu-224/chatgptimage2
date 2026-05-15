import { and, eq, gte } from 'drizzle-orm';

import { aiTask, order, user } from '@/config/db/schema';
import { db } from '@/core/db';
import { AITaskStatus } from '@/extensions/ai';
import { PaymentType } from '@/extensions/payment/types';
import { OrderStatus } from '@/shared/models/order';

type DashboardPoint = {
  label: string;
  dateKey: string;
  users: number;
  subscriptionPayments: number;
  subscriptionRevenue: number;
  imageTasks: number;
  imageSuccess: number;
  imageFailed: number;
  failureProviders: Record<string, number>;
};

export type AdminDashboardPeriodKey = 'today' | '7d' | '30d';

export type AdminDashboardPeriod = {
  key: AdminDashboardPeriodKey;
  label: string;
  summary: {
    users: number;
    subscriptionPayments: number;
    subscriptionRevenue: number;
    imageTasks: number;
    imageFailed: number;
  };
  activeProviders: Array<{
    provider: string;
    count: number;
  }>;
  points: DashboardPoint[];
};

export type AdminDashboardData = {
  periods: Record<AdminDashboardPeriodKey, AdminDashboardPeriod>;
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

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayLabel(date: Date, days: number, index: number) {
  if (days === 1) {
    return 'Today';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (days === 7 && index === days - 1) {
    return `Today · ${month}-${day}`;
  }
  return `${month}-${day}`;
}

function buildPoints(days: number): DashboardPoint[] {
  const today = startOfDay(new Date());
  const start = addDays(today, -(days - 1));

  return Array.from({ length: days }, (_, index) => {
    const current = addDays(start, index);
    return {
      label: formatDisplayLabel(current, days, index),
      dateKey: formatDateKey(current),
      users: 0,
      subscriptionPayments: 0,
      subscriptionRevenue: 0,
      imageTasks: 0,
      imageSuccess: 0,
      imageFailed: 0,
      failureProviders: {},
    };
  });
}

function sumPoints(points: DashboardPoint[]) {
  return points.reduce(
    (acc, point) => {
      acc.users += point.users;
      acc.subscriptionPayments += point.subscriptionPayments;
      acc.subscriptionRevenue += point.subscriptionRevenue;
      acc.imageTasks += point.imageTasks;
      acc.imageFailed += point.imageFailed;
      return acc;
    },
    {
      users: 0,
      subscriptionPayments: 0,
      subscriptionRevenue: 0,
      imageTasks: 0,
      imageFailed: 0,
    }
  );
}

function getActiveProviders(points: DashboardPoint[]) {
  const counts = new Map<string, number>();

  for (const point of points) {
    for (const [provider, count] of Object.entries(point.failureProviders)) {
      counts.set(provider, (counts.get(provider) || 0) + count);
    }
  }

  return Array.from(counts.entries())
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count);
}

function buildPeriod(days: number, key: AdminDashboardPeriodKey): AdminDashboardPeriod {
  const points = buildPoints(days);

  return {
    key,
    label: key,
    summary: sumPoints(points),
    activeProviders: [],
    points,
  };
}

function toDateKey(value: Date | string | null | undefined) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return formatDateKey(date);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const today = startOfDay(new Date());
  const start30d = addDays(today, -29);

  const [users, subscriptionOrders, imageTasks] = await Promise.all([
    db()
      .select({ createdAt: user.createdAt })
      .from(user)
      .where(gte(user.createdAt, start30d)),
    db()
      .select({
        createdAt: order.createdAt,
        paymentAmount: order.paymentAmount,
      })
      .from(order)
      .where(
        and(
          gte(order.createdAt, start30d),
          eq(order.status, OrderStatus.PAID),
          eq(order.paymentType, PaymentType.SUBSCRIPTION)
        )
      ),
    db()
      .select({
        createdAt: aiTask.createdAt,
        status: aiTask.status,
        provider: aiTask.provider,
      })
      .from(aiTask)
      .where(
        and(gte(aiTask.createdAt, start30d), eq(aiTask.mediaType, 'image'))
      ),
  ]);

  const periods: Record<AdminDashboardPeriodKey, AdminDashboardPeriod> = {
    today: buildPeriod(1, 'today'),
    '7d': buildPeriod(7, '7d'),
    '30d': buildPeriod(30, '30d'),
  };

  const periodEntries = Object.entries(periods) as Array<
    [AdminDashboardPeriodKey, AdminDashboardPeriod]
  >;

  const applyToPeriods = (
    dateKey: string,
    updater: (point: DashboardPoint) => void
  ) => {
    for (const [, period] of periodEntries) {
      const point = period.points.find((item) => item.dateKey === dateKey);
      if (point) {
        updater(point);
      }
    }
  };

  users.forEach((item: any) => {
    const dateKey = toDateKey(item.createdAt);
    if (!dateKey) {
      return;
    }

    applyToPeriods(dateKey, (point) => {
      point.users += 1;
    });
  });

  subscriptionOrders.forEach((item: any) => {
    const dateKey = toDateKey(item.createdAt);
    if (!dateKey) {
      return;
    }

    applyToPeriods(dateKey, (point) => {
      point.subscriptionPayments += 1;
      point.subscriptionRevenue += item.paymentAmount || 0;
    });
  });

  imageTasks.forEach((item: any) => {
    const dateKey = toDateKey(item.createdAt);
    if (!dateKey) {
      return;
    }

    applyToPeriods(dateKey, (point) => {
      point.imageTasks += 1;

      if (item.status === AITaskStatus.SUCCESS) {
        point.imageSuccess += 1;
      }

      if (item.status === AITaskStatus.FAILED) {
        point.imageFailed += 1;
        const provider = item.provider || 'unknown';
        point.failureProviders[provider] =
          (point.failureProviders[provider] || 0) + 1;
      }
    });
  });

  for (const [, period] of periodEntries) {
    period.summary = sumPoints(period.points);
    period.activeProviders = getActiveProviders(period.points);
  }

  return {
    periods,
  };
}

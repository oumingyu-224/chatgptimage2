import { and, count, desc, eq, isNotNull, isNull, like, lt, ne, or, sql } from 'drizzle-orm';

import { envConfigs } from '@/config';
import { db } from '@/core/db';
import { aiTask, credit } from '@/config/db/schema';
import { AITaskStatus } from '@/extensions/ai';
import { appendUserToResult, User } from '@/shared/models/user';

import { consumeCredits, CreditStatus } from './credit';

export type AITask = typeof aiTask.$inferSelect & {
  user?: User;
};
export type NewAITask = typeof aiTask.$inferInsert;
export type UpdateAITask = Partial<Omit<NewAITask, 'id' | 'createdAt'>>;
export type CreateAITaskIfAbsentResult = {
  task: AITask;
  created: boolean;
};

function parseTaskOptions(options?: string | null) {
  if (!options) {
    return {};
  }

  try {
    return JSON.parse(options);
  } catch {
    return {};
  }
}

function escapeLikeKeyword(keyword: string) {
  return keyword.replace(/[\\%_]/g, '\\$&');
}

export async function createAITask(newAITask: NewAITask) {
  const result = await db().transaction(async (tx: any) => {
    // 1. create task record
    const [taskResult] = await tx.insert(aiTask).values(newAITask).returning();

    if (newAITask.costCredits && newAITask.costCredits > 0) {
      // 2. consume credits
      const consumedCredit = await consumeCredits({
        userId: newAITask.userId,
        credits: newAITask.costCredits,
        scene: newAITask.scene,
        description: `generate ${newAITask.mediaType}`,
        metadata: JSON.stringify({
          type: 'ai-task',
          mediaType: taskResult.mediaType,
          taskId: taskResult.id,
        }),
        tx,
      });

      // 3. update task record with consumed credit id
      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(aiTask)
          .set({ creditId: consumedCredit.id })
          .where(eq(aiTask.id, taskResult.id));
      }
    }

    return taskResult;
  });

  return result;
}

export async function createAITaskIfAbsent({
  newAITask,
  maxActiveTasks,
}: {
  newAITask: NewAITask;
  maxActiveTasks?: number;
}): Promise<CreateAITaskIfAbsentResult> {
  return db().transaction(async (tx: any) => {
    if (
      envConfigs.database_provider === 'postgres' ||
      envConfigs.database_provider === 'postgresql'
    ) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`ai_task_create:${newAITask.userId}:${newAITask.mediaType}`}))`
      );
    }

    const [existingTask] = await tx
      .select()
      .from(aiTask)
      .where(eq(aiTask.id, newAITask.id));
    if (existingTask) {
      return {
        task: existingTask,
        created: false,
      };
    }

    if (maxActiveTasks && maxActiveTasks > 0) {
      const [activeCountResult] = await tx
        .select({ count: count() })
        .from(aiTask)
        .where(
          and(
            eq(aiTask.userId, newAITask.userId),
            eq(aiTask.mediaType, newAITask.mediaType),
            or(
              eq(aiTask.status, AITaskStatus.QUEUED),
              eq(aiTask.status, AITaskStatus.PENDING),
              eq(aiTask.status, AITaskStatus.PROCESSING)
            )
          )
        );

      if ((activeCountResult?.count || 0) >= maxActiveTasks) {
        throw new Error('too many active tasks');
      }
    }

    const [taskResult] = await tx
      .insert(aiTask)
      .values(newAITask)
      .onConflictDoNothing({ target: aiTask.id })
      .returning();

    if (!taskResult) {
      const [conflictTask] = await tx
        .select()
        .from(aiTask)
        .where(eq(aiTask.id, newAITask.id));
      if (!conflictTask) {
        throw new Error('create ai task failed');
      }
      return {
        task: conflictTask,
        created: false,
      };
    }

    if (newAITask.costCredits && newAITask.costCredits > 0) {
      const consumedCredit = await consumeCredits({
        userId: newAITask.userId,
        credits: newAITask.costCredits,
        scene: newAITask.scene,
        description: `generate ${newAITask.mediaType}`,
        metadata: JSON.stringify({
          type: 'ai-task',
          mediaType: taskResult.mediaType,
          taskId: taskResult.id,
        }),
        tx,
      });

      if (consumedCredit && consumedCredit.id) {
        taskResult.creditId = consumedCredit.id;
        await tx
          .update(aiTask)
          .set({ creditId: consumedCredit.id })
          .where(eq(aiTask.id, taskResult.id));
      }
    }

    return {
      task: taskResult,
      created: true,
    };
  });
}

export async function findAITaskById(id: string) {
  const [result] = await db().select().from(aiTask).where(eq(aiTask.id, id));
  return result;
}

export async function getAITasksPendingStorageMigration({
  limit = 100,
}: {
  limit?: number;
} = {}) {
  return await db()
    .select()
    .from(aiTask)
    .where(
      and(
        eq(aiTask.mediaType, 'image'),
        eq(aiTask.status, AITaskStatus.SUCCESS),
        isNotNull(aiTask.taskInfo)
      )
    )
    .orderBy(desc(aiTask.updatedAt))
    .limit(limit);
}

export async function claimQueuedAITaskById(id: string) {
  const [result] = await db()
    .update(aiTask)
    .set({
      status: AITaskStatus.PENDING,
    })
    .where(and(eq(aiTask.id, id), eq(aiTask.status, AITaskStatus.QUEUED)))
    .returning();

  return result;
}

export async function findAITaskByProviderTaskId({
  provider,
  taskId,
}: {
  provider: string;
  taskId: string;
}) {
  const [result] = await db()
    .select()
    .from(aiTask)
    .where(and(eq(aiTask.provider, provider), eq(aiTask.taskId, taskId)));
  return result;
}

async function revokeConsumedCreditIfNeeded(tx: any, updateAITask: UpdateAITask) {
  if (
    (updateAITask.status !== AITaskStatus.FAILED &&
      updateAITask.status !== AITaskStatus.CANCELED) ||
    !updateAITask.creditId
  ) {
    return;
  }

  const [consumedCredit] = await tx
    .select()
    .from(credit)
    .where(eq(credit.id, updateAITask.creditId));

  if (!consumedCredit || consumedCredit.status !== CreditStatus.ACTIVE) {
    return;
  }

  const consumedItems = JSON.parse(consumedCredit.consumedDetail || '[]');

  await Promise.all(
    consumedItems.map((item: any) => {
      if (item && item.creditId && item.creditsConsumed > 0) {
        return tx
          .update(credit)
          .set({
            remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
          })
          .where(eq(credit.id, item.creditId));
      }
    })
  );

  await tx
    .update(credit)
    .set({
      status: CreditStatus.DELETED,
    })
    .where(eq(credit.id, updateAITask.creditId));
}

export async function updateAITaskById(id: string, updateAITask: UpdateAITask) {
  const result = await db().transaction(async (tx: any) => {
    const [result] = await tx
      .update(aiTask)
      .set(updateAITask)
      .where(eq(aiTask.id, id))
      .returning();

    if (!result) {
      return result;
    }

    await revokeConsumedCreditIfNeeded(tx, updateAITask);

    return result;
  });

  return result;
}

export async function updateAITaskByIdAndTaskInfo({
  id,
  expectedTaskInfo,
  updateAITask,
}: {
  id: string;
  expectedTaskInfo: string;
  updateAITask: UpdateAITask;
}) {
  const [result] = await db()
    .update(aiTask)
    .set(updateAITask)
    .where(and(eq(aiTask.id, id), eq(aiTask.taskInfo, expectedTaskInfo)))
    .returning();

  return result;
}

export async function updateAITaskByIdWithGuards({
  id,
  updateAITask,
  expectedStatus,
  expectedStatuses,
  expectedTaskId,
  expectedUpdatedAt,
  expectedOptions,
}: {
  id: string;
  updateAITask: UpdateAITask;
  expectedStatus?: string;
  expectedStatuses?: string[];
  expectedTaskId?: string | null;
  expectedUpdatedAt?: Date | string | null;
  expectedOptions?: string | null;
}) {
  const conditions = [eq(aiTask.id, id)];

  if (expectedStatus) {
    conditions.push(eq(aiTask.status, expectedStatus));
  }

  if (expectedStatuses && expectedStatuses.length > 0) {
    conditions.push(or(...expectedStatuses.map((status) => eq(aiTask.status, status)))!);
  }

  if (expectedTaskId === null) {
    conditions.push(isNull(aiTask.taskId));
  } else if (typeof expectedTaskId === 'string') {
    conditions.push(eq(aiTask.taskId, expectedTaskId));
  }

  if (expectedUpdatedAt) {
    conditions.push(eq(aiTask.updatedAt, new Date(expectedUpdatedAt)));
  }

  if (expectedOptions === null) {
    conditions.push(isNull(aiTask.options));
  } else if (typeof expectedOptions === 'string') {
    conditions.push(eq(aiTask.options, expectedOptions));
  }

  const [result] = await db().transaction(async (tx: any) => {
    const [result] = await tx
      .update(aiTask)
      .set(updateAITask)
      .where(and(...conditions))
      .returning();

    if (!result) {
      return result;
    }

    await revokeConsumedCreditIfNeeded(tx, updateAITask);

    return result;
  });

  return result;
}

export async function getActiveAITasksCount({
  userId,
  provider,
  mediaType,
  excludeTaskId,
  includeQueued = true,
}: {
  userId?: string;
  provider?: string;
  mediaType?: string;
  excludeTaskId?: string;
  includeQueued?: boolean;
}) {
  const [result] = await db()
    .select({ count: count() })
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        excludeTaskId ? ne(aiTask.id, excludeTaskId) : undefined,
        includeQueued
          ? or(
              eq(aiTask.status, AITaskStatus.QUEUED),
              eq(aiTask.status, AITaskStatus.PENDING),
              eq(aiTask.status, AITaskStatus.PROCESSING)
            )
          : or(
              eq(aiTask.status, AITaskStatus.PENDING),
              eq(aiTask.status, AITaskStatus.PROCESSING)
            )
      )
    );

  return result?.count || 0;
}

export async function findReusableAITask({
  userId,
  mediaType,
  requestFingerprint,
  provider,
  model,
  maxAgeMs = 60 * 1000,
}: {
  userId: string;
  mediaType: string;
  requestFingerprint: string;
  provider?: string;
  model?: string;
  maxAgeMs?: number;
}) {
  const tasks = await db()
    .select()
    .from(aiTask)
    .where(
      and(
        eq(aiTask.userId, userId),
        eq(aiTask.mediaType, mediaType),
        provider ? eq(aiTask.provider, provider) : undefined,
        model ? eq(aiTask.model, model) : undefined,
        or(
          eq(aiTask.status, AITaskStatus.QUEUED),
          eq(aiTask.status, AITaskStatus.PENDING),
          eq(aiTask.status, AITaskStatus.PROCESSING)
        )
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(10);

  const now = Date.now();

  return tasks.find((task: AITask) => {
    const createdAt = task.createdAt ? new Date(task.createdAt).getTime() : 0;
    if (!createdAt || now - createdAt > maxAgeMs) {
      return false;
    }

    const options = parseTaskOptions(task.options);
    return options?.__requestFingerprint === requestFingerprint;
  });
}

export async function getQueuedAITasks({
  userId,
  mediaType,
  limit = 10,
}: {
  userId?: string;
  mediaType?: string;
  limit?: number;
}) {
  return db()
    .select()
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        eq(aiTask.status, AITaskStatus.QUEUED)
      )
    )
    .orderBy(aiTask.createdAt)
    .limit(limit);
}

export async function getStalePendingAITasks({
  mediaType,
  taskId,
  updatedBefore,
  limit = 20,
}: {
  mediaType?: string;
  taskId?: string;
  updatedBefore: Date;
  limit?: number;
}) {
  return db()
    .select()
    .from(aiTask)
    .where(
      and(
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        taskId ? eq(aiTask.id, taskId) : undefined,
        eq(aiTask.status, AITaskStatus.PENDING),
        isNull(aiTask.taskId),
        lt(aiTask.updatedAt, updatedBefore)
      )
    )
    .orderBy(aiTask.updatedAt)
    .limit(limit);
}

export async function getStaleActiveAITasks({
  userId,
  mediaType,
  updatedBefore,
  limit = 20,
}: {
  userId: string;
  mediaType?: string;
  updatedBefore: Date;
  limit?: number;
}) {
  return db()
    .select()
    .from(aiTask)
    .where(
      and(
        eq(aiTask.userId, userId),
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        or(
          eq(aiTask.status, AITaskStatus.PENDING),
          eq(aiTask.status, AITaskStatus.PROCESSING)
        ),
        isNotNull(aiTask.taskId),
        lt(aiTask.updatedAt, updatedBefore)
      )
    )
    .orderBy(aiTask.updatedAt)
    .limit(limit);
}

export async function getStaleQueuedAITasks({
  userId,
  mediaType,
  updatedBefore,
  limit = 20,
}: {
  userId: string;
  mediaType?: string;
  updatedBefore: Date;
  limit?: number;
}) {
  return db()
    .select()
    .from(aiTask)
    .where(
      and(
        eq(aiTask.userId, userId),
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        eq(aiTask.status, AITaskStatus.QUEUED),
        isNull(aiTask.taskId),
        lt(aiTask.updatedAt, updatedBefore)
      )
    )
    .orderBy(aiTask.updatedAt)
    .limit(limit);
}

export async function getAITasksCount({
  userId,
  status,
  mediaType,
  provider,
  keyword,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
  keyword?: string;
}): Promise<number> {
  const normalizedKeyword = keyword?.trim().slice(0, 64);
  const escapedKeyword = normalizedKeyword
    ? escapeLikeKeyword(normalizedKeyword)
    : '';

  const [result] = await db()
    .select({ count: count() })
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined,
        escapedKeyword
          ? or(
              like(aiTask.id, `%${escapedKeyword}%`),
              like(aiTask.taskId, `%${escapedKeyword}%`),
              like(aiTask.userId, `%${escapedKeyword}%`),
              like(aiTask.provider, `%${escapedKeyword}%`),
              like(aiTask.model, `%${escapedKeyword}%`)
            )
          : undefined
      )
    );

  return result?.count || 0;
}

export async function getAITasks({
  userId,
  status,
  mediaType,
  provider,
  keyword,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  status?: string;
  mediaType?: string;
  provider?: string;
  keyword?: string;
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<AITask[]> {
  const normalizedKeyword = keyword?.trim().slice(0, 64);
  const escapedKeyword = normalizedKeyword
    ? escapeLikeKeyword(normalizedKeyword)
    : '';

  const result = await db()
    .select()
    .from(aiTask)
    .where(
      and(
        userId ? eq(aiTask.userId, userId) : undefined,
        mediaType ? eq(aiTask.mediaType, mediaType) : undefined,
        provider ? eq(aiTask.provider, provider) : undefined,
        status ? eq(aiTask.status, status) : undefined,
        escapedKeyword
          ? or(
              like(aiTask.id, `%${escapedKeyword}%`),
              like(aiTask.taskId, `%${escapedKeyword}%`),
              like(aiTask.userId, `%${escapedKeyword}%`),
              like(aiTask.provider, `%${escapedKeyword}%`),
              like(aiTask.model, `%${escapedKeyword}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(aiTask.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

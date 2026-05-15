import assert from 'node:assert/strict';
import test from 'node:test';

import { AITaskStatus } from '@/extensions/ai/types';
import { createFailStaleImageTaskForTest } from '@/app/api/ai/query/route';
import {
  createDispatchImageAITask,
  createDispatchQueuedImageAITasks,
  createRecoverExpiredImageTaskClaims,
} from '@/shared/services/ai_task_dispatch';

test('failStaleImageTask returns latest task when guarded timeout update loses race', async () => {
  const failStaleImageTask = createFailStaleImageTaskForTest({
    findAITaskById: async () => ({
      id: 'task_1',
      status: AITaskStatus.SUCCESS,
      taskId: 'provider_1',
    }),
    updateAITaskByIdWithGuards: async () => null as any,
  });

  const result = await failStaleImageTask({
    id: 'task_1',
    status: AITaskStatus.PROCESSING,
    taskId: 'provider_1',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    creditId: 'credit_1',
  });

  assert.equal(result.status, AITaskStatus.SUCCESS);
  assert.equal(result.taskId, 'provider_1');
});

test('recoverExpiredImageTaskClaims skips tasks that already moved forward', async () => {
  let guardCalls = 0;
  const recoverExpiredImageTaskClaims = createRecoverExpiredImageTaskClaims({
    getStalePendingAITasks: async () =>
      [
        {
          id: 'task_1',
          status: AITaskStatus.PENDING,
          taskId: null,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          options: JSON.stringify({
            __providerAttempts: [],
            __dispatchCount: 1,
          }),
          mediaType: 'image',
          provider: 'openai',
          model: 'gpt-image-1',
          creditId: 'credit_1',
        },
      ] as any,
    updateAITaskByIdWithGuards: async () => {
      guardCalls += 1;
      return null as any;
    },
  });

  const recovered = await recoverExpiredImageTaskClaims(1);

  assert.equal(recovered, 1);
  assert.equal(guardCalls, 1);
});

test('dispatchImageAITask adopts late provider task id after claim expiry race', async () => {
  const claimOptions = JSON.stringify({
    __dispatchClaimToken: 'claim_1',
  });

  const dispatchImageAITask = createDispatchImageAITask({
    findAITaskById: async () =>
      ({
        id: 'task_1',
        mediaType: 'image',
        status: AITaskStatus.QUEUED,
        taskId: null,
        provider: 'openai',
        model: 'gpt-image-1',
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
        options: JSON.stringify({}),
        creditId: 'credit_1',
      }) as any,
    getActiveAITasksCount: async () => 0,
    getStalePendingAITasks: async () => [] as any,
    updateAITaskById: async () => null as any,
    updateAITaskByIdWithGuards: async ({ updateAITask, expectedOptions }) => {
      if (
        expectedOptions === JSON.stringify({}) &&
        updateAITask.status === AITaskStatus.PENDING &&
        !updateAITask.taskId
      ) {
        return {
          id: 'task_1',
          mediaType: 'image',
          status: AITaskStatus.PENDING,
          taskId: null,
          updatedAt: new Date('2026-01-01T00:00:30.000Z'),
          options: claimOptions,
          creditId: 'credit_1',
        } as any;
      }

      if (expectedOptions === claimOptions) {
        return null as any;
      }

      return {
        id: 'task_1',
        mediaType: 'image',
        status: updateAITask.status,
        taskId: updateAITask.taskId,
        provider: updateAITask.provider,
        model: updateAITask.model,
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
        options: updateAITask.options,
        creditId: 'credit_1',
      } as any;
    },
    getAllConfigs: async () => ({} as any),
    getEnabledImageChannels: () =>
      [
        {
          id: 'channel_1',
          name: 'OpenAI',
          provider: 'openai',
          model: 'gpt-image-1',
          priority: 1,
        },
      ] as any,
    createProviderByChannel: () =>
      ({
        generate: async () => ({
          taskStatus: AITaskStatus.PENDING,
          taskId: 'provider_task_1',
        }),
      }) as any,
  });

  const result = await dispatchImageAITask({
    id: 'task_1',
    mediaType: 'image',
    status: AITaskStatus.QUEUED,
    taskId: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    options: JSON.stringify({}),
    creditId: 'credit_1',
  } as any);

  assert.equal(result?.taskId, 'provider_task_1');
  assert.equal(result?.status, AITaskStatus.PENDING);
});

test('dispatchQueuedImageAITasks does not consume quota when task remains queued with same state', async () => {
  const queuedTask = {
    id: 'task_1',
    mediaType: 'image',
    status: AITaskStatus.QUEUED,
    taskId: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    options: JSON.stringify({}),
    taskInfo: null,
  } as any;

  let dispatchCalls = 0;
  const dispatchQueuedImageAITasks = createDispatchQueuedImageAITasks({
    recoverExpiredImageTaskClaims: async () => 0,
    getQueuedAITasks: async () => [
      queuedTask,
      {
        ...queuedTask,
        id: 'task_2',
      },
    ],
    dispatchImageAITask: async (task: any) => {
      dispatchCalls += 1;
      if (task.id === 'task_1') {
        return {
          ...task,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };
      }

      return {
        ...task,
        status: AITaskStatus.PENDING,
        updatedAt: new Date('2026-01-01T00:00:01.000Z'),
      };
    },
  });

  const result = await dispatchQueuedImageAITasks(1);

  assert.equal(dispatchCalls, 2);
  assert.equal(result.scanned, 2);
  assert.equal(result.dispatched, 1);
});

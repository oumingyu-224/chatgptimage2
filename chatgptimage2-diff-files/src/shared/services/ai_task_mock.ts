import { AITaskResult, AITaskStatus } from '@/extensions/ai';

const MOCK_IMAGE_URL =
  'https://upload.apimart.ai/f/image/9998222487369012-7d087a0a-0662-443d-856b-ac7b89ac7d80-image_task_01KQE04HPPZ5TG6SA16Y77SR5Q_0.png';
const MOCK_QUERY_REQUIRED_POLLS = 6;

function parseTaskInfo(taskInfo: any) {
  if (!taskInfo) {
    return {};
  }

  if (typeof taskInfo === 'string') {
    try {
      return JSON.parse(taskInfo);
    } catch {
      return {};
    }
  }

  if (typeof taskInfo === 'object') {
    return taskInfo;
  }

  return {};
}

export function createMockImageGenerateResult(taskId: string): AITaskResult {
  return {
    taskStatus: AITaskStatus.PENDING,
    taskId: `mock_${taskId}`,
    taskInfo: {
      status: 'pending',
      mockQueryCount: 0,
      mockQueryRequiredPolls: MOCK_QUERY_REQUIRED_POLLS,
      output: [],
      images: [],
    } as any,
    taskResult: {
      mock: true,
      pollCount: 0,
      requiredPolls: MOCK_QUERY_REQUIRED_POLLS,
    },
  };
}

export function buildMockImageQueryResult(task: {
  taskId: string;
  taskInfo?: any;
}): AITaskResult {
  const currentTaskInfo = parseTaskInfo(task.taskInfo);
  const requiredPolls = Math.max(
    1,
    Number(currentTaskInfo?.mockQueryRequiredPolls || MOCK_QUERY_REQUIRED_POLLS)
  );
  const pollCount = Math.min(
    requiredPolls,
    Math.max(0, Number(currentTaskInfo?.mockQueryCount || 0)) + 1
  );

  if (pollCount >= requiredPolls) {
    return {
      taskId: task.taskId,
      taskStatus: AITaskStatus.SUCCESS,
      taskInfo: {
        ...currentTaskInfo,
        status: 'completed',
        mockQueryCount: pollCount,
        mockQueryRequiredPolls: requiredPolls,
        output: [MOCK_IMAGE_URL],
        images: [
          {
            imageUrl: MOCK_IMAGE_URL,
            createTime: new Date(),
          },
        ],
      } as any,
      taskResult: {
        mock: true,
        pollCount,
        requiredPolls,
        images: [{ url: MOCK_IMAGE_URL }],
      },
    };
  }

  const providerStatus =
    pollCount < requiredPolls - 3 ? 'pending' : 'processing';

  return {
    taskId: task.taskId,
    taskStatus:
      providerStatus === 'pending'
        ? AITaskStatus.PENDING
        : AITaskStatus.PROCESSING,
    taskInfo: {
      ...currentTaskInfo,
      status: providerStatus,
      mockQueryCount: pollCount,
      mockQueryRequiredPolls: requiredPolls,
      output: [],
      images: [],
    } as any,
    taskResult: {
      mock: true,
      pollCount,
      requiredPolls,
    },
  };
}

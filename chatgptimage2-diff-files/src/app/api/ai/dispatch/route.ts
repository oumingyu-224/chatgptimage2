import { respData } from '@/shared/lib/resp';
import {
  dispatchQueuedImageAITasks,
  getDispatchTokenFromRequest,
  isValidDispatchToken,
  normalizeDispatchLimit,
} from '@/shared/services/ai_task_dispatch';
import { logAITaskEvent } from '@/shared/services/ai_task_log';

function respDispatchErr(message: string, status: number) {
  return Response.json(
    {
      code: -1,
      message,
    },
    { status }
  );
}

async function handleDispatch(req: Request) {
  const token = getDispatchTokenFromRequest(req);
  if (!isValidDispatchToken(token)) {
    logAITaskEvent('dispatch_auth_failed', {
      method: req.method,
    });
    return respDispatchErr('invalid dispatch token', 401);
  }

  const url = new URL(req.url);
  let limit = normalizeDispatchLimit(url.searchParams.get('limit'));

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.limit !== undefined) {
        limit = normalizeDispatchLimit(body.limit);
      }
    } catch {}
  }

  const result = await dispatchQueuedImageAITasks(limit);
  logAITaskEvent('dispatch_completed', {
    method: req.method,
    limit,
    scanned: result.scanned,
    dispatched: result.dispatched,
  });
  return respData({
    limit,
    ...result,
  });
}

export async function GET(req: Request) {
  try {
    return await handleDispatch(req);
  } catch (e: any) {
    logAITaskEvent('dispatch_failed', {
      method: req.method,
      error: e?.message || 'dispatch failed',
    });
    console.log('ai dispatch failed', e);
    return respDispatchErr('dispatch failed', 500);
  }
}

export async function POST(req: Request) {
  try {
    return await handleDispatch(req);
  } catch (e: any) {
    logAITaskEvent('dispatch_failed', {
      method: req.method,
      error: e?.message || 'dispatch failed',
    });
    console.log('ai dispatch failed', e);
    return respDispatchErr('dispatch failed', 500);
  }
}

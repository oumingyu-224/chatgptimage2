import { NextRequest } from 'next/server';
import { cleanupExpiredBlacklist } from '@/shared/services/risk-control';

export async function GET(request: NextRequest) {
  // 简单的认证检查（实际项目中应该使用更安全的认证方式）
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_AUTH_TOKEN;
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await cleanupExpiredBlacklist();
    return new Response('Blacklist cleanup completed', { status: 200 });
  } catch (error) {
    console.error('清理黑名单失败:', error);
    return new Response('Cleanup failed', { status: 500 });
  }
}
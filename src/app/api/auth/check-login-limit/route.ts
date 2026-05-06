import { NextRequest } from 'next/server';
import { checkLoginLimit } from '@/shared/services/risk-control';

export async function GET(request: NextRequest) {
  try {
    const result = await checkLoginLimit();
    
    return Response.json({
      allowed: result.allowed,
      remainingAttempts: result.remainingAttempts,
      errorMessage: result.errorMessage,
    });
  } catch (error) {
    console.error('检查登录限制API失败:', error);
    // 出错时返回安全的默认值
    return Response.json({
      allowed: true,
      remainingAttempts: 10,
    });
  }
}
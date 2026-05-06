import { NextRequest } from 'next/server';
import { getRiskControlStats } from '@/shared/services/risk-control';

export async function GET(request: NextRequest) {
  // 简单的管理员认证检查
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.ADMIN_AUTH_TOKEN;
  
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const stats = await getRiskControlStats(24); // 获取24小时统计数据
    
    return Response.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取风控统计失败:', error);
    return Response.json({
      success: false,
      error: '获取统计数据失败',
    }, { status: 500 });
  }
}
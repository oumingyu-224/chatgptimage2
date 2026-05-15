import { retryFailedR2Migrations } from '@/shared/services/ai_storage_migration';

export async function GET(req: Request) {
  const cronSecret =
    process.env.AI_STORAGE_CRON_SECRET ||
    process.env.CRON_SECRET ||
    process.env.PAYMENT_CRON_SECRET ||
    '';
  const authHeader = req.headers.get('authorization');
  const vercelCronHeader = req.headers.get('x-vercel-cron');

  if (
    !vercelCronHeader &&
    (!cronSecret || authHeader !== `Bearer ${cronSecret}`)
  ) {
    return Response.json({ message: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await retryFailedR2Migrations(100);
    return Response.json(result);
  } catch (error: any) {
    return Response.json(
      {
        message: error?.message || 'retry failed r2 migrations failed',
      },
      { status: 500 }
    );
  }
}

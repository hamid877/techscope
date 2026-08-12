import { NextResponse } from 'next/server';
import { createPackageRefreshDependencies } from '@/infrastructure/composition/createRefreshBatchDependencies';
import { runPackageRefreshBatch } from '@/scripts/refresh-packages';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/refresh] CRON_SECRET is not configured');

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Cron endpoint is not configured',
      },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        error: 'unauthorized',
        message: 'Unauthorized',
      },
      { status: 401 }
    );
  }

  try {
    console.log('[cron/refresh] Starting scheduled refresh...');

    const dependencies = createPackageRefreshDependencies();

    const summary = await runPackageRefreshBatch(dependencies);

    console.log('[cron/refresh] Scheduled refresh completed.', summary);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('[cron/refresh] Scheduled refresh failed:', error);

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Refresh failed',
      },
      { status: 500 }
    );
  }
}

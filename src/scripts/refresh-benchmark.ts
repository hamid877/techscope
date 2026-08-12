import 'dotenv/config';

import { createRefreshBatchDependencies } from '@/infrastructure/composition/createRefreshBatchDependencies';

/**
 * Standalone CLI script for regenerating the benchmark snapshot.
 *
 * This is intended to be run OUTSIDE Vercel's 300-second serverless limit
 * because benchmark generation takes approximately 5+ minutes.
 *
 * Usage:
 *   npm run refresh:benchmark
 *
 * After this completes successfully, the normal Vercel cron (/api/cron/refresh)
 * will consume the updated snapshot when it next runs.
 */
async function main(): Promise<void> {
  console.log('[refresh-benchmark] Starting benchmark snapshot generation...');

  const { createBenchmarkSnapshotUseCase } = createRefreshBatchDependencies();

  try {
    await createBenchmarkSnapshotUseCase.execute();
    console.log('[refresh-benchmark] Benchmark snapshot generated and saved successfully.');
  } catch (err) {
    console.error('[refresh-benchmark] Failed to generate benchmark snapshot:', err);
    throw err;
  }
}

main()
  .then(async () => {
    const { prisma } = await import('@/persistence/prisma/client');
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[refresh-benchmark] Exiting with error:', err);
    const { prisma } = await import('@/persistence/prisma/client');
    await prisma.$disconnect();
    process.exit(1);
  });

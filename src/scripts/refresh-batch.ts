import { CreateBenchmarkSnapshotUseCase } from '../application/use-cases/CreateBenchmarkSnapshotUseCase';
import { GetBenchmarkSnapshotUseCase } from '../application/use-cases/GetBenchmarkSnapshotUseCase';
import { GetPackageScoreUseCase } from '../application/use-cases/GetPackageScoreUseCase';
import { PackageScoreRepository } from '../application/interfaces/PackageScoreRepository';
import { prisma } from '@/persistence/prisma/client';
import { PrismaBenchmarkSnapshotRepository } from '../infrastructure/persistence/PrismaBenchmarkSnapshotRepository';
import { PrismaPackageScoreRepository } from '../infrastructure/persistence/PrismaPackageScoreRepository';
import { PackageResolutionService } from '../infrastructure/registry/PackageResolutionService';
import { SignalCollectionService } from '../application/services/SignalCollectionService';
import { GitHubV1Adapter } from '../infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '../infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '../infrastructure/registry/PyPIV1Adapter';
import { GitHubClient } from '../infrastructure/github/GitHubClient';

export interface RunRefreshBatchOptions {
  packageDelayMs?: number;
}

export interface RefreshBatchDependencies {
  createBenchmarkSnapshotUseCase: CreateBenchmarkSnapshotUseCase;
  getBenchmarkSnapshotUseCase: GetBenchmarkSnapshotUseCase;
  getPackageScoreUseCase: GetPackageScoreUseCase;
  packageScoreRepository: PackageScoreRepository;
}

export interface RefreshBatchSummary {
  total: number;
  refreshed: number;
  insufficient: number;
  unsupported: number;
  failed: number;
}

export async function runRefreshBatch(
  dependencies: RefreshBatchDependencies,
  options: RunRefreshBatchOptions = {}
): Promise<RefreshBatchSummary> {
  const {
    createBenchmarkSnapshotUseCase,
    getBenchmarkSnapshotUseCase,
    getPackageScoreUseCase,
    packageScoreRepository,
  } = dependencies;

  const packageDelayMs = options.packageDelayMs ?? 500;

  console.log('[refresh] Starting benchmark snapshot...');
  try {
    await createBenchmarkSnapshotUseCase.execute();
    console.log('[refresh] Benchmark snapshot saved.');
  } catch {
    console.error('[refresh] Failed to generate benchmark snapshot. Aborting batch.');
    throw new Error('Benchmark snapshot generation failed.');
  }

  // Load the newly persisted benchmark snapshot ONCE
  const populations = await getBenchmarkSnapshotUseCase.execute();

  const packages = await packageScoreRepository.findAll();
  console.log(`[refresh] Refreshing ${packages.length} packages...`);

  let refreshed = 0;
  let insufficientData = 0;
  let unsupportedOrUnresolved = 0;
  let failed = 0;

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    if (i > 0 && packageDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, packageDelayMs));
    }

    try {
      const record = await getPackageScoreUseCase.execute(
        pkg.packageName,
        pkg.registry,
        { forceRefresh: true, populations }
      );

      if (record.status === 'success') {
        refreshed++;
        console.log(`[refresh] ${pkg.registry}/${pkg.packageName} -> success (${record.healthScore})`);
      } else if (record.status === 'insufficient_data') {
        insufficientData++;
        console.log(`[refresh] ${pkg.registry}/${pkg.packageName} -> insufficient_data`);
      } else {
        unsupportedOrUnresolved++;
        console.log(`[refresh] ${pkg.registry}/${pkg.packageName} -> unsupported_or_unresolved`);
      }
    } catch {
      failed++;
      console.error(`[refresh] ${pkg.registry}/${pkg.packageName} -> FAILED, preserving previous score`);
    }
  }

  console.log(`[refresh] Completed: ${refreshed} refreshed, ${insufficientData} insufficient_data, ${unsupportedOrUnresolved} unsupported/unresolved, ${failed} failed`);

  return {
    total: packages.length,
    refreshed,
    insufficient: insufficientData,
    unsupported: unsupportedOrUnresolved,
    failed,
  };
}

// Auto-execute if run directly from CLI
if (typeof require !== 'undefined' && require.main === module) {
  const benchmarkRepo = new PrismaBenchmarkSnapshotRepository(prisma);
  const packageScoreRepo = new PrismaPackageScoreRepository(prisma);
  const githubClient = new GitHubClient();
  const githubAdapter = new GitHubV1Adapter(githubClient);
  const npmAdapter = new NpmV1Adapter();
  const pypiAdapter = new PyPIV1Adapter();

  const createBenchmarkSnapshotUseCase = new CreateBenchmarkSnapshotUseCase(
    benchmarkRepo,
    githubAdapter,
    npmAdapter,
    pypiAdapter
  );

  const getBenchmarkSnapshotUseCase = new GetBenchmarkSnapshotUseCase(benchmarkRepo);

  const packageResolutionService = new PackageResolutionService();
  const signalCollectionService = new SignalCollectionService(
    githubAdapter,
    npmAdapter,
    pypiAdapter
  );

  const getPackageScoreUseCase = new GetPackageScoreUseCase(
    packageScoreRepo,
    packageResolutionService,
    signalCollectionService,
    getBenchmarkSnapshotUseCase,
    githubAdapter
  );

  runRefreshBatch({
    createBenchmarkSnapshotUseCase,
    getBenchmarkSnapshotUseCase,
    getPackageScoreUseCase,
    packageScoreRepository: packageScoreRepo,
  }).then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  }).catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
}

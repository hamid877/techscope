import { GetBenchmarkSnapshotUseCase } from '../application/use-cases/GetBenchmarkSnapshotUseCase';
import { GetPackageScoreUseCase } from '../application/use-cases/GetPackageScoreUseCase';
import { PackageScoreRepository } from '../application/interfaces/PackageScoreRepository';

export interface RunPackageRefreshOptions {
  packageDelayMs?: number;
}

export interface PackageRefreshDependencies {
  getBenchmarkSnapshotUseCase: GetBenchmarkSnapshotUseCase;
  getPackageScoreUseCase: GetPackageScoreUseCase;
  packageScoreRepository: PackageScoreRepository;
}

export interface PackageRefreshSummary {
  total: number;
  refreshed: number;
  insufficient: number;
  unsupported: number;
  failed: number;
}

/**
 * Refreshes all tracked package scores against the EXISTING benchmark snapshot.
 * Does NOT call CreateBenchmarkSnapshotUseCase — benchmark generation is a separate
 * long-running operation (see refresh-benchmark.ts / npm run refresh:benchmark).
 *
 * If no benchmark snapshot exists, GetBenchmarkSnapshotUseCase.execute() will throw
 * and this function will propagate that error rather than silently scoring against
 * missing data.
 */
export async function runPackageRefreshBatch(
  dependencies: PackageRefreshDependencies,
  options: RunPackageRefreshOptions = {}
): Promise<PackageRefreshSummary> {
  const {
    getBenchmarkSnapshotUseCase,
    getPackageScoreUseCase,
    packageScoreRepository,
  } = dependencies;

  const packageDelayMs = options.packageDelayMs ?? 500;

  // Load the existing benchmark snapshot ONCE — throws if none exists.
  console.log('[refresh-packages] Loading benchmark snapshot...');
  const populations = await getBenchmarkSnapshotUseCase.execute();
  console.log('[refresh-packages] Benchmark snapshot loaded.');

  const packages = await packageScoreRepository.findAll();
  console.log(`[refresh-packages] Refreshing ${packages.length} packages...`);

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
        console.log(`[refresh-packages] ${pkg.registry}/${pkg.packageName} -> success (${record.healthScore})`);
      } else if (record.status === 'insufficient_data') {
        insufficientData++;
        console.log(`[refresh-packages] ${pkg.registry}/${pkg.packageName} -> insufficient_data`);
      } else {
        unsupportedOrUnresolved++;
        console.log(`[refresh-packages] ${pkg.registry}/${pkg.packageName} -> unsupported_or_unresolved`);
      }
    } catch {
      failed++;
      console.error(`[refresh-packages] ${pkg.registry}/${pkg.packageName} -> FAILED, preserving previous score`);
    }
  }

  console.log(
    `[refresh-packages] Completed: ${refreshed} refreshed, ${insufficientData} insufficient_data, ${unsupportedOrUnresolved} unsupported/unresolved, ${failed} failed`
  );

  return {
    total: packages.length,
    refreshed,
    insufficient: insufficientData,
    unsupported: unsupportedOrUnresolved,
    failed,
  };
}

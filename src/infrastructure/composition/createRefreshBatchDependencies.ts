import { CreateBenchmarkSnapshotUseCase } from '@/application/use-cases/CreateBenchmarkSnapshotUseCase';
import { GetBenchmarkSnapshotUseCase } from '@/application/use-cases/GetBenchmarkSnapshotUseCase';
import { GetPackageScoreUseCase } from '@/application/use-cases/GetPackageScoreUseCase';
import { PackageScoreRepository } from '@/application/interfaces/PackageScoreRepository';
import { prisma } from '@/persistence/prisma/client';
import { PrismaBenchmarkSnapshotRepository } from '@/infrastructure/persistence/PrismaBenchmarkSnapshotRepository';
import { PrismaPackageScoreRepository } from '@/infrastructure/persistence/PrismaPackageScoreRepository';
import { PackageResolutionService } from '@/infrastructure/registry/PackageResolutionService';
import { SignalCollectionService } from '@/application/services/SignalCollectionService';
import { GitHubV1Adapter } from '@/infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '@/infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '@/infrastructure/registry/PyPIV1Adapter';
import { GitHubClient } from '@/infrastructure/github/GitHubClient';

export interface RefreshBatchDependencies {
  createBenchmarkSnapshotUseCase: CreateBenchmarkSnapshotUseCase;
  getBenchmarkSnapshotUseCase: GetBenchmarkSnapshotUseCase;
  getPackageScoreUseCase: GetPackageScoreUseCase;
  packageScoreRepository: PackageScoreRepository;
}

export function createRefreshBatchDependencies(): RefreshBatchDependencies {
  const benchmarkRepository =
    new PrismaBenchmarkSnapshotRepository(prisma);

  const packageScoreRepository =
    new PrismaPackageScoreRepository(prisma);

  const githubClient = new GitHubClient();
  const githubAdapter = new GitHubV1Adapter(githubClient);
  const npmAdapter = new NpmV1Adapter();
  const pypiAdapter = new PyPIV1Adapter();

  const createBenchmarkSnapshotUseCase =
    new CreateBenchmarkSnapshotUseCase(
      benchmarkRepository,
      githubAdapter,
      npmAdapter,
      pypiAdapter
    );

  const getBenchmarkSnapshotUseCase =
    new GetBenchmarkSnapshotUseCase(benchmarkRepository);

  const packageResolutionService =
    new PackageResolutionService();

  const signalCollectionService =
    new SignalCollectionService(
      githubAdapter,
      npmAdapter,
      pypiAdapter
    );

  const getPackageScoreUseCase =
    new GetPackageScoreUseCase(
      packageScoreRepository,
      packageResolutionService,
      signalCollectionService,
      getBenchmarkSnapshotUseCase,
      githubAdapter
    );

  return {
    createBenchmarkSnapshotUseCase,
    getBenchmarkSnapshotUseCase,
    getPackageScoreUseCase,
    packageScoreRepository,
  };
}

// ---------------------------------------------------------------------------
// Narrow dependency set for package-only refresh (no benchmark generation).
// Used by the Vercel cron route so it never constructs CreateBenchmarkSnapshotUseCase.
// ---------------------------------------------------------------------------

export interface PackageRefreshDependencies {
  getBenchmarkSnapshotUseCase: GetBenchmarkSnapshotUseCase;
  getPackageScoreUseCase: GetPackageScoreUseCase;
  packageScoreRepository: PackageScoreRepository;
}

export function createPackageRefreshDependencies(): PackageRefreshDependencies {
  const benchmarkRepository =
    new PrismaBenchmarkSnapshotRepository(prisma);

  const packageScoreRepository =
    new PrismaPackageScoreRepository(prisma);

  const githubClient = new GitHubClient();
  const githubAdapter = new GitHubV1Adapter(githubClient);
  const npmAdapter = new NpmV1Adapter();
  const pypiAdapter = new PyPIV1Adapter();

  const getBenchmarkSnapshotUseCase =
    new GetBenchmarkSnapshotUseCase(benchmarkRepository);

  const packageResolutionService =
    new PackageResolutionService();

  const signalCollectionService =
    new SignalCollectionService(
      githubAdapter,
      npmAdapter,
      pypiAdapter
    );

  const getPackageScoreUseCase =
    new GetPackageScoreUseCase(
      packageScoreRepository,
      packageResolutionService,
      signalCollectionService,
      getBenchmarkSnapshotUseCase,
      githubAdapter
    );

  return {
    getBenchmarkSnapshotUseCase,
    getPackageScoreUseCase,
    packageScoreRepository,
  };
}

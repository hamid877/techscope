import { Registry } from '../../domain/types/registry';
import { PackageScoreRecord, PackageScoreRepository } from '../interfaces/PackageScoreRepository';
import { PackageResolutionService } from '../../infrastructure/registry/PackageResolutionService';
import { SignalCollectionService } from '../services/SignalCollectionService';
import { GetBenchmarkSnapshotUseCase } from './GetBenchmarkSnapshotUseCase';
import { computeV1MetricsBreakdown, V1BenchmarkPopulations } from '../../domain/services/V1ScoringService';
import { InsufficientMetricDataError } from '../../domain/errors/InsufficientMetricDataError';
import { GitHubV1Adapter } from '../../infrastructure/github/GitHubV1Adapter';
import { calculateV1Score } from '../../domain/services/ScoringService';

export interface GetPackageScoreOptions {
  forceRefresh?: boolean;
  populations?: V1BenchmarkPopulations;
}

export class GetPackageScoreUseCase {
  constructor(
    private readonly repository: PackageScoreRepository,
    private readonly resolutionService: PackageResolutionService,
    private readonly signalCollectionService: SignalCollectionService,
    private readonly getBenchmarkSnapshotUseCase: GetBenchmarkSnapshotUseCase,
    private readonly githubAdapter: GitHubV1Adapter = new GitHubV1Adapter()
  ) {}

  async execute(packageName: string, registry: Registry, options?: GetPackageScoreOptions): Promise<PackageScoreRecord> {
    if (!options?.forceRefresh) {
      const existing = await this.repository.findByPackageAndRegistry(packageName, registry);
      if (existing) {
        return existing;
      }
    }

    const resolution = await this.resolutionService.resolve(packageName, registry);

    if ('reason' in resolution && resolution.reason === 'unsupported_or_unresolved') {
      const record: PackageScoreRecord = {
        packageName,
        registry,
        status: 'unsupported_or_unresolved',
        healthScore: null,
        metricsAvailable: null,
        metricsTotal: null,
        methodologyVersion: '1.0',
        isProvisional: false,
        metricsBreakdown: null,
        calculatedAt: new Date(),
        refreshedAt: new Date(),
      };
      await this.repository.save(record);
      return record;
    }

    const successResolution = resolution as { owner: string; repo: string };
    const { owner: githubOwner, repo: githubRepo } = successResolution;

    let isProvisional = false;
    if (githubOwner && githubRepo) {
      const metadata = await this.githubAdapter.getRepositoryMetadata(githubOwner, githubRepo);
      if (metadata?.createdAt) {
        const createdAt = new Date(metadata.createdAt);
        const ageMs = Date.now() - createdAt.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays < 90) {
          isProvisional = true;
        }
      }
    }

    const populations = options?.populations ?? await this.getBenchmarkSnapshotUseCase.execute();

    const signals = await this.signalCollectionService.collectSignals(
      registry,
      packageName,
      githubOwner || null,
      githubRepo || null,
    );

    const metrics = computeV1MetricsBreakdown(signals, populations);
    const metricsAvailable = metrics.filter(m => m.percentile !== null).length;
    const metricsBreakdown = metrics.map(m => ({
      metric: m.metric,
      percentile: m.percentile?.value ?? null,
      weight: m.weight
    }));

    try {
      const score = calculateV1Score(metrics);

      const record: PackageScoreRecord = {
        packageName,
        registry,
        status: 'success',
        healthScore: score.value,
        metricsAvailable,
        metricsTotal: 6,
        methodologyVersion: '1.0',
        isProvisional,
        metricsBreakdown,
        calculatedAt: new Date(),
        refreshedAt: new Date(),
      };

      await this.repository.save(record);
      return record;

    } catch (error) {
      if (error instanceof InsufficientMetricDataError) {
        const record: PackageScoreRecord = {
          packageName,
          registry,
          status: 'insufficient_data',
          healthScore: null,
          metricsAvailable,
          metricsTotal: 6,
          methodologyVersion: '1.0',
          isProvisional,
          metricsBreakdown,
          calculatedAt: new Date(),
          refreshedAt: new Date(),
        };
        await this.repository.save(record);
        return record;
      }
      throw error;
    }
  }
}

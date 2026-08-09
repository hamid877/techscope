/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetPackageScoreUseCase } from '../../../../application/use-cases/GetPackageScoreUseCase';
import { PackageScoreRepository, PackageScoreRecord } from '../../../../application/interfaces/PackageScoreRepository';
import { PackageResolutionService } from '../../../../infrastructure/registry/PackageResolutionService';
import { SignalCollectionService } from '../../../../application/services/SignalCollectionService';
import { GetBenchmarkSnapshotUseCase } from '../../../../application/use-cases/GetBenchmarkSnapshotUseCase';
import { GitHubV1Adapter } from '../../../../infrastructure/github/GitHubV1Adapter';
import { InsufficientMetricDataError } from '../../../../domain/errors/InsufficientMetricDataError';

class MockPackageScoreRepository implements PackageScoreRepository {
  async findByPackageAndRegistry(packageName: string, registry: any): Promise<PackageScoreRecord | null> {
    return null;
  }
  async findAll(): Promise<PackageScoreRecord[]> {
    return [];
  }

  async save(record: PackageScoreRecord): Promise<void> {}
}

class MockPackageResolutionService extends PackageResolutionService {
  async resolve(packageName: string, registry: any): Promise<any> {
    return { score: null, reason: 'unsupported_or_unresolved' };
  }
}

class MockSignalCollectionService extends SignalCollectionService {
  async collectSignals(): Promise<any> {
    return {};
  }
}

class MockGetBenchmarkSnapshotUseCase extends GetBenchmarkSnapshotUseCase {
  constructor() {
    super({} as any);
  }
  async execute(): Promise<any> {
    return {};
  }
}

describe('GetPackageScoreUseCase', () => {
  let repository: MockPackageScoreRepository;
  let resolutionService: MockPackageResolutionService;
  let signalCollectionService: MockSignalCollectionService;
  let getBenchmarkSnapshotUseCase: MockGetBenchmarkSnapshotUseCase;
  let githubAdapter: GitHubV1Adapter;
  let useCase: GetPackageScoreUseCase;

  beforeEach(() => {
    repository = new MockPackageScoreRepository();
    resolutionService = new MockPackageResolutionService();
    signalCollectionService = new MockSignalCollectionService();
    getBenchmarkSnapshotUseCase = new MockGetBenchmarkSnapshotUseCase();
    githubAdapter = new GitHubV1Adapter();
    useCase = new GetPackageScoreUseCase(
      repository,
      resolutionService,
      signalCollectionService,
      getBenchmarkSnapshotUseCase,
      githubAdapter
    );
  });

  it('returns a fresh cache hit immediately', async () => {
    const existing = { healthScore: 50 } as PackageScoreRecord;
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(existing);

    const result = await useCase.execute('pkg', 'npm');
    expect(result).toBe(existing);
  });

  it('returns a stale cache hit immediately (refresh is handled elsewhere)', async () => {
    const staleDate = new Date();
    staleDate.setFullYear(2000);
    const existing = { healthScore: 50, refreshedAt: staleDate } as PackageScoreRecord;
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(existing);

    const result = await useCase.execute('pkg', 'npm');
    expect(result).toBe(existing);
  });

  it('handles unresolved package by persisting reason', async () => {
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(null);
    vi.spyOn(resolutionService, 'resolve').mockResolvedValue({ score: null, reason: 'unsupported_or_unresolved' });
    vi.spyOn(repository, 'save').mockResolvedValue(undefined);

    const result = await useCase.execute('pkg', 'npm');

    expect(result.status).toBe('unsupported_or_unresolved');
    expect(result.healthScore).toBeNull();
    expect(repository.save).toHaveBeenCalledWith(result);
  });

  it('calculates score and persists metrics breakdown for a cache miss', async () => {
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(null);
    vi.spyOn(resolutionService, 'resolve').mockResolvedValue({ owner: 'owner', repo: 'repo' } as any);
    vi.spyOn(githubAdapter, 'getRepositoryMetadata').mockResolvedValue({ createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() }); // older than 90 days => not provisional

    vi.spyOn(getBenchmarkSnapshotUseCase, 'execute').mockResolvedValue({
      commitCadence: [1, 2, 3],
      releaseFrequency: [1, 2, 3],
      issueResolutionHealth: [{ resolutionRate: 0.5, medianDaysToClose: 20 }],
      contributorConcentration: [0.2, 0.5, 0.8],
      downloadMomentum: [1, 2, 3],
      documentationPresence: [1, 2, 3]
    });

    vi.spyOn(signalCollectionService, 'collectSignals').mockResolvedValue({
      commitCadence: { status: 'success', metricName: 'commit_cadence', data: { commits52Weeks: 10 } },
      releaseFrequency: { status: 'success', metricName: 'release_frequency', data: { releases12Months: 2 } },
      issueResolutionHealth: { status: 'success', metricName: 'issue_resolution_health', data: { openedIssues180Days: 5, closedIssues180Days: 5, medianDaysToClose180Days: 1 } },
      contributorConcentration: { status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 5, totalHumanCommits12Months: 10 } },
      documentationPresence: { status: 'success', metricName: 'documentation_presence', data: { readmeSizeBytes: 1000, hasHomepageUrl: true, hasDocsFolder: true, fencedCodeBlockCount: 2 } },
      downloadMomentum: { status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 100, prior30DayDownloads: 50, lowerConfidence: false } }
    } as any);

    vi.spyOn(repository, 'save').mockResolvedValue(undefined);

    const result = await useCase.execute('pkg', 'npm');

    expect(result.status).toBe('success');
    expect(result.healthScore).not.toBeNull();
    expect(result.isProvisional).toBe(false);
    expect(result.metricsBreakdown).toHaveLength(6);
    expect(repository.save).toHaveBeenCalledWith(result);
  });

  it('marks provisional for repository younger than 90 days', async () => {
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(null);
    vi.spyOn(resolutionService, 'resolve').mockResolvedValue({ owner: 'owner', repo: 'repo' } as any);
    vi.spyOn(githubAdapter, 'getRepositoryMetadata').mockResolvedValue({ createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }); // 10 days old => provisional

    // Stub out the rest with sufficient data
    vi.spyOn(getBenchmarkSnapshotUseCase, 'execute').mockResolvedValue({
      commitCadence: [1, 2, 3], releaseFrequency: [1, 2, 3], issueResolutionHealth: [{ resolutionRate: 0.5, medianDaysToClose: 20 }],
      contributorConcentration: [0.2, 0.5, 0.8], downloadMomentum: [1, 2, 3], documentationPresence: [1, 2, 3]
    });
    vi.spyOn(signalCollectionService, 'collectSignals').mockResolvedValue({
      commitCadence: { status: 'success', metricName: 'commit_cadence', data: { commits52Weeks: 10 } },
      releaseFrequency: { status: 'success', metricName: 'release_frequency', data: { releases12Months: 2 } },
      issueResolutionHealth: { status: 'success', metricName: 'issue_resolution_health', data: { openedIssues180Days: 5, closedIssues180Days: 5, medianDaysToClose180Days: 1 } },
      contributorConcentration: { status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 5, totalHumanCommits12Months: 10 } },
      documentationPresence: { status: 'success', metricName: 'documentation_presence', data: { readmeSizeBytes: 1000, hasHomepageUrl: true, hasDocsFolder: true, fencedCodeBlockCount: 2 } },
      downloadMomentum: { status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 100, prior30DayDownloads: 50, lowerConfidence: false } }
    } as any);

    const result = await useCase.execute('pkg', 'npm');
    expect(result.isProvisional).toBe(true);
  });

  it('handles insufficient metric data gracefully', async () => {
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(null);
    vi.spyOn(resolutionService, 'resolve').mockResolvedValue({ owner: 'owner', repo: 'repo' } as any);
    vi.spyOn(githubAdapter, 'getRepositoryMetadata').mockResolvedValue({ createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() });

    vi.spyOn(getBenchmarkSnapshotUseCase, 'execute').mockResolvedValue({
      commitCadence: [1, 2, 3], releaseFrequency: [1, 2, 3], issueResolutionHealth: [{ resolutionRate: 0.5, medianDaysToClose: 20 }],
      contributorConcentration: [0.2, 0.5, 0.8], downloadMomentum: [1, 2, 3], documentationPresence: [1, 2, 3]
    });

    vi.spyOn(signalCollectionService, 'collectSignals').mockResolvedValue({
      commitCadence: { status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' },
      releaseFrequency: { status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' },
      issueResolutionHealth: { status: 'unavailable', metricName: 'issue_resolution_health', reason: 'insufficient_data' },
      contributorConcentration: { status: 'unavailable', metricName: 'contributor_concentration', reason: 'insufficient_data' },
      documentationPresence: { status: 'unavailable', metricName: 'documentation_presence', reason: 'insufficient_data' },
      downloadMomentum: { status: 'unavailable', metricName: 'download_momentum', reason: 'insufficient_data' }
    } as any);

    vi.spyOn(repository, 'save').mockResolvedValue(undefined);

    const result = await useCase.execute('pkg', 'npm');

    expect(result.status).toBe('insufficient_data');
    expect(result.healthScore).toBeNull();
    expect(result.metricsBreakdown).toHaveLength(6);
    expect(result.metricsAvailable).toBe(0);
    expect(repository.save).toHaveBeenCalledWith(result);
  });

  it('does not fabricate a successful score if persistence fails', async () => {
    vi.spyOn(repository, 'findByPackageAndRegistry').mockResolvedValue(null);
    vi.spyOn(resolutionService, 'resolve').mockResolvedValue({ owner: 'owner', repo: 'repo' } as any);
    vi.spyOn(getBenchmarkSnapshotUseCase, 'execute').mockResolvedValue({
      commitCadence: [1], releaseFrequency: [1], issueResolutionHealth: [{ resolutionRate: 1, medianDaysToClose: 1 }],
      contributorConcentration: [1], downloadMomentum: [1], documentationPresence: [1]
    });
    vi.spyOn(signalCollectionService, 'collectSignals').mockResolvedValue({
      commitCadence: { status: 'success', metricName: 'commit_cadence', data: { commits52Weeks: 10 } },
      releaseFrequency: { status: 'success', metricName: 'release_frequency', data: { releases12Months: 2 } },
      issueResolutionHealth: { status: 'success', metricName: 'issue_resolution_health', data: { openedIssues180Days: 5, closedIssues180Days: 5, medianDaysToClose180Days: 1 } },
      contributorConcentration: { status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 5, totalHumanCommits12Months: 10 } },
      documentationPresence: { status: 'success', metricName: 'documentation_presence', data: { readmeSizeBytes: 1000, hasHomepageUrl: true, hasDocsFolder: true, fencedCodeBlockCount: 2 } },
      downloadMomentum: { status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 100, prior30DayDownloads: 50, lowerConfidence: false } }
    } as any);

    const dbError = new Error('DB Save Failed');
    vi.spyOn(repository, 'save').mockRejectedValue(dbError);

    await expect(useCase.execute('pkg', 'npm')).rejects.toThrow('DB Save Failed');
  });
});

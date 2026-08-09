import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBenchmarkSnapshotUseCase } from '@/application/use-cases/CreateBenchmarkSnapshotUseCase';
import { BenchmarkSnapshotRepository } from '@/application/interfaces/BenchmarkSnapshotRepository';
import { GitHubV1Adapter } from '@/infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '@/infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '@/infrastructure/registry/PyPIV1Adapter';

vi.mock('@/infrastructure/github/GitHubV1Adapter');
vi.mock('@/infrastructure/registry/NpmV1Adapter');
vi.mock('@/infrastructure/registry/PyPIV1Adapter');

// We mock BENCHMARK_DATASET to avoid doing 60 loops in tests.
vi.mock('@/infrastructure/benchmark/benchmark-data', () => ({
  BENCHMARK_DATASET: [
    { registry: 'npm', packageName: 'react', githubOwner: 'facebook', githubRepo: 'react', tier: 'Thriving', justification: 'test' },
    { registry: 'pypi', packageName: 'requests', githubOwner: 'psf', githubRepo: 'requests', tier: 'Thriving', justification: 'test' }
  ]
}));

describe('CreateBenchmarkSnapshotUseCase', () => {
  let repository: BenchmarkSnapshotRepository;
  let useCase: CreateBenchmarkSnapshotUseCase;
  let githubAdapter: GitHubV1Adapter;
  let npmAdapter: NpmV1Adapter;
  let pypiAdapter: PyPIV1Adapter;

  beforeEach(() => {
    repository = {
      getLatestSnapshot: vi.fn(),
      saveSnapshot: vi.fn(),
    };

    githubAdapter = new GitHubV1Adapter();
    npmAdapter = new NpmV1Adapter();
    pypiAdapter = new PyPIV1Adapter();

    useCase = new CreateBenchmarkSnapshotUseCase(repository, githubAdapter, npmAdapter, pypiAdapter);
  });

  it('successfully creates a snapshot by extracting populations', async () => {
    // Setup mock successful responses for Github and NPM
    vi.mocked(githubAdapter.getCommitCadence).mockResolvedValue({ status: 'success', metricName: 'commit_cadence', data: { commits52Weeks: 100 } });
    vi.mocked(githubAdapter.getContributorConcentration).mockResolvedValue({ status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 10, totalHumanCommits12Months: 100 } });
    vi.mocked(githubAdapter.getReleaseFrequency).mockResolvedValue({ status: 'success', metricName: 'release_frequency', data: { releases12Months: 12 } });
    vi.mocked(githubAdapter.getIssueResolutionHealth).mockResolvedValue({ status: 'success', metricName: 'issue_resolution_health', data: { openedIssues180Days: 10, closedIssues180Days: 8, medianDaysToClose180Days: 2 } });
    vi.mocked(githubAdapter.getDocumentationPresence).mockResolvedValue({ status: 'success', metricName: 'documentation_presence', data: { hasDocsFolder: true, hasHomepageUrl: true, readmeSizeBytes: 2000, fencedCodeBlockCount: 5 } });

    vi.mocked(npmAdapter.getDownloadMomentum).mockResolvedValue({ status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 200, prior30DayDownloads: 100, lowerConfidence: false } });
    vi.mocked(pypiAdapter.getDownloadMomentum).mockResolvedValue({ status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 400, prior30DayDownloads: 200, lowerConfidence: false } });

    await useCase.execute();

    expect(repository.saveSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      methodologyVersion: '1.0',
      populations: expect.objectContaining({
        commitCadence: [100, 100], // Called twice for the 2 mocked packages
      })
    }));
  });

  it('handles empty/insufficient metrics properly by omitting them (no zero-filling)', async () => {
    // One package fails, one succeeds
    vi.mocked(githubAdapter.getCommitCadence).mockResolvedValueOnce({ status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' })
                                              .mockResolvedValue({ status: 'success', metricName: 'commit_cadence', data: { commits52Weeks: 50 } });

    // The rest return unavailable
    vi.mocked(githubAdapter.getContributorConcentration).mockResolvedValue({ status: 'unavailable', metricName: 'contributor_concentration', reason: 'insufficient_data' });
    vi.mocked(githubAdapter.getReleaseFrequency).mockResolvedValue({ status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' });
    vi.mocked(githubAdapter.getIssueResolutionHealth).mockResolvedValue({ status: 'unavailable', metricName: 'issue_resolution_health', reason: 'insufficient_data' });
    vi.mocked(githubAdapter.getDocumentationPresence).mockResolvedValue({ status: 'unavailable', metricName: 'documentation_presence', reason: 'insufficient_data' });
    vi.mocked(npmAdapter.getDownloadMomentum).mockResolvedValue({ status: 'unavailable', metricName: 'download_momentum', reason: 'insufficient_data' });
    vi.mocked(pypiAdapter.getDownloadMomentum).mockResolvedValue({ status: 'unavailable', metricName: 'download_momentum', reason: 'insufficient_data' });

    await useCase.execute();

    expect(repository.saveSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      populations: expect.objectContaining({
        commitCadence: [50], // Only 1 entry, no 0-filling for the missing one
        contributorConcentration: [],
        releaseFrequency: []
      })
    }));
  });
});

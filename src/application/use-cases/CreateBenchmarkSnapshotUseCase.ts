import { BenchmarkSnapshotRepository } from '../interfaces/BenchmarkSnapshotRepository';
import { GitHubV1Adapter } from '../../infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '../../infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '../../infrastructure/registry/PyPIV1Adapter';
import { BENCHMARK_DATASET } from '../../infrastructure/benchmark/benchmark-data';
import { BenchmarkPopulationService } from '../../infrastructure/benchmark/BenchmarkPopulationService';
import { BenchmarkPackageMetrics } from '../../infrastructure/benchmark/types';
import {
  calculateCommitCadence,
  calculateContributorConcentration,
  calculateDocumentationPresence,
  calculateDownloadMomentum,
  calculateIssueResolutionHealth,
  calculateReleaseFrequency
} from '../../domain/services/metric-calculations';

export class CreateBenchmarkSnapshotUseCase {
  constructor(
    private readonly repository: BenchmarkSnapshotRepository,
    private readonly githubAdapter: GitHubV1Adapter = new GitHubV1Adapter(),
    private readonly npmAdapter: NpmV1Adapter = new NpmV1Adapter(),
    private readonly pypiAdapter: PyPIV1Adapter = new PyPIV1Adapter()
  ) {}

  async execute(): Promise<void> {
    const extractedMetrics: BenchmarkPackageMetrics[] = [];

    // Process sequentially to respect rate limits and avoid SignalCollectionService (M4-003)
    for (const entry of BENCHMARK_DATASET) {
      const metrics: BenchmarkPackageMetrics = {
        commitCadence: null,
        releaseFrequency: null,
        issueResolutionHealth: null,
        contributorConcentration: null,
        downloadMomentum: null,
        documentationPresence: null,
      };

      try {
        if (entry.githubOwner && entry.githubRepo) {
          const [cadence, concentration, releases, issues, docs] = await Promise.all([
            this.githubAdapter.getCommitCadence(entry.githubOwner, entry.githubRepo),
            this.githubAdapter.getContributorConcentration(entry.githubOwner, entry.githubRepo),
            this.githubAdapter.getReleaseFrequency(entry.githubOwner, entry.githubRepo),
            this.githubAdapter.getIssueResolutionHealth(entry.githubOwner, entry.githubRepo),
            this.githubAdapter.getDocumentationPresence(entry.githubOwner, entry.githubRepo)
          ]);

          if (cadence.status === 'success') metrics.commitCadence = calculateCommitCadence(cadence.data);
          if (concentration.status === 'success') metrics.contributorConcentration = calculateContributorConcentration(concentration.data);
          if (releases.status === 'success') metrics.releaseFrequency = calculateReleaseFrequency(releases.data);
          if (issues.status === 'success') metrics.issueResolutionHealth = calculateIssueResolutionHealth(issues.data);
          if (docs.status === 'success') metrics.documentationPresence = calculateDocumentationPresence(docs.data);
        }

        if (entry.registry === 'npm') {
          const downloads = await this.npmAdapter.getDownloadMomentum(entry.packageName);
          if (downloads.status === 'success') metrics.downloadMomentum = calculateDownloadMomentum(downloads.data).growth;
        } else if (entry.registry === 'pypi') {
          const downloads = await this.pypiAdapter.getDownloadMomentum(entry.packageName);
          if (downloads.status === 'success') metrics.downloadMomentum = calculateDownloadMomentum(downloads.data).growth;
        }
      } catch (e) {
        // Log explicitly, let individual metrics remain null as per M3 rules.
        console.error(`Failed to collect signals for benchmark package ${entry.packageName}:`, e);
      }

      extractedMetrics.push(metrics);
    }

    const populations = BenchmarkPopulationService.extractPopulations(extractedMetrics);

    await this.repository.saveSnapshot({
      methodologyVersion: '1.0',
      populations,
      updatedAt: new Date()
    });
  }
}

import { V1MetricSignals } from '../../domain/services/V1ScoringService';
import { MetricName } from '../../domain/types/metric-name';
import { CommitCadenceSignal, ContributorConcentrationSignal, DocumentationPresenceSignal, DownloadMomentumSignal, IssueResolutionHealthSignal, ReleaseFrequencySignal, SignalResult } from '../../domain/types/raw-signals';
import { Registry } from '../../domain/types/registry';
import { GitHubV1Adapter } from '../../infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '../../infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '../../infrastructure/registry/PyPIV1Adapter';

export class SignalCollectionService {
  constructor(
    private readonly githubAdapter: GitHubV1Adapter = new GitHubV1Adapter(),
    private readonly npmAdapter: NpmV1Adapter = new NpmV1Adapter(),
    private readonly pypiAdapter: PyPIV1Adapter = new PyPIV1Adapter(),
  ) {}

  async collectSignals(
    registry: Registry,
    packageName: string,
    githubOwner: string | null,
    githubRepo: string | null,
  ): Promise<V1MetricSignals> {
    const defaultGithubFailure = {
      status: 'unavailable' as const,
      reason: 'unsupported_or_unresolved' as const,
    };

    let pCommitCadence: Promise<SignalResult<CommitCadenceSignal>> = Promise.resolve({ ...defaultGithubFailure, metricName: 'commit_cadence' });
    let pReleaseFrequency: Promise<SignalResult<ReleaseFrequencySignal>> = Promise.resolve({ ...defaultGithubFailure, metricName: 'release_frequency' });
    let pIssueResolution: Promise<SignalResult<IssueResolutionHealthSignal>> = Promise.resolve({ ...defaultGithubFailure, metricName: 'issue_resolution_health' });
    let pContributorConcentration: Promise<SignalResult<ContributorConcentrationSignal>> = Promise.resolve({ ...defaultGithubFailure, metricName: 'contributor_concentration' });
    let pDocumentationPresence: Promise<SignalResult<DocumentationPresenceSignal>> = Promise.resolve({ ...defaultGithubFailure, metricName: 'documentation_presence' });

    if (githubOwner && githubRepo) {
      pCommitCadence = this.githubAdapter.getCommitCadence(githubOwner, githubRepo);
      pReleaseFrequency = this.githubAdapter.getReleaseFrequency(githubOwner, githubRepo);
      pIssueResolution = this.githubAdapter.getIssueResolutionHealth(githubOwner, githubRepo);
      pContributorConcentration = this.githubAdapter.getContributorConcentration(githubOwner, githubRepo);
      pDocumentationPresence = this.githubAdapter.getDocumentationPresence(githubOwner, githubRepo);
    }

    let pDownloadMomentum: Promise<SignalResult<DownloadMomentumSignal>> = Promise.resolve({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'unsupported_or_unresolved',
    });

    if (registry === 'npm') {
      pDownloadMomentum = this.npmAdapter.getDownloadMomentum(packageName);
    } else if (registry === 'pypi') {
      pDownloadMomentum = this.pypiAdapter.getDownloadMomentum(packageName);
    }

    const results = await Promise.allSettled([
      pCommitCadence,
      pReleaseFrequency,
      pIssueResolution,
      pContributorConcentration,
      pDownloadMomentum,
      pDocumentationPresence,
    ]);

    const resolveResult = <T>(
      result: PromiseSettledResult<T>,
      fallbackMetricName: MetricName
    ): T => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        status: 'unavailable',
        metricName: fallbackMetricName,
        reason: 'insufficient_data', // if it rejected, we map it to insufficient data
      } as unknown as T;
    };

    return {
      commitCadence: resolveResult(results[0], 'commit_cadence'),
      releaseFrequency: resolveResult(results[1], 'release_frequency'),
      issueResolutionHealth: resolveResult(results[2], 'issue_resolution_health'),
      contributorConcentration: resolveResult(results[3], 'contributor_concentration'),
      downloadMomentum: resolveResult(results[4], 'download_momentum'),
      documentationPresence: resolveResult(results[5], 'documentation_presence'),
    } as V1MetricSignals;
  }
}

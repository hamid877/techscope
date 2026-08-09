/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SignalCollectionService } from '../../../../application/services/SignalCollectionService';
import { GitHubV1Adapter } from '../../../../infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '../../../../infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '../../../../infrastructure/registry/PyPIV1Adapter';
import { SignalResult } from '../../../../domain/types/raw-signals';

describe('SignalCollectionService', () => {
  let githubAdapter: GitHubV1Adapter;
  let npmAdapter: NpmV1Adapter;
  let pypiAdapter: PyPIV1Adapter;
  let service: SignalCollectionService;

  beforeEach(() => {
    githubAdapter = new GitHubV1Adapter();
    npmAdapter = new NpmV1Adapter();
    pypiAdapter = new PyPIV1Adapter();
    service = new SignalCollectionService(githubAdapter, npmAdapter, pypiAdapter);
  });

  it('collects all signals successfully', async () => {
    vi.spyOn(githubAdapter, 'getCommitCadence').mockResolvedValue({ status: 'success', metricName: 'commit_cadence', data: { commits52Weeks: 10 } } as any);
    vi.spyOn(githubAdapter, 'getReleaseFrequency').mockResolvedValue({ status: 'success', metricName: 'release_frequency', data: { releases12Months: 2 } } as any);
    vi.spyOn(githubAdapter, 'getIssueResolutionHealth').mockResolvedValue({ status: 'success', metricName: 'issue_resolution_health', data: { openedIssues180Days: 5, closedIssues180Days: 5, medianDaysToClose180Days: 1 } } as any);
    vi.spyOn(githubAdapter, 'getContributorConcentration').mockResolvedValue({ status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 5, totalHumanCommits12Months: 10 } } as any);
    vi.spyOn(githubAdapter, 'getDocumentationPresence').mockResolvedValue({ status: 'success', metricName: 'documentation_presence', data: { readmeSizeBytes: 1000, hasHomepageUrl: true, hasDocsFolder: true, fencedCodeBlockCount: 2 } } as any);

    vi.spyOn(npmAdapter, 'getDownloadMomentum').mockResolvedValue({ status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 100, prior30DayDownloads: 50, lowerConfidence: false } } as any);

    const signals = await service.collectSignals('npm', 'test-pkg', 'owner', 'repo');

    expect(signals.commitCadence.status).toBe('success');
    expect(signals.releaseFrequency.status).toBe('success');
    expect(signals.issueResolutionHealth.status).toBe('success');
    expect(signals.contributorConcentration.status).toBe('success');
    expect(signals.documentationPresence.status).toBe('success');
    expect(signals.downloadMomentum.status).toBe('success');
  });

  it('gracefully handles one signal failure and continues', async () => {
    vi.spyOn(githubAdapter, 'getCommitCadence').mockRejectedValue(new Error('Network error'));
    vi.spyOn(githubAdapter, 'getReleaseFrequency').mockResolvedValue({ status: 'success', metricName: 'release_frequency', data: { releases12Months: 2 } } as any);
    // ...other mocks...
    vi.spyOn(githubAdapter, 'getIssueResolutionHealth').mockResolvedValue({ status: 'success', metricName: 'issue_resolution_health', data: { openedIssues180Days: 5, closedIssues180Days: 5, medianDaysToClose180Days: 1 } } as any);
    vi.spyOn(githubAdapter, 'getContributorConcentration').mockResolvedValue({ status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 5, totalHumanCommits12Months: 10 } } as any);
    vi.spyOn(githubAdapter, 'getDocumentationPresence').mockResolvedValue({ status: 'success', metricName: 'documentation_presence', data: { readmeSizeBytes: 1000, hasHomepageUrl: true, hasDocsFolder: true, fencedCodeBlockCount: 2 } } as any);
    vi.spyOn(npmAdapter, 'getDownloadMomentum').mockResolvedValue({ status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 100, prior30DayDownloads: 50, lowerConfidence: false } } as any);

    const signals = await service.collectSignals('npm', 'test-pkg', 'owner', 'repo');

    expect(signals.commitCadence).toEqual({ status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' });
    expect(signals.releaseFrequency.status).toBe('success');
  });

  it('handles multiple signal failures including domain-returned unavailabilities', async () => {
    vi.spyOn(githubAdapter, 'getCommitCadence').mockRejectedValue(new Error('Network error'));
    vi.spyOn(githubAdapter, 'getReleaseFrequency').mockResolvedValue({ status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' } as any);
    vi.spyOn(githubAdapter, 'getIssueResolutionHealth').mockResolvedValue({ status: 'unavailable', metricName: 'issue_resolution_health', reason: 'unsupported_or_unresolved' } as any);

    vi.spyOn(githubAdapter, 'getContributorConcentration').mockResolvedValue({ status: 'success', metricName: 'contributor_concentration', data: { topContributorCommits12Months: 5, totalHumanCommits12Months: 10 } } as any);
    vi.spyOn(githubAdapter, 'getDocumentationPresence').mockResolvedValue({ status: 'success', metricName: 'documentation_presence', data: { readmeSizeBytes: 1000, hasHomepageUrl: true, hasDocsFolder: true, fencedCodeBlockCount: 2 } } as any);
    vi.spyOn(npmAdapter, 'getDownloadMomentum').mockRejectedValue(new Error('Registry error'));

    const signals = await service.collectSignals('npm', 'test-pkg', 'owner', 'repo');

    expect(signals.commitCadence).toEqual({ status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' });
    expect(signals.releaseFrequency).toEqual({ status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' });
    expect(signals.issueResolutionHealth).toEqual({ status: 'unavailable', metricName: 'issue_resolution_health', reason: 'unsupported_or_unresolved' });
    expect(signals.downloadMomentum).toEqual({ status: 'unavailable', metricName: 'download_momentum', reason: 'insufficient_data' });
  });

  it('maps missing github owner/repo to unsupported for github signals', async () => {
    vi.spyOn(npmAdapter, 'getDownloadMomentum').mockResolvedValue({ status: 'success', metricName: 'download_momentum', data: { current30DayDownloads: 100, prior30DayDownloads: 50, lowerConfidence: false } } as any);

    const signals = await service.collectSignals('npm', 'test-pkg', null, null);

    expect(signals.commitCadence.status).toBe('unavailable');
    expect((signals.commitCadence as any).reason).toBe('unsupported_or_unresolved');

    expect(signals.downloadMomentum.status).toBe('success');
  });

});

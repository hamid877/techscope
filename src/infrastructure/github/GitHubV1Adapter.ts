import {
  SignalResult,
  CommitCadenceSignal,
  ReleaseFrequencySignal,
  IssueResolutionHealthSignal,
  ContributorConcentrationSignal,
  DocumentationPresenceSignal
} from '../../domain/types/raw-signals';
import { GitHubClient } from './GitHubClient';

interface ContributorStats {
  author: { login: string } | null;
  total: number;
  weeks: { w: number; a: number; d: number; c: number }[];
}

interface Issue {
  created_at: string;
  closed_at: string | null;
  pull_request?: Record<string, unknown>;
}

export class GitHubV1Adapter {
  private readonly botAllowlist = new Set(['dependabot', 'renovate', 'github-actions']);

  constructor(private readonly client: GitHubClient = new GitHubClient()) {}

  private isBot(login: string): boolean {
    return login.endsWith('[bot]') || this.botAllowlist.has(login);
  }

  async getCommitCadence(owner: string, repo: string): Promise<SignalResult<CommitCadenceSignal>> {
    const { status, data, isRateLimited } = await this.client.request<ContributorStats[]>(`/repos/${owner}/${repo}/stats/contributors`);
    
    if (status === 404) return { status: 'unavailable', metricName: 'commit_cadence', reason: 'unsupported_or_unresolved' };
    if (isRateLimited) return { status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' };
    if (status !== 200 || !data) return { status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' };

    const oneYearAgoSeconds = Math.floor(Date.now() / 1000) - (52 * 7 * 24 * 60 * 60);
    let commits52Weeks = 0;

    for (const contributor of data) {
      if (!contributor.author || this.isBot(contributor.author.login)) continue;

      for (const week of contributor.weeks) {
        if (week.w >= oneYearAgoSeconds) {
          commits52Weeks += week.c;
        }
      }
    }

    return {
      status: 'success',
      metricName: 'commit_cadence',
      data: { commits52Weeks }
    };
  }

  async getContributorConcentration(owner: string, repo: string): Promise<SignalResult<ContributorConcentrationSignal>> {
    const { status, data, isRateLimited } = await this.client.request<ContributorStats[]>(`/repos/${owner}/${repo}/stats/contributors`);
    
    if (status === 404) return { status: 'unavailable', metricName: 'contributor_concentration', reason: 'unsupported_or_unresolved' };
    if (isRateLimited) return { status: 'unavailable', metricName: 'contributor_concentration', reason: 'insufficient_data' };
    if (status !== 200 || !data) return { status: 'unavailable', metricName: 'contributor_concentration', reason: 'insufficient_data' };

    const oneYearAgoSeconds = Math.floor(Date.now() / 1000) - (52 * 7 * 24 * 60 * 60);
    
    let totalHumanCommits12Months = 0;
    let topContributorCommits12Months = 0;

    for (const contributor of data) {
      if (!contributor.author || this.isBot(contributor.author.login)) continue;

      let contributorCommits = 0;
      for (const week of contributor.weeks) {
        if (week.w >= oneYearAgoSeconds) {
          contributorCommits += week.c;
        }
      }

      totalHumanCommits12Months += contributorCommits;
      if (contributorCommits > topContributorCommits12Months) {
        topContributorCommits12Months = contributorCommits;
      }
    }

    if (totalHumanCommits12Months === 0) {
      return { status: 'unavailable', metricName: 'contributor_concentration', reason: 'insufficient_data' };
    }

    return {
      status: 'success',
      metricName: 'contributor_concentration',
      data: { topContributorCommits12Months, totalHumanCommits12Months }
    };
  }

  async getReleaseFrequency(owner: string, repo: string): Promise<SignalResult<ReleaseFrequencySignal>> {
    const { status, data, isRateLimited } = await this.client.paginate<{ draft: boolean; prerelease: boolean; published_at?: string; created_at: string }>(`/repos/${owner}/${repo}/releases`);
    
    if (status === 404) return { status: 'unavailable', metricName: 'release_frequency', reason: 'unsupported_or_unresolved' };
    if (isRateLimited) return { status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' };
    if (status !== 200 || !data) return { status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' };

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let releases12Months = 0;
    for (const release of data) {
      if (release.draft || release.prerelease) continue;
      
      const publishedAt = new Date(release.published_at || release.created_at);
      if (publishedAt >= oneYearAgo) {
        releases12Months++;
      }
    }

    return {
      status: 'success',
      metricName: 'release_frequency',
      data: { releases12Months }
    };
  }

  async getIssueResolutionHealth(owner: string, repo: string): Promise<SignalResult<IssueResolutionHealthSignal>> {
    const oneEightyDaysAgo = new Date();
    oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);
    const sinceParam = oneEightyDaysAgo.toISOString();

    const { status, data, isRateLimited } = await this.client.paginate<Issue>(`/repos/${owner}/${repo}/issues?state=all&since=${sinceParam}`);
    
    if (status === 404) return { status: 'unavailable', metricName: 'issue_resolution_health', reason: 'unsupported_or_unresolved' };
    if (isRateLimited) return { status: 'unavailable', metricName: 'issue_resolution_health', reason: 'insufficient_data' };
    if (status !== 200 || !data) return { status: 'unavailable', metricName: 'issue_resolution_health', reason: 'insufficient_data' };

    let openedIssues180Days = 0;
    let closedIssues180Days = 0;
    const daysToClose: number[] = [];

    for (const issue of data) {
      if (issue.pull_request) continue; // Exclude PRs

      const createdAt = new Date(issue.created_at);
      if (createdAt < oneEightyDaysAgo) continue; // Strictly filter created_at >= 180 days ago

      openedIssues180Days++;

      if (issue.closed_at) {
        closedIssues180Days++;
        const closedAt = new Date(issue.closed_at);
        const days = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        daysToClose.push(days);
      }
    }

    let medianDaysToClose180Days: number | null = null;
    if (daysToClose.length > 0) {
      daysToClose.sort((a, b) => a - b);
      const mid = Math.floor(daysToClose.length / 2);
      if (daysToClose.length % 2 === 0) {
        medianDaysToClose180Days = (daysToClose[mid - 1] + daysToClose[mid]) / 2;
      } else {
        medianDaysToClose180Days = daysToClose[mid];
      }
    }

    return {
      status: 'success',
      metricName: 'issue_resolution_health',
      data: {
        openedIssues180Days,
        closedIssues180Days,
        medianDaysToClose180Days
      }
    };
  }

  async getDocumentationPresence(owner: string, repo: string): Promise<SignalResult<DocumentationPresenceSignal>> {
    const repoRes = await this.client.request<{ homepage?: string }>(`/repos/${owner}/${repo}`);
    if (repoRes.status === 404) return { status: 'unavailable', metricName: 'documentation_presence', reason: 'unsupported_or_unresolved' };
    if (repoRes.isRateLimited) return { status: 'unavailable', metricName: 'documentation_presence', reason: 'insufficient_data' };
    if (repoRes.status !== 200) return { status: 'unavailable', metricName: 'documentation_presence', reason: 'insufficient_data' };
    
    const hasHomepageUrl = !!repoRes.data?.homepage;

    const readmeRes = await this.client.request<{ size: number; content: string; encoding: string }>(`/repos/${owner}/${repo}/readme`);
    let readmeSizeBytes: number | null = null;
    let fencedCodeBlockCount = 0;

    if (readmeRes.status === 200 && readmeRes.data) {
      readmeSizeBytes = readmeRes.data.size || 0;
      if (readmeRes.data.content && readmeRes.data.encoding === 'base64') {
        const content = Buffer.from(readmeRes.data.content, 'base64').toString('utf8');
        const matches = content.match(/```/g);
        fencedCodeBlockCount = matches ? Math.floor(matches.length / 2) : 0;
      }
    }

    const docsRes = await this.client.request<unknown>(`/repos/${owner}/${repo}/contents/docs`);
    const hasDocsFolder = docsRes.status === 200;

    return {
      status: 'success',
      metricName: 'documentation_presence',
      data: {
        readmeSizeBytes,
        hasHomepageUrl,
        hasDocsFolder,
        fencedCodeBlockCount
      }
    };
  }
}

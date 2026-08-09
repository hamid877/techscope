import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubV1Adapter } from '../../../../infrastructure/github/GitHubV1Adapter';
import { GitHubClient } from '../../../../infrastructure/github/GitHubClient';

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function createMockResponse(status: number, data: unknown, headers: Record<string, string> = {}): Response {
  if (data && typeof data === 'object') {
    headers['content-type'] = 'application/json';
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers(headers)
  } as unknown as Response;
}

describe('GitHubV1Adapter', () => {
  let adapter: GitHubV1Adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
    adapter = new GitHubV1Adapter(new GitHubClient());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCommitCadence', () => {
    it('returns unsupported_or_unresolved on 404', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(404, null));
      const result = await adapter.getCommitCadence('owner', 'repo');
      expect(result).toEqual({ status: 'unavailable', metricName: 'commit_cadence', reason: 'unsupported_or_unresolved' });
    });

    it('returns insufficient_data on non-200', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(500, null));
      const result = await adapter.getCommitCadence('owner', 'repo');
      expect(result).toEqual({ status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' });
    });

    it('calculates commit cadence excluding bots and old weeks', async () => {
      const now = Date.now();
      const currentWeekSecs = Math.floor(now / 1000);
      const oldWeekSecs = currentWeekSecs - (53 * 7 * 24 * 60 * 60);

      mockFetch.mockResolvedValueOnce(createMockResponse(200, [
        {
          author: { login: 'human' },
          total: 10,
          weeks: [{ w: currentWeekSecs, c: 5, a: 0, d: 0 }, { w: oldWeekSecs, c: 5, a: 0, d: 0 }]
        },
        {
          author: { login: 'some[bot]' },
          total: 10,
          weeks: [{ w: currentWeekSecs, c: 10, a: 0, d: 0 }]
        },
        {
          author: { login: 'dependabot' },
          total: 10,
          weeks: [{ w: currentWeekSecs, c: 10, a: 0, d: 0 }]
        }
      ]));

      const result = await adapter.getCommitCadence('owner', 'repo');
      expect(result).toEqual({
        status: 'success',
        metricName: 'commit_cadence',
        data: { commits52Weeks: 5 }
      });
    });
  });

  describe('getContributorConcentration', () => {
    it('returns insufficient_data if total human commits is 0', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, [
        {
          author: { login: 'some[bot]' },
          total: 10,
          weeks: [{ w: Math.floor(Date.now() / 1000), c: 10, a: 0, d: 0 }]
        }
      ]));

      const result = await adapter.getContributorConcentration('owner', 'repo');
      expect(result).toEqual({ status: 'unavailable', metricName: 'contributor_concentration', reason: 'insufficient_data' });
    });

    it('calculates concentration based on human commits', async () => {
      const currentWeekSecs = Math.floor(Date.now() / 1000);

      mockFetch.mockResolvedValueOnce(createMockResponse(200, [
        {
          author: { login: 'human1' },
          total: 10,
          weeks: [{ w: currentWeekSecs, c: 10, a: 0, d: 0 }]
        },
        {
          author: { login: 'human2' },
          total: 5,
          weeks: [{ w: currentWeekSecs, c: 5, a: 0, d: 0 }]
        }
      ]));

      const result = await adapter.getContributorConcentration('owner', 'repo');
      expect(result).toEqual({
        status: 'success',
        metricName: 'contributor_concentration',
        data: { topContributorCommits12Months: 10, totalHumanCommits12Months: 15 }
      });
    });
  });

  describe('getReleaseFrequency', () => {
    it('handles pagination and filters prerelease/draft/old releases', async () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 1000).toISOString();
      const old = new Date(now.getTime() - (2 * 365 * 24 * 60 * 60 * 1000)).toISOString();

      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, [
          { published_at: recent, draft: false, prerelease: false },
          { published_at: recent, draft: true, prerelease: false },
          { published_at: recent, draft: false, prerelease: true }
        ], { link: '<https://api.github.com/repos/owner/repo/releases?page=2>; rel="next"' }))
        .mockResolvedValueOnce(createMockResponse(200, [
          { published_at: old, draft: false, prerelease: false }
        ]));

      const result = await adapter.getReleaseFrequency('owner', 'repo');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        status: 'success',
        metricName: 'release_frequency',
        data: { releases12Months: 1 }
      });
    });

    it('propagates failure and discards partial results on second page error', async () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 1000).toISOString();

      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, [
          { published_at: recent, draft: false, prerelease: false }
        ], { link: '<https://api.github.com/repos/owner/repo/releases?page=2>; rel="next"' }))
        .mockResolvedValueOnce(createMockResponse(500, null));

      const result = await adapter.getReleaseFrequency('owner', 'repo');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        status: 'unavailable',
        metricName: 'release_frequency',
        reason: 'insufficient_data'
      });
    });
  });

  describe('getIssueResolutionHealth', () => {
    it('filters PRs, old issues, and calculates median', async () => {
      const now = new Date();
      const recentOpen = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000)).toISOString();
      const recentClosed1 = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000)).toISOString(); // closed after 9 days
      const recentClosed2 = new Date(now.getTime() - (8 * 24 * 60 * 60 * 1000)).toISOString(); // closed after 2 days
      const recentClosed3 = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)).toISOString(); // closed after 5 days
      const old = new Date(now.getTime() - (200 * 24 * 60 * 60 * 1000)).toISOString();

      mockFetch.mockResolvedValueOnce(createMockResponse(200, [
        { created_at: recentOpen, closed_at: recentClosed1 },
        { created_at: recentOpen, closed_at: recentClosed2 },
        { created_at: recentOpen, closed_at: recentClosed3 },
        { created_at: recentOpen, closed_at: null }, // Open issue
        { created_at: recentOpen, closed_at: recentClosed1, pull_request: {} }, // Exclude PR
        { created_at: old, closed_at: recentClosed1 } // Exclude strictly created older than 180 days
      ]));

      const result = await adapter.getIssueResolutionHealth('owner', 'repo');
      // Medians: 2, 5, 9 -> median is 5
      expect(result).toEqual({
        status: 'success',
        metricName: 'issue_resolution_health',
        data: {
          openedIssues180Days: 4,
          closedIssues180Days: 3,
          medianDaysToClose180Days: 5
        }
      });
    });

    it('returns median as null if 0 opened issues', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, []));
      const result = await adapter.getIssueResolutionHealth('owner', 'repo');
      expect(result).toEqual({
        status: 'success',
        metricName: 'issue_resolution_health',
        data: {
          openedIssues180Days: 0,
          closedIssues180Days: 0,
          medianDaysToClose180Days: null
        }
      });
    });
  });

  describe('getDocumentationPresence', () => {
    it('returns true/false based on independent fetches', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(200, { homepage: 'https://example.com' })) // Repo metadata
        .mockResolvedValueOnce(createMockResponse(200, { size: 2000, encoding: 'base64', content: Buffer.from('```ts\nconst x = 1;\n```').toString('base64') })) // Readme
        .mockResolvedValueOnce(createMockResponse(404, null)); // Docs folder missing

      const result = await adapter.getDocumentationPresence('owner', 'repo');
      expect(result).toEqual({
        status: 'success',
        metricName: 'documentation_presence',
        data: {
          hasHomepageUrl: true,
          readmeSizeBytes: 2000,
          fencedCodeBlockCount: 1,
          hasDocsFolder: false
        }
      });
    });
    
    it('returns unsupported_or_unresolved if repo metadata 404s', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(404, null));
      const result = await adapter.getDocumentationPresence('owner', 'repo');
      expect(result).toEqual({ status: 'unavailable', metricName: 'documentation_presence', reason: 'unsupported_or_unresolved' });
    });
  });

  describe('GitHubClient Rate Limits and Retries', () => {
    it('retries on 202 Accepted', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(202, null))
        .mockResolvedValueOnce(createMockResponse(200, []));

      const p = adapter.getCommitCadence('owner', 'repo');
      
      // Fast forward the first 1000ms delay
      await vi.runAllTimersAsync();
      
      const result = await p;
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        status: 'success',
        metricName: 'commit_cadence',
        data: { commits52Weeks: 0 }
      });
    });

    it('returns insufficient_data on rate limit 403', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(403, null, {
        'x-ratelimit-remaining': '0'
      }));

      const result = await adapter.getCommitCadence('owner', 'repo');
      expect(result).toEqual({
        status: 'unavailable',
        metricName: 'commit_cadence',
        reason: 'insufficient_data'
      });
    });
  });
});

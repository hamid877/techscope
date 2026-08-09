import { describe, it, expect } from 'vitest';
import { extractGitHubRepo } from '../../../../infrastructure/registry/PackageResolver';

describe('extractGitHubRepo', () => {
  it('succeeds for a valid github.com URL', () => {
    expect(extractGitHubRepo('https://github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(extractGitHubRepo('git+https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(extractGitHubRepo('git://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(extractGitHubRepo('git@github.com:owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('succeeds for www.github.com', () => {
    expect(extractGitHubRepo('https://www.github.com/owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('rejects URLs where github.com is in the path of another host', () => {
    expect(extractGitHubRepo('https://example.com/github.com/owner/repo')).toBeNull();
  });

  it('rejects URLs with github.com only in query or path', () => {
    expect(extractGitHubRepo('https://example.com?q=github.com/owner/repo')).toBeNull();
    expect(extractGitHubRepo('https://example.com/some/path?repo=github.com/owner/repo')).toBeNull();
  });

  it('rejects malformed URLs', () => {
    expect(extractGitHubRepo('just-some-random-string')).toBeNull();
    expect(extractGitHubRepo('https://github.com')).toBeNull(); // missing owner/repo
    expect(extractGitHubRepo('https://github.com/owner-only')).toBeNull(); // missing repo
    expect(extractGitHubRepo('https://github.com.evil.com/owner/repo')).toBeNull(); // bad host
  });
});

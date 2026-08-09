import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NpmPackageResolver } from '../../../../infrastructure/registry/NpmPackageResolver';

describe('NpmPackageResolver', () => {
  let resolver: NpmPackageResolver;

  beforeEach(() => {
    resolver = new NpmPackageResolver();
    global.fetch = vi.fn();
  });

  const mockResponse = (data: unknown, ok: boolean = true) => {
    (global.fetch as Mock).mockResolvedValue({
      ok,
      json: async () => data
    });
  };

  it('normalizes normal repository object', async () => {
    mockResponse({ repository: { type: 'git', url: 'https://github.com/owner/repo.git' } });
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({
      registry: 'npm',
      packageName: 'mypackage',
      owner: 'owner',
      repo: 'repo',
      repositoryUrl: 'https://github.com/owner/repo'
    });
  });

  it('normalizes repository string', async () => {
    mockResponse({ repository: 'https://github.com/owner/repo' });
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({
      registry: 'npm',
      packageName: 'mypackage',
      owner: 'owner',
      repo: 'repo',
      repositoryUrl: 'https://github.com/owner/repo'
    });
  });

  it('normalizes git+https URL', async () => {
    mockResponse({ repository: { url: 'git+https://github.com/owner/repo.git' } });
    const result = await resolver.resolvePackage('mypackage');
    if ('owner' in result) {
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    } else {
      expect.fail('Expected successful resolution');
    }
  });

  it('normalizes git:// URL', async () => {
    mockResponse({ repository: { url: 'git://github.com/owner/repo.git' } });
    const result = await resolver.resolvePackage('mypackage');
    if ('owner' in result) {
      expect(result.owner).toBe('owner');
    } else {
      expect.fail('Expected successful resolution');
    }
  });

  it('normalizes SSH GitHub URL', async () => {
    mockResponse({ repository: { url: 'git@github.com:owner/repo.git' } });
    const result = await resolver.resolvePackage('mypackage');
    if ('owner' in result) {
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    } else {
      expect.fail('Expected successful resolution');
    }
  });

  it('correctly URL-encodes scoped package names', async () => {
    mockResponse({ repository: 'https://github.com/owner/repo' });
    await resolver.resolvePackage('@babel/core');
    expect(global.fetch).toHaveBeenCalledWith('https://registry.npmjs.org/%40babel%2Fcore');
  });

  it('returns unsupported_or_unresolved for missing repository metadata', async () => {
    mockResponse({});
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
  });

  it('returns unsupported_or_unresolved for non-GitHub repository', async () => {
    mockResponse({ repository: 'https://gitlab.com/owner/repo' });
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
  });

  it('returns unsupported_or_unresolved on 404', async () => {
    mockResponse({}, false);
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
  });

  it('returns unsupported_or_unresolved for malformed metadata', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('parse error'); }
    });
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
  });
});

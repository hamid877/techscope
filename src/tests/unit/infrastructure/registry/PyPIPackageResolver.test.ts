import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { PyPIPackageResolver } from '../../../../infrastructure/registry/PyPIPackageResolver';

describe('PyPIPackageResolver', () => {
  let resolver: PyPIPackageResolver;

  beforeEach(() => {
    resolver = new PyPIPackageResolver();
    global.fetch = vi.fn();
  });

  const mockResponse = (data: unknown, ok: boolean = true) => {
    (global.fetch as Mock).mockResolvedValue({
      ok,
      json: async () => data
    });
  };

  it('finds GitHub repository from project URLs (Source)', async () => {
    mockResponse({
      info: {
        project_urls: {
          'Source Code': 'https://github.com/owner/repo'
        }
      }
    });
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({
      registry: 'pypi',
      packageName: 'mypackage',
      owner: 'owner',
      repo: 'repo',
      repositoryUrl: 'https://github.com/owner/repo'
    });
  });

  it('normalizes GitHub URL', async () => {
    mockResponse({
      info: {
        project_url: 'git+https://github.com/owner/repo.git'
      }
    });
    const result = await resolver.resolvePackage('mypackage');
    if ('owner' in result) {
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    } else {
      expect.fail('Expected successful resolution');
    }
  });

  it('prefers GitHub URL from source/repository over other GitHub URLs', async () => {
    mockResponse({
      info: {
        project_urls: {
          'Documentation': 'https://github.com/owner/docs-repo',
          'Repository': 'https://github.com/owner/actual-repo'
        }
      }
    });
    const result = await resolver.resolvePackage('mypackage');
    if ('repo' in result) {
      expect(result.repo).toBe('actual-repo');
    } else {
      expect.fail('Expected successful resolution');
    }
  });

  it('returns unsupported_or_unresolved if no GitHub URL', async () => {
    mockResponse({
      info: {
        project_urls: {
          'Homepage': 'https://example.com'
        }
      }
    });
    const result = await resolver.resolvePackage('mypackage');
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
  });

  it('returns unsupported_or_unresolved for non-GitHub project URL', async () => {
    mockResponse({
      info: {
        project_urls: {
          'Source': 'https://gitlab.com/owner/repo'
        }
      }
    });
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

  it('correctly URL-encodes package name', async () => {
    mockResponse({ info: { home_page: 'https://github.com/owner/repo' } });
    await resolver.resolvePackage('my-package');
    expect(global.fetch).toHaveBeenCalledWith('https://pypi.org/pypi/my-package/json');
  });
});

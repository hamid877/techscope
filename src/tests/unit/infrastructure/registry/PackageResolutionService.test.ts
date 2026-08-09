import { describe, it, expect, vi } from 'vitest';
import { PackageResolutionService } from '../../../../infrastructure/registry/PackageResolutionService';
import { PackageResolver, ResolutionResult } from '../../../../infrastructure/registry/PackageResolver';

class MockResolver implements PackageResolver {
  async resolvePackage(packageName: string): Promise<ResolutionResult> {
    if (packageName === 'fail') {
      return { score: null, reason: 'unsupported_or_unresolved' };
    }
    return {
      registry: 'npm',
      packageName,
      owner: 'mockowner',
      repo: 'mockrepo',
      repositoryUrl: 'https://github.com/mockowner/mockrepo'
    };
  }
}

describe('PackageResolutionService', () => {
  it('correctly dispatches npm', async () => {
    const npmResolver = new MockResolver();
    const pypiResolver = new MockResolver();
    const npmSpy = vi.spyOn(npmResolver, 'resolvePackage');
    const pypiSpy = vi.spyOn(pypiResolver, 'resolvePackage');
    
    const service = new PackageResolutionService(npmResolver, pypiResolver);
    const result = await service.resolve('mypackage', 'npm');
    
    expect(npmSpy).toHaveBeenCalledWith('mypackage');
    expect(pypiSpy).not.toHaveBeenCalled();
    if ('owner' in result) {
      expect(result.owner).toBe('mockowner');
    } else {
      expect.fail('Expected successful resolution');
    }
  });

  it('correctly dispatches PyPI', async () => {
    const npmResolver = new MockResolver();
    const pypiResolver = new MockResolver();
    const npmSpy = vi.spyOn(npmResolver, 'resolvePackage');
    const pypiSpy = vi.spyOn(pypiResolver, 'resolvePackage');
    
    const service = new PackageResolutionService(npmResolver, pypiResolver);
    await service.resolve('mypackage', 'pypi');
    
    expect(pypiSpy).toHaveBeenCalledWith('mypackage');
    expect(npmSpy).not.toHaveBeenCalled();
  });

  it('propagates successful normalized repository identity', async () => {
    const service = new PackageResolutionService(new MockResolver(), new MockResolver());
    const result = await service.resolve('good-package', 'npm');
    expect(result).toHaveProperty('owner', 'mockowner');
  });

  it('propagates unsupported_or_unresolved', async () => {
    const service = new PackageResolutionService(new MockResolver(), new MockResolver());
    const result = await service.resolve('fail', 'npm');
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
  });
  
  it('does not silently fall back between registries', async () => {
    const npmResolver = new MockResolver();
    const pypiResolver = new MockResolver();
    vi.spyOn(npmResolver, 'resolvePackage').mockResolvedValue({ score: null, reason: 'unsupported_or_unresolved' });
    const pypiSpy = vi.spyOn(pypiResolver, 'resolvePackage');
    
    const service = new PackageResolutionService(npmResolver, pypiResolver);
    const result = await service.resolve('mypackage', 'npm');
    
    expect(result).toEqual({ score: null, reason: 'unsupported_or_unresolved' });
    expect(pypiSpy).not.toHaveBeenCalled();
  });
});

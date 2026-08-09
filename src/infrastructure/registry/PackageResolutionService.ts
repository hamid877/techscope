import { Registry } from '../../domain/types/registry';
import { PackageResolver, ResolutionResult } from './PackageResolver';
import { NpmPackageResolver } from './NpmPackageResolver';
import { PyPIPackageResolver } from './PyPIPackageResolver';

export class PackageResolutionService {
  private npmResolver: PackageResolver;
  private pypiResolver: PackageResolver;

  constructor(
    npmResolver?: PackageResolver,
    pypiResolver?: PackageResolver
  ) {
    this.npmResolver = npmResolver ?? new NpmPackageResolver();
    this.pypiResolver = pypiResolver ?? new PyPIPackageResolver();
  }

  async resolve(packageName: string, registry: Registry): Promise<ResolutionResult> {
    if (registry === 'npm') {
      return this.npmResolver.resolvePackage(packageName);
    } else if (registry === 'pypi') {
      return this.pypiResolver.resolvePackage(packageName);
    }
    
    return { score: null, reason: 'unsupported_or_unresolved' };
  }
}

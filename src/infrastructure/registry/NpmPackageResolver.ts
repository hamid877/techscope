import { PackageResolver, ResolutionResult, extractGitHubRepo } from './PackageResolver';

export class NpmPackageResolver implements PackageResolver {
  async resolvePackage(packageName: string): Promise<ResolutionResult> {
    try {
      const encodedPackage = encodeURIComponent(packageName);
      const url = `https://registry.npmjs.org/${encodedPackage}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return { score: null, reason: 'unsupported_or_unresolved' };
      }
      
      const data = await response.json();
      
      let repoUrl = '';
      if (data.repository) {
        if (typeof data.repository === 'string') {
          repoUrl = data.repository;
        } else if (typeof data.repository === 'object' && data.repository.url) {
          repoUrl = data.repository.url;
        }
      }
      
      if (!repoUrl) {
        return { score: null, reason: 'unsupported_or_unresolved' };
      }
      
      const githubRepo = extractGitHubRepo(repoUrl);
      if (githubRepo) {
        return {
          registry: 'npm',
          packageName,
          owner: githubRepo.owner,
          repo: githubRepo.repo,
          repositoryUrl: `https://github.com/${githubRepo.owner}/${githubRepo.repo}`
        };
      }
      
      return { score: null, reason: 'unsupported_or_unresolved' };
    } catch {
      return { score: null, reason: 'unsupported_or_unresolved' };
    }
  }
}

import { PackageResolver, ResolutionResult, extractGitHubRepo } from './PackageResolver';

export class PyPIPackageResolver implements PackageResolver {
  async resolvePackage(packageName: string): Promise<ResolutionResult> {
    try {
      const encodedPackage = encodeURIComponent(packageName);
      const url = `https://pypi.org/pypi/${encodedPackage}/json`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return { score: null, reason: 'unsupported_or_unresolved' };
      }
      
      const data = await response.json();
      const info = data.info || {};
      const urlsToInspect: string[] = [];
      
      if (info.project_urls) {
        // Prefer explicit Source/Repository links over arbitrary project URLs
        for (const [key, val] of Object.entries(info.project_urls)) {
          if (typeof val !== 'string') continue;
          
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('source') || lowerKey.includes('repositor') || lowerKey.includes('code')) {
            urlsToInspect.unshift(val);
          } else {
            urlsToInspect.push(val);
          }
        }
      }
      
      if (info.project_url && typeof info.project_url === 'string') {
        urlsToInspect.push(info.project_url);
      }
      
      if (info.home_page && typeof info.home_page === 'string') {
        urlsToInspect.push(info.home_page);
      }
      
      for (const u of urlsToInspect) {
        const githubRepo = extractGitHubRepo(u);
        if (githubRepo) {
          return {
            registry: 'pypi',
            packageName,
            owner: githubRepo.owner,
            repo: githubRepo.repo,
            repositoryUrl: `https://github.com/${githubRepo.owner}/${githubRepo.repo}`
          };
        }
      }
      
      return { score: null, reason: 'unsupported_or_unresolved' };
    } catch {
      return { score: null, reason: 'unsupported_or_unresolved' };
    }
  }
}

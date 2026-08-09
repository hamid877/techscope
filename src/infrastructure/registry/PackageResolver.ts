import { Registry } from '../../domain/types/registry';

export interface ResolutionSuccess {
  registry: Registry;
  packageName: string;
  owner: string;
  repo: string;
  repositoryUrl: string;
}

export interface ResolutionFailure {
  score: null;
  reason: "unsupported_or_unresolved";
}

export type ResolutionResult = ResolutionSuccess | ResolutionFailure;

export interface PackageResolver {
  resolvePackage(packageName: string): Promise<ResolutionResult>;
}

export function extractGitHubRepo(url: string): { owner: string; repo: string } | null {
  if (typeof url !== 'string') return null;

  const trimmedUrl = url.trim();

  // Strictly validates github.com hostname and extracts owner/repo.
  // Handles common GitHub URL formats:
  // https://github.com/owner/repo
  // git+https://github.com/owner/repo.git
  // git://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  const regex = /^(?:(?:git\+https?:\/\/|https?:\/\/|git:\/\/|git@))?(?:www\.)?github\.com[:/]([^/]+)\/([^/]+?)(?:\.git|\/|#|\?|$)/;
  const match = trimmedUrl.match(regex);
  
  if (match) {
    return {
      owner: match[1],
      repo: match[2]
    };
  }
  
  return null;
}

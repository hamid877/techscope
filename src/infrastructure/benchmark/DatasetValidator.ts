import { BenchmarkEntry, BenchmarkTier } from './types';

export class DatasetValidator {
  public static validateEntry(entry: BenchmarkEntry): string[] {
    const errors: string[] = [];

    const validRegistries = ['npm', 'pypi'];
    if (!validRegistries.includes(entry.registry)) {
      errors.push(`Invalid registry: ${entry.registry}`);
    }

    const validTiers = ['Thriving', 'Stable', 'Declining', 'Abandoned'];
    if (!validTiers.includes(entry.tier)) {
      errors.push(`Invalid tier: ${entry.tier}`);
    }

    if (!entry.packageName || entry.packageName.trim() === '') {
      errors.push('Package name cannot be empty');
    }

    if (!entry.justification || entry.justification.trim() === '') {
      errors.push('Justification cannot be empty');
    }

    if ('githubOwner' in entry || 'githubRepo' in entry) {
      if (!entry.githubOwner || entry.githubOwner.trim() === '') {
        errors.push('GitHub owner cannot be empty if specified');
      }
      if (!entry.githubRepo || entry.githubRepo.trim() === '') {
        errors.push('GitHub repository cannot be empty if specified');
      }

      const githubIdRegex = /^[a-zA-Z0-9_.-]+$/;
      if (entry.githubOwner && !githubIdRegex.test(entry.githubOwner)) {
        errors.push(`Malformed GitHub owner: ${entry.githubOwner}`);
      }
      if (entry.githubRepo && !githubIdRegex.test(entry.githubRepo)) {
        errors.push(`Malformed GitHub repo: ${entry.githubRepo}`);
      }
    }

    return errors;
  }

  public static validateDatasetReadiness(dataset: BenchmarkEntry[]): string[] {
    const errors: string[] = [];

    if (!(dataset.length >= 50 && dataset.length <= 100)) {
      errors.push(`Dataset size must be between 50 and 100 entries. Current size: ${dataset.length}`);
    }

    const tiersPresent = new Set(dataset.map(e => e.tier));
    const requiredTiers = ['Thriving', 'Stable', 'Declining', 'Abandoned'];
    for (const tier of requiredTiers) {
      if (!tiersPresent.has(tier as BenchmarkTier)) {
        errors.push(`Missing required tier: ${tier}`);
      }
    }

    for (let i = 0; i < dataset.length; i++) {
      const entry = dataset[i];
      if (!entry.githubOwner || !entry.githubRepo) {
        errors.push(`Entry at index ${i} (${entry.registry}/${entry.packageName}) is missing required GitHub coordinates for final benchmark readiness.`);
      }
    }

    return errors;
  }

  public static validateDataset(dataset: BenchmarkEntry[]): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < dataset.length; i++) {
      const entry = dataset[i];
      const entryErrors = this.validateEntry(entry);
      if (entryErrors.length > 0) {
        errors.push(`Entry at index ${i} (${entry.registry}/${entry.packageName}) has errors: ${entryErrors.join(', ')}`);
      }

      const key = `${entry.registry}:${entry.packageName}`;
      if (seen.has(key)) {
        errors.push(`Duplicate package found: ${entry.registry}/${entry.packageName}`);
      }
      seen.add(key);
    }

    return errors;
  }
}

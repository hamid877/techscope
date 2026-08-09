import { Registry } from '../../domain/types/registry';
import { IssueResolutionHealthRawValue } from '../../domain/services/metric-calculations';

export type BenchmarkTier = 'Thriving' | 'Stable' | 'Declining' | 'Abandoned';

export interface BenchmarkEntry {
  registry: Registry;
  packageName: string;
  githubOwner?: string;
  githubRepo?: string;
  tier: BenchmarkTier;
  justification: string;
}

export interface BenchmarkPackageMetrics {
  commitCadence: number | null;
  releaseFrequency: number | null;
  issueResolutionHealth: IssueResolutionHealthRawValue | null;
  contributorConcentration: number | null;
  downloadMomentum: number | null;
  documentationPresence: number | null;
}

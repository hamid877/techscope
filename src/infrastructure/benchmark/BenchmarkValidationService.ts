import { BenchmarkEntry, BenchmarkTier } from './types';
import { calculateSpearmanCorrelation } from '../../domain/services/SpearmanCorrelation';

export type ValidationResult = 
  | { status: 'valid'; sampleSize: number; rho: number }
  | { status: 'insufficient_data'; sampleSize: number; rho: null };

export interface ScoredBenchmarkEntry extends BenchmarkEntry {
  healthScore: number;
}

const TIER_ORDINALS: Record<BenchmarkTier, number> = {
  'Abandoned': 0,
  'Declining': 1,
  'Stable': 2,
  'Thriving': 3
};

export class BenchmarkValidationService {
  /**
   * Validates the benchmark scoring by computing Spearman's rho between 
   * curated tier ordinals and calculated health scores.
   * 
   * Returns valid status with rho only if there is sufficient data and variance.
   * Never fabricates data.
   */
  public validate(entries: ScoredBenchmarkEntry[]): ValidationResult {
    const sampleSize = entries.length;
    
    if (sampleSize <= 1) {
      return { status: 'insufficient_data', sampleSize, rho: null };
    }

    const x = entries.map(e => TIER_ORDINALS[e.tier]);
    const y = entries.map(e => e.healthScore);

    const rho = calculateSpearmanCorrelation(x, y);

    if (rho === null) {
      return { status: 'insufficient_data', sampleSize, rho: null };
    }

    return { status: 'valid', sampleSize, rho };
  }
}

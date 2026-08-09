import { describe, expect, it } from 'vitest';
import { BenchmarkValidationService, ScoredBenchmarkEntry } from '../../../../infrastructure/benchmark/BenchmarkValidationService';

describe('BenchmarkValidationService', () => {
  const service = new BenchmarkValidationService();

  const createEntry = (tier: 'Abandoned' | 'Declining' | 'Stable' | 'Thriving', score: number): ScoredBenchmarkEntry => ({
    registry: 'npm',
    packageName: 'test-pkg',
    tier,
    justification: 'test',
    healthScore: score
  });

  it('returns positive rho when thriving scores higher than declining/abandoned', () => {
    const entries: ScoredBenchmarkEntry[] = [
      createEntry('Abandoned', 10),
      createEntry('Declining', 30),
      createEntry('Stable', 60),
      createEntry('Thriving', 90)
    ];

    const result = service.validate(entries);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.rho).toBe(1);
      expect(result.sampleSize).toBe(4);
    }
  });

  it('returns negative rho for inverse relationship', () => {
    const entries: ScoredBenchmarkEntry[] = [
      createEntry('Abandoned', 90),
      createEntry('Declining', 60),
      createEntry('Stable', 30),
      createEntry('Thriving', 10)
    ];

    const result = service.validate(entries);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.rho).toBe(-1);
    }
  });

  it('returns insufficient_data for empty benchmark', () => {
    const result = service.validate([]);
    expect(result).toEqual({ status: 'insufficient_data', sampleSize: 0, rho: null });
  });

  it('returns insufficient_data for one benchmark', () => {
    const result = service.validate([createEntry('Stable', 50)]);
    expect(result).toEqual({ status: 'insufficient_data', sampleSize: 1, rho: null });
  });

  it('returns insufficient_data for constant tier values', () => {
    const entries = [
      createEntry('Stable', 10),
      createEntry('Stable', 50),
      createEntry('Stable', 90)
    ];
    const result = service.validate(entries);
    expect(result).toEqual({ status: 'insufficient_data', sampleSize: 3, rho: null });
  });

  it('returns insufficient_data for constant scores', () => {
    const entries = [
      createEntry('Abandoned', 50),
      createEntry('Stable', 50),
      createEntry('Thriving', 50)
    ];
    const result = service.validate(entries);
    expect(result).toEqual({ status: 'insufficient_data', sampleSize: 3, rho: null });
  });

  it('handles ties correctly', () => {
    const entries: ScoredBenchmarkEntry[] = [
      createEntry('Abandoned', 10),
      createEntry('Stable', 60),
      createEntry('Stable', 60),
      createEntry('Thriving', 90)
    ];
    const result = service.validate(entries);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.rho).toBe(1); // identical increasing ranks
    }
  });
  
  it('tier ordering is exactly: abandoned = 0, declining = 1, stable = 2, thriving = 3', () => {
    // If we map scores 0, 1, 2, 3 respectively, we should get rho = 1
    const entries: ScoredBenchmarkEntry[] = [
      createEntry('Abandoned', 0),
      createEntry('Declining', 1),
      createEntry('Stable', 2),
      createEntry('Thriving', 3)
    ];
    const result = service.validate(entries);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.rho).toBe(1);
    }
  });
});

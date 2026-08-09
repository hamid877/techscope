import { describe, expect, it } from 'vitest';
import { calculateSpearmanCorrelation } from '../../../domain/services/SpearmanCorrelation';

describe('SpearmanCorrelation', () => {
  it('returns 1 for perfect positive correlation', () => {
    expect(calculateSpearmanCorrelation([1, 2, 3], [10, 20, 30])).toBeCloseTo(1);
  });

  it('returns -1 for perfect negative correlation', () => {
    expect(calculateSpearmanCorrelation([1, 2, 3], [30, 20, 10])).toBeCloseTo(-1);
  });

  it('returns known non-perfect correlation', () => {
    // Pearson of ranks:
    // x: [1, 2, 3, 4, 5] -> ranks: [1, 2, 3, 4, 5]
    // y: [2, 1, 4, 5, 3] -> ranks: [2, 1, 4, 5, 3]
    // rho = 0.6
    expect(calculateSpearmanCorrelation([1, 2, 3, 4, 5], [2, 1, 4, 5, 3])).toBeCloseTo(0.6);
  });

  it('handles ties using average ranks', () => {
    // x: [1, 2, 2, 3] -> ranks: [1, 2.5, 2.5, 4]
    // y: [1, 2, 3, 4] -> ranks: [1, 2, 3, 4]
    const result = calculateSpearmanCorrelation([1, 2, 2, 3], [1, 2, 3, 4]);
    expect(result).toBeDefined();
    expect(result!).toBeCloseTo(0.94868);
  });

  it('returns null for unequal lengths', () => {
    expect(calculateSpearmanCorrelation([1, 2], [1, 2, 3])).toBeNull();
  });

  it('returns null for empty arrays', () => {
    expect(calculateSpearmanCorrelation([], [])).toBeNull();
  });

  it('returns null for one observation', () => {
    expect(calculateSpearmanCorrelation([1], [1])).toBeNull();
  });

  it('returns null for constant x (zero variance)', () => {
    expect(calculateSpearmanCorrelation([2, 2, 2], [1, 2, 3])).toBeNull();
  });

  it('returns null for constant y (zero variance)', () => {
    expect(calculateSpearmanCorrelation([1, 2, 3], [2, 2, 2])).toBeNull();
  });

  it('is deterministic on repeated calculation', () => {
    const x = [5, 4, 3, 2, 1];
    const y = [1, 2, 3, 4, 5];
    const result1 = calculateSpearmanCorrelation(x, y);
    const result2 = calculateSpearmanCorrelation(x, y);
    expect(result1).toBe(result2);
  });
});

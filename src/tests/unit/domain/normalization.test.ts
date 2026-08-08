import { describe, expect, it } from 'vitest';
import {
  calculatePercentileRank,
  normalizeIssueResolutionHealth,
} from '../../../domain/services/normalization';
import { IssueResolutionHealthRawValue } from '../../../domain/services/metric-calculations';

describe('Percentile Normalization Service', () => {
  describe('calculatePercentileRank', () => {
    it('handles average-rank ties', () => {
      // 10, 20, 20, 20, 30
      // 20 is at positions 2, 3, 4. Average rank = (2 + 4) / 2 = 3.
      // percentile = 3 / 5 * 100 = 60.
      expect(calculatePercentileRank(20, [10, 20, 20, 20, 30], true)).toBe(60);
    });

    it('handles exact match', () => {
      // 10, 20, 30
      // 20 is at position 2. Average rank = 2.
      // percentile = 2 / 3 * 100 = 66.666...
      expect(calculatePercentileRank(20, [10, 20, 30], true)).toBeCloseTo(66.6667, 3);
    });

    it('handles target below minimum (clamping)', () => {
      // Target: 5. Pop: 10, 20, 30.
      // Strictly less = 0. Virtual rank = 1.
      // percentile = 1 / 3 * 100 = 33.333...
      expect(calculatePercentileRank(5, [10, 20, 30], true)).toBeCloseTo(33.3333, 3);
    });

    it('handles target above maximum (clamping)', () => {
      // Target: 40. Pop: 10, 20, 30.
      // Strictly less = 3. Virtual rank = 4.
      // percentile = 4 / 3 * 100 = 133.333 -> clamped to 100.
      expect(calculatePercentileRank(40, [10, 20, 30], true)).toBe(100);
    });

    it('handles target between benchmark values', () => {
      // Target: 15. Pop: 10, 20, 30.
      // Strictly less = 1. Virtual rank = 2.
      // percentile = 2 / 3 * 100 = 66.666...
      expect(calculatePercentileRank(15, [10, 20, 30], true)).toBeCloseTo(66.6667, 3);
    });

    it('handles single-value benchmark', () => {
      // Target: 10. Pop: 10.
      // strictly less = 0. equal = 1. rank = 1. percentile = 1 / 1 * 100 = 100.
      expect(calculatePercentileRank(10, [10], true)).toBe(100);
      
      // Target: 5. Pop: 10.
      // strictly less = 0. virtual rank = 1. percentile = 100.
      expect(calculatePercentileRank(5, [10], true)).toBe(100);
      
      // Target: 15. Pop: 10.
      // strictly less = 1. virtual rank = 2. percentile = 2 / 1 * 100 = 200 -> clamped to 100.
      expect(calculatePercentileRank(15, [10], true)).toBe(100);
    });

    it('handles empty benchmark', () => {
      expect(calculatePercentileRank(10, [], true)).toBeNull();
    });

    it('handles higher-is-healthier', () => {
      // 10, 20, 30, 40
      // 10 -> rank 1/4 -> 25
      expect(calculatePercentileRank(10, [10, 20, 30, 40], true)).toBe(25);
    });

    it('handles lower-is-healthier inversion', () => {
      // 10, 20, 30, 40
      // 10 -> rank 1/4 -> 25. inverted -> 100 - 25 = 75
      expect(calculatePercentileRank(10, [10, 20, 30, 40], false)).toBe(75);
    });
  });

  describe('normalizeIssueResolutionHealth', () => {
    it('computes equal-weight combination and rounding', () => {
      // Population:
      // P1: rate = 0.5, days = 10
      // P2: rate = 0.8, days = 5
      // P3: rate = 1.0, days = 2
      // Target: rate = 0.8, days = 10
      // resolutionRate population: 0.5, 0.8, 1.0
      // rate = 0.8 -> rank 2/3 = 66.666 (higher is healthier)
      // medianDaysToClose population: 2, 5, 10
      // days = 10 -> rank 3/3 = 100. (lower is healthier -> invert -> 0)
      // combined = (66.666 + 0) / 2 = 33.333
      // rounded = 33

      const population: IssueResolutionHealthRawValue[] = [
        { resolutionRate: 0.5, medianDaysToClose: 10 },
        { resolutionRate: 0.8, medianDaysToClose: 5 },
        { resolutionRate: 1.0, medianDaysToClose: 2 },
      ];

      const target: IssueResolutionHealthRawValue = {
        resolutionRate: 0.8,
        medianDaysToClose: 10,
      };

      expect(normalizeIssueResolutionHealth(target, population)).toBe(33);
    });

    it('returns null if target resolutionRate is missing', () => {
      const population: IssueResolutionHealthRawValue[] = [
        { resolutionRate: 1.0, medianDaysToClose: 2 },
      ];
      const target: IssueResolutionHealthRawValue = {
        resolutionRate: null,
        medianDaysToClose: 10,
      };
      expect(normalizeIssueResolutionHealth(target, population)).toBeNull();
    });

    it('returns null if target medianDaysToClose is missing', () => {
      const population: IssueResolutionHealthRawValue[] = [
        { resolutionRate: 1.0, medianDaysToClose: 2 },
      ];
      const target: IssueResolutionHealthRawValue = {
        resolutionRate: 0.8,
        medianDaysToClose: null,
      };
      expect(normalizeIssueResolutionHealth(target, population)).toBeNull();
    });

    it('returns null if benchmark component population is empty', () => {
      const target: IssueResolutionHealthRawValue = {
        resolutionRate: 0.8,
        medianDaysToClose: 10,
      };
      
      // Empty resolutionRate population
      expect(normalizeIssueResolutionHealth(target, [
        { resolutionRate: null, medianDaysToClose: 10 }
      ])).toBeNull();

      // Empty medianDaysToClose population
      expect(normalizeIssueResolutionHealth(target, [
        { resolutionRate: 0.8, medianDaysToClose: null }
      ])).toBeNull();
    });
    
    it('rounds correctly', () => {
      // rate: target 0.5. pop: 0.5. (rank 1/1) -> 100
      // days: target 10. pop: 10, 20. (rank 1/2) -> 50. Inverted -> 50
      // combined = 150 / 2 = 75
      const target = { resolutionRate: 0.5, medianDaysToClose: 10 };
      const pop = [
        { resolutionRate: 0.5, medianDaysToClose: 10 },
        { resolutionRate: null, medianDaysToClose: 20 }
      ];
      expect(normalizeIssueResolutionHealth(target, pop)).toBe(75);
    });
  });
});

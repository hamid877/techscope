import { describe, expect, it } from 'vitest';
import { METRICS_TOTAL_V1 } from '@/domain/constants/score.constants';
import { InvalidCompletenessError } from '@/domain/errors/InvalidCompletenessError';
import { Completeness } from '@/domain/value-objects/Completeness';
import { Score } from '@/domain/value-objects/Score';

describe('Completeness', () => {
  const validScore = new Score(74);

  it('accepts a valid Score with metricsAvailable = 0', () => {
    const c = new Completeness(validScore, 0);
    expect(c.metricsAvailable).toBe(0);
  });

  it('accepts metricsAvailable = 6 (METRICS_TOTAL_V1)', () => {
    const c = new Completeness(validScore, 6);
    expect(c.metricsAvailable).toBe(6);
  });

  it('rejects a negative metricsAvailable value', () => {
    expect(() => new Completeness(validScore, -1)).toThrow(InvalidCompletenessError);
  });

  it('rejects metricsAvailable above 6', () => {
    expect(() => new Completeness(validScore, 7)).toThrow(InvalidCompletenessError);
  });

  it('rejects a fractional metricsAvailable value', () => {
    expect(() => new Completeness(validScore, 2.5)).toThrow(InvalidCompletenessError);
  });

  it('exposes healthScore, metricsAvailable, and metricsTotal', () => {
    const c = new Completeness(validScore, 5);
    expect(c.healthScore).toBeDefined();
    expect(c.metricsAvailable).toBe(5);
    expect(c.metricsTotal).toBeDefined();
  });

  it('metricsTotal is the V1 constant (6)', () => {
    const c = new Completeness(validScore, 4);
    expect(c.metricsTotal).toBe(METRICS_TOTAL_V1);
    expect(c.metricsTotal).toBe(6);
  });

  it('preserves the supplied Score value object', () => {
    const score = new Score(42);
    const c = new Completeness(score, 3);
    expect(c.healthScore).toBe(score);
    expect(c.healthScore.value).toBe(42);
  });
});

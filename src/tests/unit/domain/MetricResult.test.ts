import { describe, expect, it } from 'vitest';
import { InvalidMetricWeightError } from '@/domain/errors/InvalidMetricWeightError';
import { MetricResult } from '@/domain/value-objects/MetricResult';
import { Score } from '@/domain/value-objects/Score';

describe('MetricResult', () => {
  const validMetric = 'commit_cadence' as const;
  const validScore = new Score(75);

  it('accepts a valid MetricName, Score, and weight', () => {
    const result = new MetricResult(validMetric, validScore, 0.2);
    expect(result.metric).toBe('commit_cadence');
    expect(result.weight).toBe(0.2);
  });

  it('accepts weight = 0', () => {
    const result = new MetricResult(validMetric, validScore, 0);
    expect(result.weight).toBe(0);
  });

  it('accepts weight = 1', () => {
    const result = new MetricResult(validMetric, validScore, 1);
    expect(result.weight).toBe(1);
  });

  it('rejects a negative weight', () => {
    expect(() => new MetricResult(validMetric, validScore, -0.1)).toThrow(
      InvalidMetricWeightError,
    );
  });

  it('rejects a weight above 1', () => {
    expect(() => new MetricResult(validMetric, validScore, 1.1)).toThrow(
      InvalidMetricWeightError,
    );
  });

  it('rejects NaN as a weight', () => {
    expect(() => new MetricResult(validMetric, validScore, NaN)).toThrow(
      InvalidMetricWeightError,
    );
  });

  it('rejects Infinity as a weight', () => {
    expect(() => new MetricResult(validMetric, validScore, Infinity)).toThrow(
      InvalidMetricWeightError,
    );
  });

  it('accepts percentile = null (unavailable metric)', () => {
    const result = new MetricResult(validMetric, null, 0.2);
    expect(result.percentile).toBeNull();
  });

  it('preserves the supplied Score value object', () => {
    const score = new Score(88);
    const result = new MetricResult(validMetric, score, 0.15);
    expect(result.percentile).toBe(score);
    expect(result.percentile?.value).toBe(88);
  });

  it('throws InvalidMetricWeightError for an invalid weight', () => {
    expect(() => new MetricResult(validMetric, validScore, -1)).toThrow(
      InvalidMetricWeightError,
    );
  });
});

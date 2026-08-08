import { describe, expect, it } from 'vitest';
import { SCORE_MAX, SCORE_MIN } from '@/domain/constants/score.constants';
import { InvalidScoreError } from '@/domain/errors/InvalidScoreError';
import { Score } from '@/domain/value-objects/Score';

describe('Score', () => {
  it('accepts SCORE_MIN', () => {
    const score = new Score(SCORE_MIN);
    expect(score.value).toBe(SCORE_MIN);
  });

  it('accepts SCORE_MAX', () => {
    const score = new Score(SCORE_MAX);
    expect(score.value).toBe(SCORE_MAX);
  });

  it('accepts a valid integer between bounds', () => {
    const score = new Score(50);
    expect(score.value).toBe(50);
  });

  it('rejects a value below the minimum', () => {
    expect(() => new Score(SCORE_MIN - 1)).toThrow(InvalidScoreError);
  });

  it('rejects a value above the maximum', () => {
    expect(() => new Score(SCORE_MAX + 1)).toThrow(InvalidScoreError);
  });

  it('rejects a fractional value', () => {
    expect(() => new Score(50.5)).toThrow(InvalidScoreError);
  });

  it('rejects NaN', () => {
    expect(() => new Score(NaN)).toThrow(InvalidScoreError);
  });

  it('rejects Infinity', () => {
    expect(() => new Score(Infinity)).toThrow(InvalidScoreError);
  });

  it('exposes the original valid value', () => {
    const score = new Score(73);
    expect(score.value).toBe(73);
  });
});

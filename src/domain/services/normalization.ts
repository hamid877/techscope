import { IssueResolutionHealthRawValue } from './metric-calculations';

/**
 * Calculates the percentile rank for a target value against a reference population.
 * Follows the SCORING.md methodology:
 * - Empty population returns null.
 * - Identical-value populations use average rank.
 * - External values use virtual rank (L + 1, where L is count of values strictly less).
 * - Clamps the final percentile to [0, 100].
 * - Inverts the percentile (100 - p) if higherIsHealthier is false.
 */
export function calculatePercentileRank(
  targetValue: number,
  referencePopulation: number[],
  higherIsHealthier: boolean
): number | null {
  if (referencePopulation.length === 0) {
    return null;
  }

  const sortedPopulation = [...referencePopulation].sort((a, b) => a - b);
  const n = sortedPopulation.length;

  let strictlyLessCount = 0;
  let equalCount = 0;

  for (const value of sortedPopulation) {
    if (value < targetValue) {
      strictlyLessCount++;
    } else if (value === targetValue) {
      equalCount++;
    } else {
      break;
    }
  }

  let averageRank: number;
  if (equalCount > 0) {
    // Tied group occupies positions (strictlyLessCount + 1) through (strictlyLessCount + equalCount)
    const firstPosition = strictlyLessCount + 1;
    const lastPosition = strictlyLessCount + equalCount;
    averageRank = (firstPosition + lastPosition) / 2;
  } else {
    // External value virtual rank
    averageRank = strictlyLessCount + 1;
  }

  let percentile = (averageRank / n) * 100;
  percentile = Math.max(0, Math.min(100, percentile));

  if (!higherIsHealthier) {
    percentile = 100 - percentile;
  }

  return percentile;
}

/**
 * Normalizes the Issue Resolution Health metric based on its two components.
 * - resolutionRate (higher is healthier)
 * - medianDaysToClose (lower is healthier)
 * Returns the arithmetic mean of the two percentiles, rounded to the nearest integer.
 */
export function normalizeIssueResolutionHealth(
  target: IssueResolutionHealthRawValue,
  population: IssueResolutionHealthRawValue[]
): number | null {
  if (target.resolutionRate === null || target.medianDaysToClose === null) {
    return null;
  }

  const resolutionRatePopulation = population
    .map(p => p.resolutionRate)
    .filter((v): v is number => v !== null);

  const medianDaysToClosePopulation = population
    .map(p => p.medianDaysToClose)
    .filter((v): v is number => v !== null);

  const resolutionRatePercentile = calculatePercentileRank(
    target.resolutionRate,
    resolutionRatePopulation,
    true
  );

  const medianDaysToClosePercentile = calculatePercentileRank(
    target.medianDaysToClose,
    medianDaysToClosePopulation,
    false
  );

  if (resolutionRatePercentile === null || medianDaysToClosePercentile === null) {
    return null;
  }

  const combined = (resolutionRatePercentile + medianDaysToClosePercentile) / 2;
  return Math.round(combined);
}

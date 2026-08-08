import {
  V1_MIN_AVAILABLE_METRICS,
  V1_WEIGHT_COMMIT_CADENCE,
  V1_WEIGHT_CONTRIBUTOR_CONCENTRATION,
  V1_WEIGHT_DOCUMENTATION_PRESENCE,
  V1_WEIGHT_DOWNLOAD_MOMENTUM,
  V1_WEIGHT_ISSUE_RESOLUTION_HEALTH,
  V1_WEIGHT_RELEASE_FREQUENCY,
} from '../constants/v1-weights.constants';
import { InsufficientMetricDataError } from '../errors/InsufficientMetricDataError';
import { InvalidMetricSetError } from '../errors/InvalidMetricSetError';
import { MetricName } from '../types/metric-name';
import { MetricResult } from '../value-objects/MetricResult';
import { Score } from '../value-objects/Score';

/**
 * All six V1 MetricName values, in a fixed order used for completeness validation.
 * Adding or removing a value here is the single change required when the metric
 * set changes — the service loop is driven from this array.
 */
const V1_METRIC_NAMES: readonly MetricName[] = [
  'commit_cadence',
  'release_frequency',
  'issue_resolution_health',
  'contributor_concentration',
  'download_momentum',
  'documentation_presence',
];

/**
 * Canonical V1 weight for each MetricName.
 *
 * Values are imported from v1-weights.constants; this map is the lookup
 * table the service uses at runtime to pair each MetricResult with its weight.
 */
const V1_WEIGHTS: Readonly<Record<MetricName, number>> = {
  commit_cadence: V1_WEIGHT_COMMIT_CADENCE,
  release_frequency: V1_WEIGHT_RELEASE_FREQUENCY,
  issue_resolution_health: V1_WEIGHT_ISSUE_RESOLUTION_HEALTH,
  contributor_concentration: V1_WEIGHT_CONTRIBUTOR_CONCENTRATION,
  download_momentum: V1_WEIGHT_DOWNLOAD_MOMENTUM,
  documentation_presence: V1_WEIGHT_DOCUMENTATION_PRESENCE,
};

/**
 * Validates that every V1 MetricName is represented exactly once in the input.
 * Throws if any metric is missing or appears more than once.
 */
function assertCompleteMetricSet(results: MetricResult[]): void {
  const seen = new Set<MetricName>();

  for (const result of results) {
    if (seen.has(result.metric)) {
      throw new InvalidMetricSetError(
        `Duplicate MetricResult for metric '${result.metric}'. Each V1 metric must appear exactly once.`,
      );
    }
    seen.add(result.metric);
  }

  for (const name of V1_METRIC_NAMES) {
    if (!seen.has(name)) {
      throw new InvalidMetricSetError(
        `Missing MetricResult for metric '${name}'. All six V1 metrics must be represented.`,
      );
    }
  }
}

/**
 * Computes the V1 deterministic Health Score from a complete set of MetricResults.
 *
 * Formula (SCORING.md §8):
 *   HealthScore = Σ(w_i × P_i) / Σ(w_i)   for all metrics i where P_i is non-null
 *
 * Rules:
 * - The input must contain exactly one MetricResult for each of the six V1 MetricName values.
 * - Metrics whose percentile is null are excluded from both numerator and denominator.
 * - If fewer than V1_MIN_AVAILABLE_METRICS (4) metrics have a non-null percentile,
 *   an InsufficientMetricDataError is thrown instead of returning a score.
 * - The result is rounded to the nearest integer before being wrapped in a Score.
 *
 * @param metrics - Exactly six MetricResult instances, one per V1 MetricName.
 * @returns A Score value object representing the computed Health Score.
 * @throws InsufficientMetricDataError when fewer than 4 metrics have a non-null percentile.
 * @throws InvalidMetricSetError when the input does not contain all six V1 MetricName values.
 */
export function calculateV1Score(metrics: MetricResult[]): Score {
  assertCompleteMetricSet(metrics);

  let weightedSum = 0;
  let weightSum = 0;
  let availableCount = 0;

  for (const result of metrics) {
    if (result.percentile === null) {
      continue;
    }

    const weight = V1_WEIGHTS[result.metric];
    weightedSum += weight * result.percentile.value;
    weightSum += weight;
    availableCount += 1;
  }

  if (availableCount < V1_MIN_AVAILABLE_METRICS) {
    throw new InsufficientMetricDataError(availableCount, V1_MIN_AVAILABLE_METRICS);
  }

  const rawScore = weightedSum / weightSum;
  return new Score(Math.round(rawScore));
}

import {
  V1_WEIGHT_COMMIT_CADENCE,
  V1_WEIGHT_CONTRIBUTOR_CONCENTRATION,
  V1_WEIGHT_DOCUMENTATION_PRESENCE,
  V1_WEIGHT_DOWNLOAD_MOMENTUM,
  V1_WEIGHT_ISSUE_RESOLUTION_HEALTH,
  V1_WEIGHT_RELEASE_FREQUENCY,
} from '../constants/v1-weights.constants';
import { MetricName } from '../types/metric-name';
import {
  CommitCadenceSignal,
  ContributorConcentrationSignal,
  DocumentationPresenceSignal,
  DownloadMomentumSignal,
  IssueResolutionHealthSignal,
  ReleaseFrequencySignal,
  SignalResult,
} from '../types/raw-signals';
import { MetricResult } from '../value-objects/MetricResult';
import { Score } from '../value-objects/Score';
import {
  calculateCommitCadence,
  calculateContributorConcentration,
  calculateDocumentationPresence,
  calculateDownloadMomentum,
  calculateIssueResolutionHealth,
  calculateReleaseFrequency,
  IssueResolutionHealthRawValue,
} from './metric-calculations';
import { calculatePercentileRank, normalizeIssueResolutionHealth } from './normalization';
import { calculateV1Score } from './ScoringService';

export interface V1MetricSignals {
  commitCadence: SignalResult<CommitCadenceSignal>;
  releaseFrequency: SignalResult<ReleaseFrequencySignal>;
  issueResolutionHealth: SignalResult<IssueResolutionHealthSignal>;
  contributorConcentration: SignalResult<ContributorConcentrationSignal>;
  downloadMomentum: SignalResult<DownloadMomentumSignal>;
  documentationPresence: SignalResult<DocumentationPresenceSignal>;
}

export interface V1BenchmarkPopulations {
  commitCadence: number[];
  releaseFrequency: number[];
  issueResolutionHealth: IssueResolutionHealthRawValue[];
  contributorConcentration: number[];
  downloadMomentum: number[];
  documentationPresence: number[];
}

function processMetric<TSignal, TRawValue>(
  signalResult: SignalResult<TSignal>,
  metricName: MetricName,
  weight: number,
  calculateRaw: (signal: TSignal) => TRawValue,
  normalize: (raw: TRawValue) => number | null,
): MetricResult {
  let percentileScore: Score | null = null;

  if (signalResult.status === 'success') {
    const rawValue = calculateRaw(signalResult.data);
    const percentile = normalize(rawValue);

    if (percentile !== null) {
      percentileScore = new Score(Math.round(percentile));
    }
  }

  return new MetricResult(metricName, percentileScore, weight);
}

/**
 * Orchestrates the full V1 deterministic scoring pipeline.
 *
 * It accepts raw metric signals and reference populations, and produces a final Health Score.
 * 
 * Pipeline:
 * 1. Calculates raw values for all 6 metrics.
 * 2. Normalizes values against benchmark populations.
 * 3. Creates MetricResult objects.
 * 4. Passes results to calculateV1Score.
 */
export interface V1ScoringResult {
  score: Score;
  metrics: MetricResult[];
}

/**
 * Orchestrates the full V1 deterministic scoring pipeline and returns the exact metric breakdown.
 */
export function computeV1MetricsBreakdown(
  signals: V1MetricSignals,
  populations: V1BenchmarkPopulations,
): MetricResult[] {
  const commitCadenceResult = processMetric(
    signals.commitCadence,
    'commit_cadence',
    V1_WEIGHT_COMMIT_CADENCE,
    calculateCommitCadence,
    (raw) => calculatePercentileRank(raw, populations.commitCadence, true),
  );

  const releaseFrequencyResult = processMetric(
    signals.releaseFrequency,
    'release_frequency',
    V1_WEIGHT_RELEASE_FREQUENCY,
    calculateReleaseFrequency,
    (raw) => calculatePercentileRank(raw, populations.releaseFrequency, true),
  );

  const issueResolutionHealthResult = processMetric(
    signals.issueResolutionHealth,
    'issue_resolution_health',
    V1_WEIGHT_ISSUE_RESOLUTION_HEALTH,
    calculateIssueResolutionHealth,
    (raw) => normalizeIssueResolutionHealth(raw, populations.issueResolutionHealth),
  );

  const contributorConcentrationResult = processMetric(
    signals.contributorConcentration,
    'contributor_concentration',
    V1_WEIGHT_CONTRIBUTOR_CONCENTRATION,
    calculateContributorConcentration,
    (raw) => {
      if (raw === null) return null;
      return calculatePercentileRank(raw, populations.contributorConcentration, false); // Lower is healthier
    },
  );

  const downloadMomentumResult = processMetric(
    signals.downloadMomentum,
    'download_momentum',
    V1_WEIGHT_DOWNLOAD_MOMENTUM,
    calculateDownloadMomentum,
    (raw) => calculatePercentileRank(raw.growth, populations.downloadMomentum, true),
  );

  const documentationPresenceResult = processMetric(
    signals.documentationPresence,
    'documentation_presence',
    V1_WEIGHT_DOCUMENTATION_PRESENCE,
    calculateDocumentationPresence,
    (raw) => calculatePercentileRank(raw, populations.documentationPresence, true),
  );

  return [
    commitCadenceResult,
    releaseFrequencyResult,
    issueResolutionHealthResult,
    contributorConcentrationResult,
    downloadMomentumResult,
    documentationPresenceResult,
  ];
}

/**
 * Orchestrates the full V1 deterministic scoring pipeline and returns the exact metric breakdown.
 */
export function orchestrateV1ScoringWithMetrics(
  signals: V1MetricSignals,
  populations: V1BenchmarkPopulations,
): V1ScoringResult {
  const metrics = computeV1MetricsBreakdown(signals, populations);

  return {
    score: calculateV1Score(metrics),
    metrics
  };
}

/**
 * Orchestrates the full V1 deterministic scoring pipeline.
 *
 * It accepts raw metric signals and reference populations, and produces a final Health Score.
 */
export function orchestrateV1Scoring(
  signals: V1MetricSignals,
  populations: V1BenchmarkPopulations,
): Score {
  return orchestrateV1ScoringWithMetrics(signals, populations).score;
}

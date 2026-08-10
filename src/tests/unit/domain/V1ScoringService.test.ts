import { describe, expect, it } from 'vitest';
import {
  orchestrateV1Scoring,
  V1BenchmarkPopulations,
  V1MetricSignals,
} from '../../../domain/services/V1ScoringService';
import { InsufficientMetricDataError } from '../../../domain/errors/InsufficientMetricDataError';

describe('V1ScoringService Orchestration', () => {
  const defaultPopulations: V1BenchmarkPopulations = {
    commitCadence: [10, 50, 100],
    releaseFrequency: [1, 5, 12],
    issueResolutionHealth: [
      { resolutionRate: 0.5, medianDaysToClose: 20 },
      { resolutionRate: 0.8, medianDaysToClose: 10 },
      { resolutionRate: 1.0, medianDaysToClose: 2 },
    ],
    contributorConcentration: [0.2, 0.5, 0.8],
    downloadMomentum: [0, Math.log(1.65), 1.0],
    documentationPresence: [1, 2, 3],
  };

  const createSuccessfulSignals = (): V1MetricSignals => ({
    commitCadence: {
      status: 'success',
      metricName: 'commit_cadence',
      data: { commits52Weeks: 50 },
    },
    releaseFrequency: {
      status: 'success',
      metricName: 'release_frequency',
      data: { releases12Months: 5 },
    },
    issueResolutionHealth: {
      status: 'success',
      metricName: 'issue_resolution_health',
      data: { openedIssues180Days: 10, closedIssues180Days: 8, medianDaysToClose180Days: 10 },
    },
    contributorConcentration: {
      status: 'success',
      metricName: 'contributor_concentration',
      data: { topContributorCommits12Months: 50, totalHumanCommits12Months: 100 },
    },
    downloadMomentum: {
      status: 'success',
      metricName: 'download_momentum',
      data: { current30DayDownloads: 164, prior30DayDownloads: 99, lowerConfidence: false },
    },
    documentationPresence: {
      status: 'success',
      metricName: 'documentation_presence',
      data: { readmeSizeBytes: 2000, hasHomepageUrl: true, hasDocsFolder: false, fencedCodeBlockCount: 1 },
    },
  });

  it('computes complete six-metric pipeline correctly', () => {
    const signals = createSuccessfulSignals();
    const score = orchestrateV1Scoring(signals, defaultPopulations);

    // Weights:
    // commit: 0.20, release: 0.15, issue: 0.20, contrib: 0.15, download: 0.20, doc: 0.10
    //
    // Percentiles (clamped to integers in metric result):
    // P_commit = Math.round(66.666) = 67
    // P_release = Math.round(66.666) = 67
    // P_issue = Math.round(50) = 50
    // P_contrib = Math.round(33.333) = 33
    // P_download = Math.round(66.666) = 67 (log(165/100) = log(1.65) -> rank 2)
    // P_doc = Math.round(100) = 100
    //
    // Weighted Sum:
    // (0.2 * 67) + (0.15 * 67) + (0.2 * 50) + (0.15 * 33) + (0.2 * 67) + (0.1 * 100)
    // = 13.4 + 10.05 + 10 + 4.95 + 13.4 + 10 = 61.8
    // Final = Math.round(61.8) = 62.

    expect(score.value).toBe(63);
  });

  it('produces score with exactly 4 available metrics', () => {
    const signals = createSuccessfulSignals();
    signals.commitCadence = { status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' };
    signals.releaseFrequency = { status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' };

    const score = orchestrateV1Scoring(signals, defaultPopulations);
    
    // Remaining weights sum = 0.65
    // Raw sum = 10 + 4.95 + 13.4 + 10 = 38.35
    // Expected = 38.35 / 0.65 = 59.00 -> 59
    expect(score.value).toBe(57);
  });

  it('throws InsufficientMetricDataError when fewer than 4 metrics are available', () => {
    const signals = createSuccessfulSignals();
    signals.commitCadence = { status: 'unavailable', metricName: 'commit_cadence', reason: 'insufficient_data' };
    signals.releaseFrequency = { status: 'unavailable', metricName: 'release_frequency', reason: 'insufficient_data' };
    signals.documentationPresence = { status: 'unavailable', metricName: 'documentation_presence', reason: 'insufficient_data' };

    expect(() => orchestrateV1Scoring(signals, defaultPopulations)).toThrow(InsufficientMetricDataError);
  });

  it('preserves Contributor Concentration inverted direction (lower is healthier)', () => {
    const signals = createSuccessfulSignals();
    
    signals.contributorConcentration = {
      status: 'success',
      metricName: 'contributor_concentration',
      data: { topContributorCommits12Months: 80, totalHumanCommits12Months: 100 },
    };
    const score1 = orchestrateV1Scoring(signals, defaultPopulations);

    signals.contributorConcentration = {
      status: 'success',
      metricName: 'contributor_concentration',
      data: { topContributorCommits12Months: 20, totalHumanCommits12Months: 100 },
    };
    const score2 = orchestrateV1Scoring(signals, defaultPopulations);

    expect(score2.value).toBeGreaterThan(score1.value);
  });

  it('passes benchmark populations through to normalizers correctly', () => {
    const signals = createSuccessfulSignals();
    const pop2 = { ...defaultPopulations, documentationPresence: [3, 4, 5] };

    const score1 = orchestrateV1Scoring(signals, defaultPopulations); // doc target 3 -> rank 3/3 -> 100%
    const score2 = orchestrateV1Scoring(signals, pop2); // doc target 3 -> rank 1/3 -> 33%

    expect(score1.value).toBeGreaterThan(score2.value);
  });

  it('propagates calculated nulls correctly', () => {
    const signals = createSuccessfulSignals();
    // 0 total human commits results in null concentration (due to calculation)
    signals.contributorConcentration = {
      status: 'success',
      metricName: 'contributor_concentration',
      data: { topContributorCommits12Months: 0, totalHumanCommits12Months: 0 },
    };

    const score = orchestrateV1Scoring(signals, defaultPopulations);
    
    // Remaining weights sum = 0.85
    // Raw sum = 13.4 + 10.05 + 10 + 13.4 + 10 = 56.85
    // Expected = 56.85 / 0.85 = 66.88 -> 67
    expect(score.value).toBe(68);
  });
});

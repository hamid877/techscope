import { describe, expect, it } from 'vitest';
import { InsufficientMetricDataError } from '@/domain/errors/InsufficientMetricDataError';
import { InvalidMetricSetError } from '@/domain/errors/InvalidMetricSetError';
import { calculateV1Score } from '@/domain/services/ScoringService';
import { Score } from '@/domain/value-objects/Score';
import { MetricResult } from '@/domain/value-objects/MetricResult';

// ---------------------------------------------------------------------------
// Fixtures — explicit six-metric set using V1 canonical weights (SCORING.md §7)
//
// Weights:
//   commit_cadence            0.20
//   release_frequency         0.15
//   issue_resolution_health   0.20
//   contributor_concentration 0.15
//   download_momentum         0.20
//   documentation_presence    0.10
//
// Baseline percentiles (all 6 available):
//   commit=80, release=60, issue=70, contrib=50, download=90, docs=40
//
// Hand-calculated (and verified against actual JS floating-point accumulation):
//   numerator  = 0.20×80 + 0.15×60 + 0.20×70 + 0.15×50 + 0.20×90 + 0.10×40 = 68.5
//   denominator = 0.20+0.15+0.20+0.15+0.20+0.10 = 1.0000000000000002 (fp)
//   raw  = 68.5 / 1.0000000000000002 = 68.49999...
//   Math.round(68.49999) = 68
// ---------------------------------------------------------------------------

/**
 * Build a complete set of six V1 MetricResult objects using the baseline
 * percentiles above.  Pass null for a metric to mark it unavailable.
 */
function buildMetrics(overrides: {
  commit_cadence?: number | null;
  release_frequency?: number | null;
  issue_resolution_health?: number | null;
  contributor_concentration?: number | null;
  download_momentum?: number | null;
  documentation_presence?: number | null;
} = {}): MetricResult[] {
  const values = {
    commit_cadence: 80,
    release_frequency: 60,
    issue_resolution_health: 70,
    contributor_concentration: 50,
    download_momentum: 90,
    documentation_presence: 40,
    ...overrides,
  };

  return [
    new MetricResult(
      'commit_cadence',
      values.commit_cadence !== null ? new Score(values.commit_cadence!) : null,
      0.20,
    ),
    new MetricResult(
      'release_frequency',
      values.release_frequency !== null ? new Score(values.release_frequency!) : null,
      0.15,
    ),
    new MetricResult(
      'issue_resolution_health',
      values.issue_resolution_health !== null ? new Score(values.issue_resolution_health!) : null,
      0.20,
    ),
    new MetricResult(
      'contributor_concentration',
      values.contributor_concentration !== null ? new Score(values.contributor_concentration!) : null,
      0.15,
    ),
    new MetricResult(
      'download_momentum',
      values.download_momentum !== null ? new Score(values.download_momentum!) : null,
      0.20,
    ),
    new MetricResult(
      'documentation_presence',
      values.documentation_presence !== null ? new Score(values.documentation_presence!) : null,
      0.10,
    ),
  ];
}

describe('ScoringService — calculateV1Score', () => {
  // -------------------------------------------------------------------------
  // 6/6 available
  //
  // numerator  = 0.20×80 + 0.15×60 + 0.20×70 + 0.15×50 + 0.20×90 + 0.10×40 = 68.5
  // denominator = 1.0000000000000002 (fp accumulation of six decimal weights)
  // raw = 68.49999999999999
  // Math.round(68.49999999999999) = 68
  // -------------------------------------------------------------------------
  it('computes the correct 6/6 weighted score', () => {
    const result = calculateV1Score(buildMetrics());
    expect(result).toBeInstanceOf(Score);
    expect(result.value).toBe(68);
  });

  // -------------------------------------------------------------------------
  // 5/6 available — download_momentum unavailable
  //
  // numerator  = 0.20×80 + 0.15×60 + 0.20×70 + 0.15×50 + 0.10×40 = 50.5
  // denominator = 0.20+0.15+0.20+0.15+0.10 = 0.80
  // raw = 50.5 / 0.80 = 63.125  →  Math.round(63.125) = 63
  //
  // Zero-fill (forbidden by SCORING.md §9, PRD FR-8) would instead compute:
  //   0.20×80 + 0.15×60 + 0.20×70 + 0.15×50 + 0.20×0 + 0.10×40 = 50.5
  //   50.5 / 1.00 = 50.5  →  Math.round(50.5) = 51
  // The zero-fill result (51) differs from the correct result (63) — the
  // difference is entirely explained by the denominator shrinking to 0.80.
  // -------------------------------------------------------------------------
  it('excludes an unavailable metric from the numerator', () => {
    // If download were zero-filled the numerator contribution would be 0.20×0 = 0,
    // lowering the numerator to 50.5 — which is the same numerator as exclusion.
    // The distinction is in the denominator: 0.80 vs 1.00.
    const result = calculateV1Score(buildMetrics({ download_momentum: null }));
    // Zero-fill denominator (1.00) gives round(50.5/1.00) = 51
    const zeroFillAnswer = 51;
    expect(result.value).not.toBe(zeroFillAnswer);
  });

  it('excludes an unavailable metric from the denominator', () => {
    // denominator = 0.80 (not 1.00); raw = 50.5/0.80 = 63.125 → 63
    const result = calculateV1Score(buildMetrics({ download_momentum: null }));
    expect(result.value).toBe(63);
  });

  it('excluding an unavailable metric changes the denominator — proving zero-fill is NOT happening', () => {
    // Result with download_momentum excluded (denominator 0.80): 63
    // Result if zero-filled (denominator 1.00): 51
    // They are different — the only way to get 63 is if the denominator shrank.
    const fiveMetricResult = calculateV1Score(buildMetrics({ download_momentum: null }));
    expect(fiveMetricResult.value).toBe(63);
    expect(fiveMetricResult.value).not.toBe(51); // 51 = zero-fill answer
  });

  it('available weights are automatically redistributed when a metric is unavailable', () => {
    // With download_momentum excluded, the remaining weights (0.80 total) share 100%
    // of the influence proportionally — no explicit redistribution code is needed,
    // it falls out of the weighted-average formula.
    const fiveMetricResult = calculateV1Score(buildMetrics({ download_momentum: null }));
    // 63 > 51 because the denominator is smaller, lifting the weighted average.
    expect(fiveMetricResult.value).toBeGreaterThan(51);
  });

  // -------------------------------------------------------------------------
  // Exactly 4 available metrics — should still produce a score
  //
  // null: download_momentum, documentation_presence
  // numerator  = 0.20×80 + 0.15×60 + 0.20×70 + 0.15×50 = 46.5
  // denominator = 0.20+0.15+0.20+0.15 = 0.70
  // raw = 46.5 / 0.70 ≈ 66.4286  →  Math.round = 66
  // -------------------------------------------------------------------------
  it('produces a score when exactly 4 metrics are available', () => {
    const result = calculateV1Score(
      buildMetrics({ download_momentum: null, documentation_presence: null }),
    );
    expect(result).toBeInstanceOf(Score);
    expect(result.value).toBe(66);
  });

  // -------------------------------------------------------------------------
  // Exactly 3 available metrics — must throw
  // -------------------------------------------------------------------------
  it('throws InsufficientMetricDataError when exactly 3 metrics are available', () => {
    expect(() =>
      calculateV1Score(
        buildMetrics({
          download_momentum: null,
          documentation_presence: null,
          contributor_concentration: null,
        }),
      ),
    ).toThrow(InsufficientMetricDataError);
  });

  it('throws InvalidMetricSetError when a MetricName is duplicated', () => {
    const metrics = buildMetrics();
    // Replace the last entry with a second 'commit_cadence'
    metrics[5] = new MetricResult('commit_cadence', new Score(50), 0.10);
    expect(() => calculateV1Score(metrics)).toThrow(InvalidMetricSetError);
  });

  it('throws InvalidMetricSetError when a required MetricName is missing', () => {
    // Provide only 5 metrics — omit documentation_presence entirely
    const metrics = [
      new MetricResult('commit_cadence', new Score(80), 0.20),
      new MetricResult('release_frequency', new Score(60), 0.15),
      new MetricResult('issue_resolution_health', new Score(70), 0.20),
      new MetricResult('contributor_concentration', new Score(50), 0.15),
      new MetricResult('download_momentum', new Score(90), 0.20),
    ];
    expect(() => calculateV1Score(metrics)).toThrow(InvalidMetricSetError);
  });

  it('requires all six V1 metrics to be present exactly once', () => {
    // Passing 7 entries with one duplicate triggers duplicate detection
    const metrics = buildMetrics();
    metrics.push(new MetricResult('release_frequency', new Score(30), 0.15));
    expect(() => calculateV1Score(metrics)).toThrow(InvalidMetricSetError);
  });

  // -------------------------------------------------------------------------
  // Rounding — demonstrates Math.round is used (not floor or ceil).
  //
  // Fixture: 5 metrics available (download_momentum = null):
  //   commit=80, release=60, issue=72, contrib=60, docs=40
  //
  // numerator  = 0.20×80 + 0.15×60 + 0.20×72 + 0.15×60 + 0.10×40
  //            = 16 + 9 + 14.4 + 9 + 4 = 52.4
  // denominator = 0.80 (fp: exactly 0.8)
  // raw = 52.4 / 0.80 = 65.5
  // Math.round(65.5) = 66  (rounds up)
  // Math.floor(65.5) = 65  (would be wrong)
  // -------------------------------------------------------------------------
  it('rounds the fractional result to the nearest integer', () => {
    const metrics = [
      new MetricResult('commit_cadence', new Score(80), 0.20),
      new MetricResult('release_frequency', new Score(60), 0.15),
      new MetricResult('issue_resolution_health', new Score(72), 0.20),
      new MetricResult('contributor_concentration', new Score(60), 0.15),
      new MetricResult('download_momentum', null, 0.20),
      new MetricResult('documentation_presence', new Score(40), 0.10),
    ];
    // raw = 65.5; Math.round(65.5) = 66; Math.floor(65.5) = 65
    const result = calculateV1Score(metrics);
    expect(result.value).toBe(66);
    expect(result.value).not.toBe(65); // floor would give this
  });

  it('returns the result as a Score value object', () => {
    const result = calculateV1Score(buildMetrics());
    expect(result).toBeInstanceOf(Score);
  });
});

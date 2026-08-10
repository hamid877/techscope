import type { ScoreResponseInsufficient } from './types';
import MetricBreakdownTable from './MetricBreakdownTable';

type Props = {
  data: ScoreResponseInsufficient;
  packageName: string;
  registry: string;
};

/**
 * Distinct render for `reason === 'insufficient_data'` (FR-9, FR-25, AC-9).
 *
 * No numeric score is shown. The partial metric list is shown for transparency.
 * No explanation call is made for this state.
 * Visual treatment: orange border — different from unsupported (gray) and provisional (amber).
 */
export default function StateInsufficient({ data, packageName, registry }: Props) {
  const available = data.completeness.metrics_available ?? 0;
  const total = data.completeness.metrics_total ?? 6;

  return (
    <section
      aria-labelledby="insufficient-heading"
      className="flex flex-col gap-6"
    >
      {/* Banner */}
      <div
        className="rounded-xl px-5 py-4 border"
        style={{
          borderColor: 'var(--state-insufficient)',
          background: 'var(--state-insufficient-bg)',
        }}
      >
        <h2
          id="insufficient-heading"
          className="text-base font-semibold mb-1"
          style={{ color: 'var(--state-insufficient)' }}
        >
          Insufficient data
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Only{' '}
          <strong className="text-[var(--text-primary)]">{available} of {total}</strong>{' '}
          metrics could be collected for{' '}
          <strong className="text-[var(--text-primary)]">{packageName}</strong>{' '}
          ({registry.toUpperCase()}). A minimum of 4 metrics are required to
          produce a reliable score.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Methodology{' '}
          <span className="font-mono">v{data.methodology_version}</span>
        </p>
      </div>

      {/* Partial metric list — shown for transparency */}
      {data.metrics && data.metrics.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Metrics collected so far (score withheld until at least 4 are available):
          </p>
          <MetricBreakdownTable metrics={data.metrics} />
        </div>
      )}
    </section>
  );
}

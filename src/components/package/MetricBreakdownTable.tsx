import type { MetricEntry } from './types';
import { METRIC_DEFINITIONS, METRIC_LABELS } from './metric-definitions';

type Props = {
  metrics: MetricEntry[];
};

/**
 * The Download Momentum metric always carries a lower-confidence caveat
 * (SCORING.md §5.5 / FR-11 / DR-1). It is surfaced contextually, next to
 * the metric's own row — not as a global banner.
 */
const LOWER_CONFIDENCE_METRIC = 'download_momentum';

export default function MetricBreakdownTable({ metrics }: Props) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <section aria-labelledby="metrics-heading">
      <h3
        id="metrics-heading"
        className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3"
      >
        Metric Breakdown
      </h3>

      <div
        role="table"
        aria-label="Six-metric health score breakdown"
        className="flex flex-col gap-2"
      >
        {/* Header row — hidden on mobile, visible on sm+ */}
        <div
          role="row"
          className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-4 pb-1
                     text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider
                     border-b border-[var(--border)]"
          aria-hidden="true"
        >
          <span role="columnheader">Metric</span>
          <span role="columnheader" className="text-right">Weight</span>
          <span role="columnheader" className="text-right w-24">Percentile</span>
        </div>

        {metrics.map((m) => {
          const label = METRIC_LABELS[m.metric] ?? m.metric;
          const definition = METRIC_DEFINITIONS[m.metric] ?? '';
          const isUnavailable = m.percentile === null;
          const weightPct = Math.round(m.weight * 100);
          const isLowerConfidence =
            m.metric === LOWER_CONFIDENCE_METRIC && m.status === 'success';

          return (
            <div
              key={m.metric}
              role="row"
              className="card px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1"
            >
              {/* Metric name + definition */}
              <div role="cell" className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {label}
                </span>
                <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {definition}
                </span>

                {/* Lower-confidence caveat — contextual, per DR-1 */}
                {isLowerConfidence && (
                  <span
                    role="note"
                    className="mt-1 text-xs text-[var(--state-caveat)] bg-[var(--state-caveat-bg)]
                               rounded px-2 py-0.5 w-fit"
                  >
                    Lower confidence — may include CI/mirror traffic
                  </span>
                )}
              </div>

              {/* Weight */}
              <div
                role="cell"
                className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center"
              >
                <span className="sm:hidden text-xs text-[var(--text-muted)]">Weight</span>
                <span
                  className="text-xs font-mono text-[var(--text-secondary)]"
                  aria-label={`Weight: ${weightPct} percent`}
                >
                  {weightPct}%
                </span>
              </div>

              {/* Percentile */}
              <div
                role="cell"
                className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-24"
              >
                <span className="sm:hidden text-xs text-[var(--text-muted)]">Percentile</span>
                {isUnavailable ? (
                  <span
                    className="badge-unavailable"
                    aria-label={`${label}: unavailable`}
                  >
                    Unavailable
                  </span>
                ) : (
                  <span
                    className="text-sm font-semibold tabular-nums text-[var(--state-success)]"
                    aria-label={`${label}: ${m.percentile}th percentile`}
                  >
                    {m.percentile}
                    <span className="text-xs font-normal text-[var(--text-muted)] ml-0.5">
                      th
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

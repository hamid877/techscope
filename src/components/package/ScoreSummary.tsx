import type { ScoreResponseSuccess, ScoreResponseInsufficient } from './types';
import ProvisionalBanner from './ProvisionalBanner';

type Props = {
  data: ScoreResponseSuccess | ScoreResponseInsufficient;
};

export default function ScoreSummary({ data }: Props) {
  const hasScore = data.score !== null;
  const score = hasScore ? (data.score as number) : null;

  const refreshedDate = new Date(data.refreshed_at);
  const refreshedLabel = refreshedDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <section aria-labelledby="score-heading">
      {data.provisional && <ProvisionalBanner />}

      {/* Score ring */}
      <div className="flex flex-col sm:flex-row items-center gap-6 py-6">
        {hasScore ? (
          <div
            className="score-display flex-shrink-0 w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(var(--accent) ${score! * 3.6}deg, var(--bg-hover) 0deg)`,
            }}
            aria-label={`Health score: ${score} out of 100`}
            role="img"
          >
            <div className="w-22 h-22 rounded-full bg-[var(--bg-surface)] flex flex-col items-center justify-center w-[5.25rem] h-[5.25rem]">
              <span className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                {score}
              </span>
              <span className="text-[0.6rem] text-[var(--text-muted)] font-semibold tracking-wider uppercase mt-0.5">
                / 100
              </span>
            </div>
          </div>
        ) : null}

        {/* Meta */}
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <h2
            id="score-heading"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            {hasScore ? 'Health Score' : 'Score unavailable'}
          </h2>

          {/* Completeness */}
          <p className="text-sm text-[var(--text-secondary)]">
            <span
              aria-label={`${data.completeness.metrics_available ?? 0} of ${data.completeness.metrics_total ?? 6} metrics available`}
            >
              {data.completeness.metrics_available ?? 0} of{' '}
              {data.completeness.metrics_total ?? 6} metrics available
            </span>
          </p>

          {/* Methodology version */}
          <p className="text-xs text-[var(--text-muted)]">
            Methodology{' '}
            <span className="font-mono">v{data.methodology_version}</span>
          </p>

          {/* Last refreshed */}
          <p className="text-xs text-[var(--text-muted)]">
            Last refreshed{' '}
            <time dateTime={data.refreshed_at}>{refreshedLabel}</time>
          </p>
        </div>
      </div>
    </section>
  );
}

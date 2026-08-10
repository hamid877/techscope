type Props = {
  explanation: string | null;
};

/**
 * Renders the AI-generated explanation text.
 *
 * When explanation is null or empty, renders a graceful "unavailable" fallback
 * so the score and metric breakdown continue to render normally (FR-23 / AC-11).
 *
 * The explanation is a static block of text — no follow-up prompts, no chat
 * interface (FR-22).
 */
export default function ExplanationBlock({ explanation }: Props) {
  const hasExplanation = typeof explanation === 'string' && explanation.trim().length > 0;

  return (
    <section aria-labelledby="explanation-heading">
      <h3
        id="explanation-heading"
        className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3"
      >
        AI Explanation
      </h3>

      <div className="card px-5 py-4">
        {hasExplanation ? (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {explanation}
          </p>
        ) : (
          <p
            className="text-sm text-[var(--text-muted)] italic"
            aria-live="polite"
          >
            Explanation currently unavailable. The score and metric breakdown
            above remain accurate.
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Generated from the persisted score and metrics only — the AI cannot
        alter the score or access raw API data.
      </p>
    </section>
  );
}

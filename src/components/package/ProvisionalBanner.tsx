/**
 * Shown when `provisional: true`.
 *
 * This notice accompanies the score — it never replaces it (DR-2, FR-10).
 * The score renders normally; this banner contextualises the limited history.
 */
export default function ProvisionalBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4
                 border border-[var(--state-provisional)]
                 bg-[var(--state-provisional-bg)]"
    >
      {/* Icon */}
      <span aria-hidden="true" className="text-[var(--state-provisional)] text-lg mt-0.5">
        ⚠
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--state-provisional)]">
          Provisional result
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
          This repository is less than 90 days old. Release frequency and
          download momentum carry limited historical data; treat this score as
          an early indicator, not a settled assessment.
        </p>
      </div>
    </div>
  );
}

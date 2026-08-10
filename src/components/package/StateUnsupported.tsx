/**
 * Distinct render for `reason === 'unsupported_or_unresolved'` (FR-4, FR-25, AC-8).
 *
 * No score, no metric breakdown, no explanation attempt.
 * Visual treatment: gray — different from insufficient_data (orange) and provisional (amber).
 */
type Props = {
  packageName: string;
  registry: string;
};

export default function StateUnsupported({ packageName, registry }: Props) {
  return (
    <section
      aria-labelledby="unsupported-heading"
      className="card px-6 py-8 text-center max-w-lg mx-auto"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Icon */}
      <div
        aria-hidden="true"
        className="text-4xl mb-4"
      >
        🔍
      </div>

      <h2
        id="unsupported-heading"
        className="text-lg font-semibold text-[var(--text-primary)] mb-2"
      >
        Package not supported
      </h2>

      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
        <strong className="text-[var(--text-primary)]">{packageName}</strong>{' '}
        ({registry.toUpperCase()}) could not be resolved to a GitHub repository.
        TechScope can only score packages that link to a GitHub source in their
        registry metadata.
      </p>

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        This is not an error — some packages are private, use a non-GitHub host,
        or omit the repository field in their manifest.
      </p>
    </section>
  );
}

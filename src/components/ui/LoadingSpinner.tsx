export default function LoadingSpinner() {
  return (
    <div
      role="status"
      aria-label="Loading package score"
      className="flex flex-col items-center justify-center gap-4 py-16"
    >
      <span className="spinner" aria-hidden="true" />
      <p className="text-sm text-[var(--text-muted)]">Loading&hellip;</p>
    </div>
  );
}

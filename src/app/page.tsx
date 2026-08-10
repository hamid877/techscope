import type { Metadata } from 'next';
import SearchForm from '@/components/search/SearchForm';

export const metadata: Metadata = {
  title: 'TechScope',
  description:
    'Look up deterministic 0–100 Health Scores for npm and PyPI packages.',
};

export default function HomePage() {
  return (
    <main
      className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24"
      id="main-content"
    >
      {/* Header */}
      <div className="text-center mb-10 max-w-xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-3">
          Tech<span className="text-[var(--accent)]">Scope</span>
        </h1>
        <p className="text-[var(--text-secondary)] text-base sm:text-lg leading-relaxed">
          Deterministic 0–100 Health Scores for npm and PyPI packages —
          computed from six objective ecosystem signals.
        </p>
      </div>

      {/* Search card */}
      <div
        className="card w-full max-w-lg px-6 py-7 sm:px-8 sm:py-8"
        aria-label="Package search"
      >
        <SearchForm />
      </div>

      {/* Methodology note */}
      <p className="mt-6 text-xs text-[var(--text-muted)] text-center max-w-sm">
        Scores are computed deterministically from commit activity, releases,
        issue handling, contributor spread, downloads, and documentation.
        Methodology&nbsp;v1.0.
      </p>
    </main>
  );
}
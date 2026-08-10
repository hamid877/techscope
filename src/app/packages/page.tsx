import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import type { ScoreResponse } from '@/components/package/types';
import ScoreSummary from '@/components/package/ScoreSummary';
import MetricBreakdownTable from '@/components/package/MetricBreakdownTable';
import ExplanationBlock from '@/components/package/ExplanationBlock';
import StateUnsupported from '@/components/package/StateUnsupported';
import StateInsufficient from '@/components/package/StateInsufficient';

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function buildApiBase(): string {
  // In Next.js Server Components we always call our own API routes via the
  // absolute URL. Use NEXT_PUBLIC_BASE_URL when set (for production), fall
  // back to localhost:3000 for development.
  return process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
}

async function fetchScore(name: string, registry: string): Promise<ScoreResponse> {
  const base = buildApiBase();
  const url = `${base}/api/v1/packages?name=${encodeURIComponent(name)}&registry=${encodeURIComponent(registry)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Score API ${res.status}`);
  return res.json() as Promise<ScoreResponse>;
}

async function fetchExplanation(
  name: string,
  registry: string,
): Promise<string | null> {
  try {
    const base = buildApiBase();
    const url = `${base}/api/v1/packages/explanation?name=${encodeURIComponent(name)}&registry=${encodeURIComponent(registry)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { explanation?: string };
    const text = json.explanation?.trim() ?? '';
    return text.length > 0 ? text : null;
  } catch {
    // Explanation failure must never disrupt score display (FR-23 / AC-11).
    return null;
  }
}

/* ─── Page metadata ──────────────────────────────────────────────────────────── */

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const name = typeof sp.name === 'string' ? sp.name : '';
  const registry = typeof sp.registry === 'string' ? sp.registry : '';
  return {
    title: name ? `${name} (${registry})` : 'Package Health',
    description: name
      ? `TechScope Health Score for ${name} on ${registry}.`
      : 'Package Health Score',
  };
}

/* ─── Page component ─────────────────────────────────────────────────────────── */

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const name =
    typeof sp.name === 'string' ? sp.name.trim() : '';
  const registry =
    typeof sp.registry === 'string' ? sp.registry.trim() : '';

  /* Guard: missing or invalid params */
  if (!name || (registry !== 'npm' && registry !== 'pypi')) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="card px-6 py-8 text-center max-w-sm">
          <p className="text-[var(--text-secondary)] text-sm mb-4">
            No package specified. Please use the search form.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-[var(--accent)]
                       hover:text-[var(--accent-hover)] transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  /* Fetch score — errors bubble to Next.js error boundary */
  const scoreData = await fetchScore(name, registry);

  /* Render: unsupported_or_unresolved */
  if (scoreData.reason === 'unsupported_or_unresolved') {
    return (
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10 sm:py-16">
        <PageShell name={name} registry={registry}>
          <StateUnsupported packageName={name} registry={registry} />
        </PageShell>
      </main>
    );
  }

  /* Render: insufficient_data */
  if (scoreData.reason === 'insufficient_data') {
    return (
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10 sm:py-16">
        <PageShell name={name} registry={registry}>
          <StateInsufficient
            data={scoreData}
            packageName={name}
            registry={registry}
          />
        </PageShell>
      </main>
    );
  }

  /* Render: success — fetch explanation in parallel with page render */
  const explanation = await fetchExplanation(name, registry);

  return (
    <main
      id="main-content"
      className="flex-1 flex flex-col items-center justify-start px-4 py-10 sm:py-16"
    >
      <PageShell name={name} registry={registry}>
        <div className="flex flex-col gap-8">
          {/* Score + completeness */}
          <div className="card px-5 py-5 sm:px-7">
            <ScoreSummary data={scoreData} />
          </div>

          {/* Metric breakdown */}
          <MetricBreakdownTable metrics={scoreData.metrics} />

          {/* AI explanation — gracefully degrades */}
          <ExplanationBlock explanation={explanation} />
        </div>
      </PageShell>
    </main>
  );
}

/* ─── Inner shell (back link + package heading) ──────────────────────────────── */

function PageShell({
  name,
  registry,
  children,
}: {
  name: string;
  registry: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-2xl">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)]
                   hover:text-[var(--text-primary)] transition-colors mb-6"
        aria-label="Back to search"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Search
      </Link>

      {/* Package heading */}
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] break-words">
          {name}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 uppercase tracking-wider font-semibold">
          {registry}
        </p>
      </header>

      {children}
    </div>
  );
}

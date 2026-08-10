// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StateInsufficient from '@/components/package/StateInsufficient';
import type { ScoreResponseInsufficient } from '@/components/package/types';

const INSUFFICIENT_DATA: ScoreResponseInsufficient = {
  score: null,
  reason: 'insufficient_data',
  methodology_version: '1.0',
  provisional: false,
  refreshed_at: '2026-01-01T00:00:00.000Z',
  completeness: { health_score: null, metrics_available: 2, metrics_total: 6 },
  metrics: [
    { metric: 'commit_cadence', percentile: 80, weight: 0.20, status: 'success' },
    { metric: 'release_frequency', percentile: null, weight: 0.15, status: 'unavailable' },
  ],
};

describe('StateInsufficient', () => {
  it('renders with heading "Insufficient data"', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.getByText(/insufficient data/i)).toBeInTheDocument();
  });

  it('heading text differs from StateUnsupported heading', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.queryByText(/not supported/i)).not.toBeInTheDocument();
  });

  it('does NOT render a numeric health score', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    // Score ring would have aria label "Health score: X out of 100"
    expect(screen.queryByRole('img', { name: /health score/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 100/)).not.toBeInTheDocument();
  });

  it('shows the available/total metric count', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.getByText(/2 of 6/i)).toBeInTheDocument();
  });

  it('renders the partial metric list', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.getByText(/commit cadence/i)).toBeInTheDocument();
    expect(screen.getByText(/release frequency/i)).toBeInTheDocument();
  });

  it('shows "Unavailable" for metrics with null percentile', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it('shows package name and registry in the banner', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.getByText(/small-pkg/)).toBeInTheDocument();
    expect(screen.getByText(/NPM/)).toBeInTheDocument();
  });

  it('shows methodology_version', () => {
    render(
      <StateInsufficient
        data={INSUFFICIENT_DATA}
        packageName="small-pkg"
        registry="npm"
      />
    );
    expect(screen.getByText(/v1\.0/i)).toBeInTheDocument();
  });
});

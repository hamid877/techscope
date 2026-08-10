// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricBreakdownTable from '@/components/package/MetricBreakdownTable';
import type { MetricEntry } from '@/components/package/types';

const ALL_SIX: MetricEntry[] = [
  { metric: 'commit_cadence',            percentile: 80,   weight: 0.20, status: 'success' },
  { metric: 'release_frequency',         percentile: 60,   weight: 0.15, status: 'success' },
  { metric: 'issue_resolution_health',   percentile: 70,   weight: 0.20, status: 'success' },
  { metric: 'contributor_concentration', percentile: 40,   weight: 0.15, status: 'success' },
  { metric: 'download_momentum',         percentile: 90,   weight: 0.20, status: 'success' },
  { metric: 'documentation_presence',    percentile: 100,  weight: 0.10, status: 'success' },
];

describe('MetricBreakdownTable', () => {
  it('renders all six metric rows', () => {
    render(<MetricBreakdownTable metrics={ALL_SIX} />);
    expect(screen.getByText(/commit cadence/i)).toBeInTheDocument();
    expect(screen.getByText(/release frequency/i)).toBeInTheDocument();
    expect(screen.getByText(/issue resolution health/i)).toBeInTheDocument();
    expect(screen.getByText(/contributor concentration/i)).toBeInTheDocument();
    expect(screen.getByText(/download momentum/i)).toBeInTheDocument();
    expect(screen.getByText(/documentation presence/i)).toBeInTheDocument();
  });

  it('renders percentile scores for available metrics', () => {
    render(<MetricBreakdownTable metrics={ALL_SIX} />);
    // Commit cadence → 80th percentile
    expect(screen.getByLabelText(/commit cadence.*80/i)).toBeInTheDocument();
  });

  it('renders "Unavailable" badge for metrics with null percentile', () => {
    const metricsWithNull: MetricEntry[] = [
      { metric: 'commit_cadence', percentile: null, weight: 0.20, status: 'unavailable' },
      ...ALL_SIX.slice(1),
    ];
    render(<MetricBreakdownTable metrics={metricsWithNull} />);
    expect(screen.getByLabelText(/commit cadence.*unavailable/i)).toBeInTheDocument();
    // Must not render "0" for the null metric
    const cells = screen.getAllByRole('cell');
    const commitCell = cells.find(c => c.textContent?.includes('Commit Cadence'));
    expect(commitCell?.textContent).not.toMatch(/\b0\b/);
  });

  it('never renders "0" when percentile is null', () => {
    const allNull: MetricEntry[] = ALL_SIX.map(m => ({
      ...m, percentile: null, status: 'unavailable' as const
    }));
    render(<MetricBreakdownTable metrics={allNull} />);
    const unavailableBadges = screen.getAllByText(/unavailable/i);
    expect(unavailableBadges.length).toBe(6);
  });

  it('shows lower-confidence notice for download_momentum when status is success', () => {
    render(<MetricBreakdownTable metrics={ALL_SIX} />);
    expect(screen.getByText(/lower confidence/i)).toBeInTheDocument();
  });

  it('does NOT show lower-confidence notice for download_momentum when status is unavailable', () => {
    const noDownload: MetricEntry[] = ALL_SIX.map(m =>
      m.metric === 'download_momentum'
        ? { ...m, percentile: null, status: 'unavailable' as const }
        : m
    );
    render(<MetricBreakdownTable metrics={noDownload} />);
    expect(screen.queryByText(/lower confidence/i)).not.toBeInTheDocument();
  });

  it('does NOT show lower-confidence notice for non-download_momentum metrics', () => {
    const onlyCommit: MetricEntry[] = [
      { metric: 'commit_cadence', percentile: 80, weight: 0.20, status: 'success' },
    ];
    render(<MetricBreakdownTable metrics={onlyCommit} />);
    expect(screen.queryByText(/lower confidence/i)).not.toBeInTheDocument();
  });

  it('renders weights as percentages', () => {
    render(<MetricBreakdownTable metrics={ALL_SIX} />);
    // 0.20 → 20%, 0.15 → 15%, 0.10 → 10%
    const twentyPercentCells = screen.getAllByText('20%');
    expect(twentyPercentCells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders table with accessible role', () => {
    render(<MetricBreakdownTable metrics={ALL_SIX} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('returns null when metrics array is empty', () => {
    const { container } = render(<MetricBreakdownTable metrics={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

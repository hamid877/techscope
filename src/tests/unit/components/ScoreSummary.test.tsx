// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreSummary from '@/components/package/ScoreSummary';
import type { ScoreResponseSuccess, ScoreResponseInsufficient } from '@/components/package/types';

const BASE_DATE = '2026-01-15T12:00:00.000Z';

const SUCCESS_DATA: ScoreResponseSuccess = {
  score: 74,
  reason: null,
  methodology_version: '1.0',
  provisional: false,
  refreshed_at: BASE_DATE,
  completeness: { health_score: 74, metrics_available: 5, metrics_total: 6 },
  metrics: [],
};

describe('ScoreSummary', () => {
  it('renders the numeric score', () => {
    render(<ScoreSummary data={SUCCESS_DATA} />);
    expect(screen.getByText('74')).toBeInTheDocument();
  });

  it('renders score of 0 correctly (not falsy-hidden)', () => {
    const zeroData: ScoreResponseSuccess = { ...SUCCESS_DATA, score: 0 };
    render(<ScoreSummary data={zeroData} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders completeness indicator', () => {
    render(<ScoreSummary data={SUCCESS_DATA} />);
    expect(screen.getByText(/5 of 6 metrics available/i)).toBeInTheDocument();
  });

  it('renders methodology_version label', () => {
    render(<ScoreSummary data={SUCCESS_DATA} />);
    expect(screen.getByText(/v1\.0/i)).toBeInTheDocument();
  });

  it('renders last-refreshed timestamp as a time element', () => {
    render(<ScoreSummary data={SUCCESS_DATA} />);
    const timeEl = screen.getByText(/last refreshed/i).closest('p');
    expect(timeEl?.querySelector('time')).toHaveAttribute('dateTime', BASE_DATE);
  });

  it('does NOT show ProvisionalBanner when provisional is false', () => {
    render(<ScoreSummary data={SUCCESS_DATA} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows ProvisionalBanner when provisional is true', () => {
    const provisionalData: ScoreResponseSuccess = { ...SUCCESS_DATA, provisional: true };
    render(<ScoreSummary data={provisionalData} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/provisional/i);
  });

  it('renders score ring with aria-label', () => {
    render(<ScoreSummary data={SUCCESS_DATA} />);
    expect(screen.getByRole('img', { name: /health score.*74/i })).toBeInTheDocument();
  });

  it('renders "Score unavailable" heading for insufficient_data', () => {
    const insufficientData: ScoreResponseInsufficient = {
      score: null,
      reason: 'insufficient_data',
      methodology_version: '1.0',
      provisional: false,
      refreshed_at: BASE_DATE,
      completeness: { health_score: null, metrics_available: 2, metrics_total: 6 },
      metrics: [],
    };
    render(<ScoreSummary data={insufficientData} />);
    expect(screen.getByText(/score unavailable/i)).toBeInTheDocument();
  });
});

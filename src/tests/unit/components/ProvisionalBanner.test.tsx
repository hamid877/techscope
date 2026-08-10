// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProvisionalBanner from '@/components/package/ProvisionalBanner';

describe('ProvisionalBanner', () => {
  it('renders with role="status"', () => {
    render(<ProvisionalBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('contains "provisional" in its text', () => {
    render(<ProvisionalBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/provisional/i);
  });

  it('contains text about limited data or limited history', () => {
    render(<ProvisionalBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/less than 90 days/i);
  });

  it('has aria-live="polite" attribute', () => {
    render(<ProvisionalBanner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('does not show a numeric score (banner is additive, not replacing)', () => {
    render(<ProvisionalBanner />);
    // No score number should be in the banner itself
    expect(screen.getByRole('status').textContent).not.toMatch(/\b\d{1,3}\s*\/\s*100\b/);
  });
});

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StateUnsupported from '@/components/package/StateUnsupported';

describe('StateUnsupported', () => {
  it('renders an explicit "not supported" message', () => {
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    expect(screen.getByText(/package not supported/i)).toBeInTheDocument();
  });

  it('shows the package name and registry', () => {
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    expect(screen.getByText(/my-pkg/)).toBeInTheDocument();
    expect(screen.getByText(/NPM/)).toBeInTheDocument();
  });

  it('does not render any score element', () => {
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    // Score ring would have role="img" with "health score" in its label
    expect(screen.queryByRole('img', { name: /health score/i })).not.toBeInTheDocument();
    // No numeric score text matching "X / 100"
    expect(screen.queryByText(/\/ 100/)).not.toBeInTheDocument();
  });

  it('does not render any metric row', () => {
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/commit cadence/i)).not.toBeInTheDocument();
  });

  it('has an accessible heading', () => {
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    expect(screen.getByRole('heading', { name: /not supported/i })).toBeInTheDocument();
  });

  it('heading text differs from StateInsufficient heading', () => {
    // StateInsufficient heading contains "Insufficient data"
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    expect(screen.queryByText(/insufficient data/i)).not.toBeInTheDocument();
  });

  it('explains that the package could not be resolved to GitHub', () => {
    render(<StateUnsupported packageName="my-pkg" registry="npm" />);
    const githubMentions = screen.getAllByText(/github/i);
    expect(githubMentions.length).toBeGreaterThan(0);
  });
});

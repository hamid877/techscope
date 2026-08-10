// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExplanationBlock from '@/components/package/ExplanationBlock';

describe('ExplanationBlock', () => {
  it('renders the explanation text when provided', () => {
    render(<ExplanationBlock explanation="This package is actively maintained." />);
    expect(screen.getByText(/actively maintained/i)).toBeInTheDocument();
  });

  it('renders graceful fallback when explanation is null', () => {
    render(<ExplanationBlock explanation={null} />);
    expect(screen.getByText(/explanation currently unavailable/i)).toBeInTheDocument();
  });

  it('renders graceful fallback when explanation is an empty string', () => {
    render(<ExplanationBlock explanation="" />);
    expect(screen.getByText(/explanation currently unavailable/i)).toBeInTheDocument();
  });

  it('renders graceful fallback when explanation is whitespace only', () => {
    render(<ExplanationBlock explanation="   " />);
    expect(screen.getByText(/explanation currently unavailable/i)).toBeInTheDocument();
  });

  it('has an accessible heading for the explanation section', () => {
    render(<ExplanationBlock explanation="Some explanation." />);
    expect(screen.getByRole('heading', { name: /ai explanation/i })).toBeInTheDocument();
  });

  it('does not render a chat or follow-up input', () => {
    render(<ExplanationBlock explanation="Some explanation." />);
    // No text input, textarea, or button for follow-up
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the architectural separation note', () => {
    render(<ExplanationBlock explanation="Some explanation." />);
    expect(
      screen.getByText(/ai cannot alter the score/i)
    ).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchForm from '@/components/search/SearchForm';

// Mock next/navigation — SearchForm calls useRouter().push
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('SearchForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders with npm selected by default', () => {
    render(<SearchForm />);
    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const npmRadio = radios.find(r => r.value === 'npm');
    expect(npmRadio).toBeDefined();
    expect(npmRadio!.checked).toBe(true);
  });

  it('renders both registry options', () => {
    render(<SearchForm />);
    expect(screen.getByLabelText(/npm/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pypi/i)).toBeInTheDocument();
  });

  it('renders the package name input', () => {
    render(<SearchForm />);
    expect(screen.getByLabelText(/package name/i)).toBeInTheDocument();
  });

  it('renders a Search button', () => {
    render(<SearchForm />);
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitted with an empty name', async () => {
    render(<SearchForm />);
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows a validation error when name is all whitespace', async () => {
    render(<SearchForm />);
    const input = screen.getByLabelText(/package name/i);
    await userEvent.type(input, '   ');
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to /packages with correct query params on valid submit (npm)', async () => {
    render(<SearchForm />);
    const input = screen.getByLabelText(/package name/i);
    await userEvent.type(input, 'react');
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/packages?name=react&registry=npm');
    });
  });

  it('navigates with pypi registry when selected', async () => {
    render(<SearchForm />);
    const pypiLabel = screen.getByLabelText(/pypi/i);
    await userEvent.click(pypiLabel);
    const input = screen.getByLabelText(/package name/i);
    await userEvent.type(input, 'requests');
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/packages?name=requests&registry=pypi');
    });
  });

  it('URL-encodes special characters in the package name', async () => {
    render(<SearchForm />);
    const input = screen.getByLabelText(/package name/i);
    await userEvent.type(input, 'my package!');
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/packages?name=')
      );
      // URLSearchParams encodes spaces as +; decode both + and %20
      const call = mockPush.mock.calls[0][0] as string;
      const decoded = decodeURIComponent(call.replace(/\+/g, ' '));
      expect(decoded).toContain('my package');
    });
  });

  it('trims leading/trailing whitespace from the package name before navigating', async () => {
    render(<SearchForm />);
    const input = screen.getByLabelText(/package name/i);
    await userEvent.type(input, '  react  ');
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      const call = mockPush.mock.calls[0][0] as string;
      expect(call).toContain('name=react');
    });
  });

  it('marks the name input as aria-invalid when there is an error', async () => {
    render(<SearchForm />);
    const button = screen.getByRole('button', { name: /search/i });
    await userEvent.click(button);
    await waitFor(() => {
      const input = screen.getByLabelText(/package name/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('form has an accessible aria-label', () => {
    render(<SearchForm />);
    expect(screen.getByRole('form', { name: /package search/i })).toBeInTheDocument();
  });
});

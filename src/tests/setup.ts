/**
 * Global Vitest setup file.
 *
 * Imports @testing-library/jest-dom so that its custom matchers
 * (toBeInTheDocument, toHaveAttribute, etc.) are available in every test file.
 * This works because vitest.config.mts sets globals: true, which makes
 * Vitest's `expect` available globally before this file runs.
 */
import '@testing-library/jest-dom';

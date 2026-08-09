import { describe, expect, it } from 'vitest';
import { BENCHMARK_DATASET } from '../../../../infrastructure/benchmark/benchmark-data';

describe('Benchmark Dataset', () => {
  it('validates all benchmark entries if the dataset is populated', () => {
    // If the dataset is empty, this test passes trivially.
    // If populated, it ensures every entry conforms to the schema and methodology rules.
    const validRegistries = ['npm', 'pypi'];
    const validTiers = ['Thriving', 'Stable', 'Declining', 'Abandoned'];

    for (const entry of BENCHMARK_DATASET) {
      expect(validRegistries).toContain(entry.registry);
      expect(validTiers).toContain(entry.tier);
      
      expect(typeof entry.packageName).toBe('string');
      expect(entry.packageName.trim().length).toBeGreaterThan(0);
      
      expect(typeof entry.justification).toBe('string');
      expect(entry.justification.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains entries from both npm and PyPI if the dataset is populated', () => {
    if (BENCHMARK_DATASET.length > 0) {
      const registries = new Set(BENCHMARK_DATASET.map((entry) => entry.registry));
      expect(registries.has('npm')).toBe(true);
      expect(registries.has('pypi')).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { BENCHMARK_DATASET } from '../../../../infrastructure/benchmark/benchmark-data';
import { DatasetValidator } from '../../../../infrastructure/benchmark/DatasetValidator';

describe('Benchmark Dataset', () => {
  it('validates all benchmark entries if the dataset is populated', () => {
    // If the dataset is empty, this test passes trivially.
    // If populated, it ensures every entry conforms to the schema and methodology rules.
    const errors = DatasetValidator.validateDataset(BENCHMARK_DATASET);
    expect(errors).toEqual([]);
  });

  it('contains entries from both npm and PyPI if the dataset is populated', () => {
    if (BENCHMARK_DATASET.length > 0) {
      const registries = new Set(BENCHMARK_DATASET.map((entry) => entry.registry));
      expect(registries.has('npm')).toBe(true);
      expect(registries.has('pypi')).toBe(true);
    }
  });
});

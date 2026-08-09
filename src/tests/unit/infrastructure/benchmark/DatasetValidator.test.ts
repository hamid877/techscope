import { describe, expect, it } from 'vitest';
import { DatasetValidator } from '../../../../infrastructure/benchmark/DatasetValidator';
import { BenchmarkEntry, BenchmarkTier } from '../../../../infrastructure/benchmark/types';

describe('DatasetValidator', () => {
  describe('validateEntry', () => {
    it('returns empty array for a valid entry', () => {
      const entry: BenchmarkEntry = {
        registry: 'npm',
        packageName: 'react',
        tier: 'Thriving',
        justification: 'Widely used',
        githubOwner: 'facebook',
        githubRepo: 'react',
      };
      expect(DatasetValidator.validateEntry(entry)).toEqual([]);
    });

    it('rejects invalid registries', () => {
      const entry = {
        registry: 'invalid',
        packageName: 'react',
        tier: 'Thriving',
        justification: 'Widely used'
      } as unknown as BenchmarkEntry;
      const errors = DatasetValidator.validateEntry(entry);
      expect(errors).toContain('Invalid registry: invalid');
    });

    it('rejects invalid tiers', () => {
      const entry = {
        registry: 'npm',
        packageName: 'react',
        tier: 'Super',
        justification: 'Widely used'
      } as unknown as BenchmarkEntry;
      const errors = DatasetValidator.validateEntry(entry);
      expect(errors).toContain('Invalid tier: Super');
    });

    it('rejects empty package names', () => {
      const entry: BenchmarkEntry = {
        registry: 'npm',
        packageName: '   ',
        tier: 'Thriving',
        justification: 'Widely used'
      };
      const errors = DatasetValidator.validateEntry(entry);
      expect(errors).toContain('Package name cannot be empty');
    });

    it('rejects empty justification', () => {
      const entry: BenchmarkEntry = {
        registry: 'npm',
        packageName: 'react',
        tier: 'Thriving',
        justification: ''
      };
      const errors = DatasetValidator.validateEntry(entry);
      expect(errors).toContain('Justification cannot be empty');
    });

    it('rejects empty GitHub fields if specified', () => {
      const entry: BenchmarkEntry = {
        registry: 'npm',
        packageName: 'react',
        tier: 'Thriving',
        justification: 'Widely used',
        githubOwner: '  ',
        githubRepo: ''
      };
      const errors = DatasetValidator.validateEntry(entry);
      expect(errors).toContain('GitHub owner cannot be empty if specified');
      expect(errors).toContain('GitHub repository cannot be empty if specified');
    });

    it('rejects malformed GitHub identifiers', () => {
      const entry: BenchmarkEntry = {
        registry: 'npm',
        packageName: 'react',
        tier: 'Thriving',
        justification: 'Widely used',
        githubOwner: 'face book!',
        githubRepo: 'react repo?'
      };
      const errors = DatasetValidator.validateEntry(entry);
      expect(errors).toContain('Malformed GitHub owner: face book!');
      expect(errors).toContain('Malformed GitHub repo: react repo?');
    });
  });

  describe('validateDataset', () => {
    it('returns errors for duplicate registry+package combinations', () => {
      const dataset: BenchmarkEntry[] = [
        { registry: 'npm', packageName: 'react', tier: 'Thriving', justification: 'Widely used' },
        { registry: 'npm', packageName: 'react', tier: 'Stable', justification: 'Still widely used' }
      ];
      const errors = DatasetValidator.validateDataset(dataset);
      expect(errors.some(e => e.includes('Duplicate package found: npm/react'))).toBe(true);
    });

    it('returns empty for valid empty dataset behavior (normal validation)', () => {
      const errors = DatasetValidator.validateDataset([]);
      expect(errors).toEqual([]);
    });
  });

  describe('validateDatasetReadiness', () => {
    const tiers: string[] = ['Thriving', 'Stable', 'Declining', 'Abandoned'];

    const createValidDataset = (length: number): BenchmarkEntry[] => {
      return Array.from({ length }, (_, i) => ({
        registry: 'npm',
        packageName: `pkg-${i}`,
        tier: tiers[i % 4] as BenchmarkTier,
        justification: 'Test',
        githubOwner: 'owner',
        githubRepo: `repo-${i}`
      }));
    };

    it('rejects dataset size less than 50 (49 => not ready)', () => {
      const dataset = createValidDataset(49);
      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors.some(e => e.includes('Dataset size must be between 50 and 100'))).toBe(true);
    });

    it('accepts dataset size of 50 (ready if all other requirements are satisfied)', () => {
      const dataset = createValidDataset(50);
      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors).toEqual([]);
    });

    it('accepts dataset size of 100 (ready if all other requirements are satisfied)', () => {
      const dataset = createValidDataset(100);
      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors).toEqual([]);
    });

    it('rejects dataset size greater than 100 (101 => not ready)', () => {
      const dataset = createValidDataset(101);
      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors.some(e => e.includes('Dataset size must be between 50 and 100'))).toBe(true);
    });

    it('rejects dataset missing required tiers', () => {
      const dataset = createValidDataset(50).map((e, i) => ({
        ...e,
        tier: i % 2 === 0 ? 'Thriving' : 'Stable'
      } as BenchmarkEntry));
      
      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors.some(e => e.includes('Missing required tier: Declining'))).toBe(true);
      expect(errors.some(e => e.includes('Missing required tier: Abandoned'))).toBe(true);
    });

    it('rejects an otherwise valid 50-entry dataset containing an entry without githubOwner/githubRepo (NOT ready)', () => {
      const dataset = createValidDataset(50);
      // Remove GitHub coordinates from one entry
      delete dataset[10].githubOwner;
      delete dataset[10].githubRepo;

      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors.some(e => e.includes('missing required GitHub coordinates'))).toBe(true);
    });

    it('accepts a valid 50-entry dataset where every entry has GitHub coordinates', () => {
      const dataset = createValidDataset(50);
      const errors = DatasetValidator.validateDatasetReadiness(dataset);
      expect(errors).toEqual([]);
    });
  });
});

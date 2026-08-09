import { describe, expect, it } from 'vitest';
import { BenchmarkPopulationService } from '../../../../infrastructure/benchmark/BenchmarkPopulationService';
import { BenchmarkPackageMetrics } from '../../../../infrastructure/benchmark/types';

describe('BenchmarkPopulationService', () => {
  describe('extractPopulations', () => {
    it('returns empty populations when given an empty dataset', () => {
      const populations = BenchmarkPopulationService.extractPopulations([]);
      expect(populations).toEqual({
        commitCadence: [],
        releaseFrequency: [],
        issueResolutionHealth: [],
        contributorConcentration: [],
        downloadMomentum: [],
        documentationPresence: [],
      });
    });

    it('extracts valid metrics into their respective populations', () => {
      const metricsList: BenchmarkPackageMetrics[] = [
        {
          commitCadence: 10,
          releaseFrequency: 2,
          issueResolutionHealth: { resolutionRate: 0.8, medianDaysToClose: 5 },
          contributorConcentration: 0.5,
          downloadMomentum: 1.5,
          documentationPresence: 2,
        },
        {
          commitCadence: 20,
          releaseFrequency: 5,
          issueResolutionHealth: { resolutionRate: 0.9, medianDaysToClose: 2 },
          contributorConcentration: 0.3,
          downloadMomentum: 2.1,
          documentationPresence: 3,
        },
      ];

      const populations = BenchmarkPopulationService.extractPopulations(metricsList);

      expect(populations.commitCadence).toEqual([10, 20]);
      expect(populations.releaseFrequency).toEqual([2, 5]);
      expect(populations.issueResolutionHealth).toEqual([
        { resolutionRate: 0.8, medianDaysToClose: 5 },
        { resolutionRate: 0.9, medianDaysToClose: 2 },
      ]);
      expect(populations.contributorConcentration).toEqual([0.5, 0.3]);
      expect(populations.downloadMomentum).toEqual([1.5, 2.1]);
      expect(populations.documentationPresence).toEqual([2, 3]);
    });

    it('excludes null metric values without zero-filling', () => {
      const metricsList: BenchmarkPackageMetrics[] = [
        {
          commitCadence: null,
          releaseFrequency: 2,
          issueResolutionHealth: null,
          contributorConcentration: null,
          downloadMomentum: 1.5,
          documentationPresence: null,
        },
      ];

      const populations = BenchmarkPopulationService.extractPopulations(metricsList);

      expect(populations.commitCadence).toEqual([]);
      expect(populations.releaseFrequency).toEqual([2]);
      expect(populations.issueResolutionHealth).toEqual([]);
      expect(populations.contributorConcentration).toEqual([]);
      expect(populations.downloadMomentum).toEqual([1.5]);
      expect(populations.documentationPresence).toEqual([]);
    });

    it('excludes Issue Resolution Health if any component is null', () => {
      const metricsList: BenchmarkPackageMetrics[] = [
        {
          commitCadence: 10,
          releaseFrequency: 2,
          issueResolutionHealth: { resolutionRate: null, medianDaysToClose: 5 },
          contributorConcentration: 0.5,
          downloadMomentum: 1.5,
          documentationPresence: 2,
        },
        {
          commitCadence: 10,
          releaseFrequency: 2,
          issueResolutionHealth: { resolutionRate: 0.8, medianDaysToClose: null },
          contributorConcentration: 0.5,
          downloadMomentum: 1.5,
          documentationPresence: 2,
        },
      ];

      const populations = BenchmarkPopulationService.extractPopulations(metricsList);

      expect(populations.issueResolutionHealth).toEqual([]);
    });

    it('preserves deterministic ordering based on input order', () => {
      const metricsList: BenchmarkPackageMetrics[] = [
        {
          commitCadence: 50,
          releaseFrequency: null,
          issueResolutionHealth: null,
          contributorConcentration: null,
          downloadMomentum: null,
          documentationPresence: null,
        },
        {
          commitCadence: 10,
          releaseFrequency: null,
          issueResolutionHealth: null,
          contributorConcentration: null,
          downloadMomentum: null,
          documentationPresence: null,
        },
        {
          commitCadence: 100,
          releaseFrequency: null,
          issueResolutionHealth: null,
          contributorConcentration: null,
          downloadMomentum: null,
          documentationPresence: null,
        },
      ];

      const populations = BenchmarkPopulationService.extractPopulations(metricsList);

      expect(populations.commitCadence).toEqual([50, 10, 100]);
    });
  });
});

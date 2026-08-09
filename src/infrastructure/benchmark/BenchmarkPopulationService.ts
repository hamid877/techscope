import { V1BenchmarkPopulations } from '../../domain/services/V1ScoringService';
import { BenchmarkPackageMetrics } from './types';

export class BenchmarkPopulationService {
  /**
   * Transforms successfully collected benchmark metric raw values into V1 reference populations.
   * Missing metric values are excluded (not zero-filled).
   * For Issue Resolution Health, the complete raw component object is preserved, provided both
   * components are non-null.
   * 
   * @param metricsList Array of successfully collected benchmark package metrics
   * @returns V1BenchmarkPopulations containing arrays of valid metric values
   */
  public static extractPopulations(metricsList: BenchmarkPackageMetrics[]): V1BenchmarkPopulations {
    const populations: V1BenchmarkPopulations = {
      commitCadence: [],
      releaseFrequency: [],
      issueResolutionHealth: [],
      contributorConcentration: [],
      downloadMomentum: [],
      documentationPresence: [],
    };

    for (const metrics of metricsList) {
      if (metrics.commitCadence !== null) {
        populations.commitCadence.push(metrics.commitCadence);
      }

      if (metrics.releaseFrequency !== null) {
        populations.releaseFrequency.push(metrics.releaseFrequency);
      }

      if (
        metrics.issueResolutionHealth !== null &&
        metrics.issueResolutionHealth.resolutionRate !== null &&
        metrics.issueResolutionHealth.medianDaysToClose !== null
      ) {
        populations.issueResolutionHealth.push(metrics.issueResolutionHealth);
      }

      if (metrics.contributorConcentration !== null) {
        populations.contributorConcentration.push(metrics.contributorConcentration);
      }

      if (metrics.downloadMomentum !== null) {
        populations.downloadMomentum.push(metrics.downloadMomentum);
      }

      if (metrics.documentationPresence !== null) {
        populations.documentationPresence.push(metrics.documentationPresence);
      }
    }

    return populations;
  }
}

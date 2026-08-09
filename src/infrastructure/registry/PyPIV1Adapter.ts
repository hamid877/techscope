import { SignalResult, DownloadMomentumSignal } from '../../domain/types/raw-signals';
import { RegistryAdapter } from './RegistryAdapter';
import { PyPIClient } from './PyPIClient';

export class PyPIV1Adapter implements RegistryAdapter {
  private client: PyPIClient;

  constructor(client: PyPIClient = new PyPIClient()) {
    this.client = client;
  }

  async getDownloadMomentum(packageName: string): Promise<SignalResult<DownloadMomentumSignal>> {
    const response = await this.client.getOverallDownloads(packageName);
    
    if (!response || !Array.isArray(response.data) || response.data.length === 0) {
      return {
        status: 'unavailable',
        metricName: 'download_momentum',
        reason: 'insufficient_data'
      };
    }

    const withoutMirrors = response.data.filter(d => d.category === 'without_mirrors');
    
    if (withoutMirrors.length === 0) {
      return {
        status: 'unavailable',
        metricName: 'download_momentum',
        reason: 'insufficient_data'
      };
    }

    // Sort by date descending
    withoutMirrors.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const maxDate = new Date(withoutMirrors[0].date);
    // Create a Set of all available dates from the API
    const availableDates = new Set(withoutMirrors.map(d => d.date));

    const current30DaysStart = new Date(maxDate);
    current30DaysStart.setUTCDate(current30DaysStart.getUTCDate() - 29); // 30 days inclusive

    const prior30DaysStart = new Date(current30DaysStart);
    prior30DaysStart.setUTCDate(prior30DaysStart.getUTCDate() - 30);
    
    const prior30DaysEnd = new Date(current30DaysStart);
    prior30DaysEnd.setUTCDate(prior30DaysEnd.getUTCDate() - 1);

    // Verify that every single day in the 60-day window has an observation
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const checkDate = new Date(prior30DaysStart);
    while (checkDate <= maxDate) {
      if (!availableDates.has(formatDate(checkDate))) {
        return {
          status: 'unavailable',
          metricName: 'download_momentum',
          reason: 'insufficient_data'
        };
      }
      checkDate.setUTCDate(checkDate.getUTCDate() + 1);
    }

    let current30DayDownloads = 0;
    let prior30DayDownloads = 0;

    for (const record of withoutMirrors) {
      const recordDate = new Date(record.date);
      
      if (recordDate >= current30DaysStart && recordDate <= maxDate) {
        current30DayDownloads += record.downloads;
      } else if (recordDate >= prior30DaysStart && recordDate <= prior30DaysEnd) {
        prior30DayDownloads += record.downloads;
      }
    }

    return {
      status: 'success',
      metricName: 'download_momentum',
      data: {
        current30DayDownloads,
        prior30DayDownloads,
        lowerConfidence: true
      }
    };
  }
}

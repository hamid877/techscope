import { SignalResult, DownloadMomentumSignal } from '../../domain/types/raw-signals';
import { RegistryAdapter } from './RegistryAdapter';
import { NpmClient } from './NpmClient';

export class NpmV1Adapter implements RegistryAdapter {
  private client: NpmClient;

  constructor(client: NpmClient = new NpmClient()) {
    this.client = client;
  }

  async getDownloadMomentum(packageName: string): Promise<SignalResult<DownloadMomentumSignal>> {
    const currentData = await this.client.getDownloads('last-month', packageName);
    if (!currentData || currentData.downloads == null || !currentData.start) {
      return {
        status: 'unavailable',
        metricName: 'download_momentum',
        reason: 'insufficient_data'
      };
    }

    const current30DayDownloads = currentData.downloads;

    // Calculate previous 30-day period based on the start date of the current data
    const currentStartDate = new Date(currentData.start);
    
    // The previous period ends 1 day before the current period starts
    const previousEndDate = new Date(currentStartDate);
    previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
    
    // The previous period starts 29 days before it ends (total 30 days)
    const previousStartDate = new Date(previousEndDate);
    previousStartDate.setUTCDate(previousStartDate.getUTCDate() - 29);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const previousPeriod = `${formatDate(previousStartDate)}:${formatDate(previousEndDate)}`;

    const priorData = await this.client.getDownloads(previousPeriod, packageName);
    
    if (!priorData || priorData.downloads == null) {
      return {
        status: 'unavailable',
        metricName: 'download_momentum',
        reason: 'insufficient_data'
      };
    }

    const prior30DayDownloads = priorData.downloads;

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

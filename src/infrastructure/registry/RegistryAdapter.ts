import { SignalResult, DownloadMomentumSignal } from '../../domain/types/raw-signals';

export interface RegistryAdapter {
  getDownloadMomentum(packageName: string): Promise<SignalResult<DownloadMomentumSignal>>;
}

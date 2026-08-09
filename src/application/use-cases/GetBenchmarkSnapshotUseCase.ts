import { BenchmarkSnapshotRepository } from '../interfaces/BenchmarkSnapshotRepository';
import { V1BenchmarkPopulations } from '../../domain/services/V1ScoringService';

export class GetBenchmarkSnapshotUseCase {
  constructor(private readonly repository: BenchmarkSnapshotRepository) {}

  async execute(): Promise<V1BenchmarkPopulations> {
    const snapshot = await this.repository.getLatestSnapshot();

    if (!snapshot) {
      throw new Error('Benchmark snapshot not found');
    }

    if (snapshot.methodologyVersion !== '1.0') {
      throw new Error(`Snapshot methodology version mismatch: expected 1.0, got ${snapshot.methodologyVersion}`);
    }

    if (!snapshot.populations || typeof snapshot.populations !== 'object') {
      throw new Error('Benchmark snapshot is corrupt or missing population data');
    }

    return snapshot.populations;
  }
}

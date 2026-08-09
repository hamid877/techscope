import { V1BenchmarkPopulations } from '../../domain/services/V1ScoringService';

export interface BenchmarkSnapshotRecord {
  methodologyVersion: string;
  populations: V1BenchmarkPopulations;
  updatedAt: Date;
}

export interface BenchmarkSnapshotRepository {
  getLatestSnapshot(): Promise<BenchmarkSnapshotRecord | null>;
  saveSnapshot(record: BenchmarkSnapshotRecord): Promise<void>;
}

import { Registry } from '../../domain/types/registry';

export interface PackageScoreRecord {
  packageName: string;
  registry: Registry;
  status: 'success' | 'unsupported_or_unresolved' | 'insufficient_data';
  healthScore: number | null;
  metricsAvailable: number | null;
  metricsTotal: number | null;
  methodologyVersion: string;
  isProvisional: boolean;
  metricsBreakdown: Record<string, unknown>[] | null; // Represents the serialized MetricResult[] + status flags
  calculatedAt: Date;
  refreshedAt: Date;
}

export interface PackageScoreRepository {
  findByPackageAndRegistry(packageName: string, registry: Registry): Promise<PackageScoreRecord | null>;
  findAll(): Promise<PackageScoreRecord[]>;
  save(record: PackageScoreRecord): Promise<void>;
}

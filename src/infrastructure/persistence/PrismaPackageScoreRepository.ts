import { PrismaClient } from '@prisma/client';
import { PackageScoreRepository, PackageScoreRecord } from '../../application/interfaces/PackageScoreRepository';
import { Registry } from '../../domain/types/registry';

export class PrismaPackageScoreRepository implements PackageScoreRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPackageAndRegistry(packageName: string, registry: Registry): Promise<PackageScoreRecord | null> {
    const record = await this.prisma.packageScore.findUnique({
      where: {
        packageName_registry: {
          packageName,
          registry
        }
      }
    });

    if (!record) return null;

    return {
      packageName: record.packageName,
      registry: record.registry as Registry,
      status: record.status as 'success' | 'unsupported_or_unresolved' | 'insufficient_data',
      healthScore: record.healthScore,
      metricsAvailable: record.metricsAvailable,
      metricsTotal: record.metricsTotal,
      methodologyVersion: record.methodologyVersion,
      isProvisional: record.isProvisional,
      metricsBreakdown: record.metricsBreakdown ? JSON.parse(record.metricsBreakdown) : null,
      calculatedAt: record.calculatedAt,
      refreshedAt: record.refreshedAt
    };
  }

  async save(record: PackageScoreRecord): Promise<void> {
    await this.prisma.packageScore.upsert({
      where: {
        packageName_registry: {
          packageName: record.packageName,
          registry: record.registry
        }
      },
      update: {
        status: record.status,
        healthScore: record.healthScore,
        metricsAvailable: record.metricsAvailable,
        metricsTotal: record.metricsTotal,
        methodologyVersion: record.methodologyVersion,
        isProvisional: record.isProvisional,
        metricsBreakdown: record.metricsBreakdown ? JSON.stringify(record.metricsBreakdown) : null,
        calculatedAt: record.calculatedAt,
        refreshedAt: record.refreshedAt
      },
      create: {
        packageName: record.packageName,
        registry: record.registry,
        status: record.status,
        healthScore: record.healthScore,
        metricsAvailable: record.metricsAvailable,
        metricsTotal: record.metricsTotal,
        methodologyVersion: record.methodologyVersion,
        isProvisional: record.isProvisional,
        metricsBreakdown: record.metricsBreakdown ? JSON.stringify(record.metricsBreakdown) : null,
        calculatedAt: record.calculatedAt,
        refreshedAt: record.refreshedAt
      }
    });
  }
}

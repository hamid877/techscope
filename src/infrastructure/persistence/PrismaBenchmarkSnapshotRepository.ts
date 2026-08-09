import { PrismaClient } from '@prisma/client';
import { BenchmarkSnapshotRepository, BenchmarkSnapshotRecord } from '../../application/interfaces/BenchmarkSnapshotRepository';

export class PrismaBenchmarkSnapshotRepository implements BenchmarkSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getLatestSnapshot(): Promise<BenchmarkSnapshotRecord | null> {
    const record = await this.prisma.benchmarkSnapshot.findUnique({
      where: { id: 1 }
    });

    if (!record) return null;

    return {
      methodologyVersion: record.methodologyVersion,
      populations: JSON.parse(record.populations),
      updatedAt: record.updatedAt
    };
  }

  async saveSnapshot(record: BenchmarkSnapshotRecord): Promise<void> {
    await this.prisma.benchmarkSnapshot.upsert({
      where: { id: 1 },
      update: {
        methodologyVersion: record.methodologyVersion,
        populations: JSON.stringify(record.populations),
        updatedAt: record.updatedAt
      },
      create: {
        id: 1,
        methodologyVersion: record.methodologyVersion,
        populations: JSON.stringify(record.populations),
        updatedAt: record.updatedAt
      }
    });
  }
}

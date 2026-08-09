import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaBenchmarkSnapshotRepository } from '@/infrastructure/persistence/PrismaBenchmarkSnapshotRepository';
import { BenchmarkSnapshotRecord } from '@/application/interfaces/BenchmarkSnapshotRepository';

describe('PrismaBenchmarkSnapshotRepository', () => {
  let prismaMock: { benchmarkSnapshot: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn>; } };
  let repository: PrismaBenchmarkSnapshotRepository;

  beforeEach(() => {
    prismaMock = {
      benchmarkSnapshot: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      }
    };
    repository = new PrismaBenchmarkSnapshotRepository(prismaMock as unknown as PrismaClient);
  });

  describe('getLatestSnapshot', () => {
    it('returns null if not found', async () => {
      prismaMock.benchmarkSnapshot.findUnique.mockResolvedValue(null);
      const result = await repository.getLatestSnapshot();
      expect(result).toBeNull();
      expect(prismaMock.benchmarkSnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('returns parsed record if found', async () => {
      prismaMock.benchmarkSnapshot.findUnique.mockResolvedValue({
        methodologyVersion: '1.0',
        populations: JSON.stringify({ commitCadence: [1, 2, 3] }),
        updatedAt: new Date('2026-08-01T00:00:00Z')
      });

      const result = await repository.getLatestSnapshot();
      expect(result?.methodologyVersion).toBe('1.0');
      expect(result?.populations).toEqual({ commitCadence: [1, 2, 3] });
    });
  });

  describe('saveSnapshot', () => {
    it('upserts the snapshot with correct payload', async () => {
      const record: BenchmarkSnapshotRecord = {
        methodologyVersion: '1.0',
        populations: { commitCadence: [1, 2, 3] } as unknown as BenchmarkSnapshotRecord['populations'],
        updatedAt: new Date('2026-08-01T00:00:00Z')
      };

      await repository.saveSnapshot(record);

      expect(prismaMock.benchmarkSnapshot.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: expect.objectContaining({ methodologyVersion: '1.0' }),
        create: expect.objectContaining({ populations: JSON.stringify(record.populations) })
      });
    });
  });
});

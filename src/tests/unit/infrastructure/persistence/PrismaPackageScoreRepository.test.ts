import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPackageScoreRepository } from '@/infrastructure/persistence/PrismaPackageScoreRepository';
import { PackageScoreRecord } from '@/application/interfaces/PackageScoreRepository';

describe('PrismaPackageScoreRepository', () => {
  let prismaMock: { packageScore: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn>; } };
  let repository: PrismaPackageScoreRepository;

  beforeEach(() => {
    prismaMock = {
      packageScore: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      }
    };
    repository = new PrismaPackageScoreRepository(prismaMock as unknown as PrismaClient);
  });

  describe('findByPackageAndRegistry', () => {
    it('returns null if not found', async () => {
      prismaMock.packageScore.findUnique.mockResolvedValue(null);
      const result = await repository.findByPackageAndRegistry('react', 'npm');
      expect(result).toBeNull();
      expect(prismaMock.packageScore.findUnique).toHaveBeenCalledWith({
        where: { packageName_registry: { packageName: 'react', registry: 'npm' } }
      });
    });

    it('returns parsed record if found', async () => {
      prismaMock.packageScore.findUnique.mockResolvedValue({
        packageName: 'react',
        registry: 'npm',
        status: 'success',
        healthScore: 74,
        metricsAvailable: 5,
        metricsTotal: 6,
        methodologyVersion: '1.0',
        isProvisional: false,
        metricsBreakdown: JSON.stringify([{ metric: 'commit_cadence', percentile: 80, weight: 0.2, status: 'success' }]),
        calculatedAt: new Date('2026-08-01T00:00:00Z'),
        refreshedAt: new Date('2026-08-01T00:00:00Z')
      });

      const result = await repository.findByPackageAndRegistry('react', 'npm');
      expect(result?.packageName).toBe('react');
      expect(result?.healthScore).toBe(74);
      expect(result?.metricsBreakdown).toEqual([{ metric: 'commit_cadence', percentile: 80, weight: 0.2, status: 'success' }]);
    });
  });

  describe('save', () => {
    it('upserts the record with correct payload', async () => {
      const record: PackageScoreRecord = {
        packageName: 'react',
        registry: 'npm',
        status: 'success',
        healthScore: 74,
        metricsAvailable: 5,
        metricsTotal: 6,
        methodologyVersion: '1.0',
        isProvisional: false,
        metricsBreakdown: [{ metric: 'commit_cadence', percentile: 80, weight: 0.2, status: 'success' }],
        calculatedAt: new Date('2026-08-01T00:00:00Z'),
        refreshedAt: new Date('2026-08-01T00:00:00Z')
      };

      await repository.save(record);

      expect(prismaMock.packageScore.upsert).toHaveBeenCalledWith({
        where: { packageName_registry: { packageName: 'react', registry: 'npm' } },
        update: expect.objectContaining({ healthScore: 74 }),
        create: expect.objectContaining({ healthScore: 74, metricsBreakdown: JSON.stringify(record.metricsBreakdown) })
      });
    });
  });
});

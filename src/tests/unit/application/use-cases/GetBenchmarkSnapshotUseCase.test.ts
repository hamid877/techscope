import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetBenchmarkSnapshotUseCase } from '@/application/use-cases/GetBenchmarkSnapshotUseCase';
import { BenchmarkSnapshotRepository } from '@/application/interfaces/BenchmarkSnapshotRepository';
import { V1BenchmarkPopulations } from '@/domain/services/V1ScoringService';

describe('GetBenchmarkSnapshotUseCase', () => {
  let repository: BenchmarkSnapshotRepository;
  let useCase: GetBenchmarkSnapshotUseCase;

  beforeEach(() => {
    repository = {
      getLatestSnapshot: vi.fn(),
      saveSnapshot: vi.fn(),
    };
    useCase = new GetBenchmarkSnapshotUseCase(repository);
  });

  it('successfully retrieves and deserializes the snapshot', async () => {
    const mockPopulations = {
      commitCadence: [1, 2, 3],
      releaseFrequency: [10, 20],
      issueResolutionHealth: [],
      contributorConcentration: [],
      downloadMomentum: [],
      documentationPresence: []
    } as unknown as V1BenchmarkPopulations;

    vi.mocked(repository.getLatestSnapshot).mockResolvedValue({
      methodologyVersion: '1.0',
      populations: mockPopulations,
      updatedAt: new Date()
    });

    const result = await useCase.execute();
    expect(result).toEqual(mockPopulations);
  });

  it('throws error when snapshot is not found', async () => {
    vi.mocked(repository.getLatestSnapshot).mockResolvedValue(null);
    await expect(useCase.execute()).rejects.toThrow('Benchmark snapshot not found');
  });

  it('throws error when methodology version mismatches', async () => {
    vi.mocked(repository.getLatestSnapshot).mockResolvedValue({
      methodologyVersion: '0.9',
      populations: {} as unknown as V1BenchmarkPopulations,
      updatedAt: new Date()
    });
    await expect(useCase.execute()).rejects.toThrow('Snapshot methodology version mismatch');
  });

  it('handles malformed or missing population data explicitly', async () => {
    vi.mocked(repository.getLatestSnapshot).mockResolvedValue({
      methodologyVersion: '1.0',
      populations: null as unknown as V1BenchmarkPopulations,
      updatedAt: new Date()
    });
    await expect(useCase.execute()).rejects.toThrow('Benchmark snapshot is corrupt or missing population data');
  });
});

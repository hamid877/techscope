/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runRefreshBatch, RefreshBatchDependencies } from '../../../scripts/refresh-batch';
import { PackageScoreRecord } from '../../../application/interfaces/PackageScoreRepository';

describe('refresh-batch orchestration', () => {
  let mockCreateBenchmarkSnapshotUseCase: any;
  let mockGetBenchmarkSnapshotUseCase: any;
  let mockGetPackageScoreUseCase: any;
  let mockPackageScoreRepository: any;
  let dependencies: RefreshBatchDependencies;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockCreateBenchmarkSnapshotUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    mockGetBenchmarkSnapshotUseCase = { execute: vi.fn().mockResolvedValue({ commitCadence: [] }) };
    mockGetPackageScoreUseCase = { execute: vi.fn() };
    mockPackageScoreRepository = { findAll: vi.fn().mockResolvedValue([]) };

    dependencies = {
      createBenchmarkSnapshotUseCase: mockCreateBenchmarkSnapshotUseCase,
      getBenchmarkSnapshotUseCase: mockGetBenchmarkSnapshotUseCase,
      getPackageScoreUseCase: mockGetPackageScoreUseCase,
      packageScoreRepository: mockPackageScoreRepository,
    };

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1 — Successful batch', async () => {
    const packages = [
      { packageName: 'react', registry: 'npm' },
      { packageName: 'requests', registry: 'pypi' },
    ] as PackageScoreRecord[];

    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute
      .mockResolvedValueOnce({ status: 'success', healthScore: 85, registry: 'npm', packageName: 'react' })
      .mockResolvedValueOnce({ status: 'success', healthScore: 90, registry: 'pypi', packageName: 'requests' });

    await runRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(mockCreateBenchmarkSnapshotUseCase.execute).toHaveBeenCalledOnce();
    expect(mockGetBenchmarkSnapshotUseCase.execute).toHaveBeenCalledOnce();
    expect(mockPackageScoreRepository.findAll).toHaveBeenCalledOnce();
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledTimes(2);

    // Verifies it passes forceRefresh and populations
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenNthCalledWith(1, 'react', 'npm', { forceRefresh: true, populations: { commitCadence: [] } });
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenNthCalledWith(2, 'requests', 'pypi', { forceRefresh: true, populations: { commitCadence: [] } });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: 2 refreshed, 0 insufficient_data, 0 unsupported/unresolved, 0 failed'));
  });

  it('Test 2 — Snapshot failure aborts batch', async () => {
    mockCreateBenchmarkSnapshotUseCase.execute.mockRejectedValue(new Error('GitHub API down'));

    await expect(runRefreshBatch(dependencies, { packageDelayMs: 0 })).rejects.toThrow('Benchmark snapshot generation failed.');

    expect(mockCreateBenchmarkSnapshotUseCase.execute).toHaveBeenCalledOnce();
    expect(mockGetBenchmarkSnapshotUseCase.execute).not.toHaveBeenCalled();
    expect(mockPackageScoreRepository.findAll).not.toHaveBeenCalled();
    expect(mockGetPackageScoreUseCase.execute).not.toHaveBeenCalled();
  });

  it('Test 3 — Individual package failure preserves existing row', async () => {
    const packages = [
      { packageName: 'pkg-a', registry: 'npm' },
      { packageName: 'pkg-b', registry: 'npm' },
      { packageName: 'pkg-c', registry: 'npm' },
    ] as PackageScoreRecord[];

    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute
      .mockResolvedValueOnce({ status: 'success', healthScore: 85, registry: 'npm', packageName: 'pkg-a' })
      .mockRejectedValueOnce(new Error('Network error on pkg-b'))
      .mockResolvedValueOnce({ status: 'success', healthScore: 90, registry: 'npm', packageName: 'pkg-c' });

    await runRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledTimes(3);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('pkg-b -> FAILED, preserving previous score'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: 2 refreshed, 0 insufficient_data, 0 unsupported/unresolved, 1 failed'));
  });

  it('Test 4 — Insufficient data', async () => {
    const packages = [
      { packageName: 'pkg-a', registry: 'npm' }
    ] as PackageScoreRecord[];
    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute.mockResolvedValue({ status: 'insufficient_data', registry: 'npm', packageName: 'pkg-a' });

    await runRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: 0 refreshed, 1 insufficient_data, 0 unsupported/unresolved, 0 failed'));
  });

  it('Test 5 — Unsupported/unresolved package', async () => {
    const packages = [
      { packageName: 'pkg-a', registry: 'npm' }
    ] as PackageScoreRecord[];
    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute.mockResolvedValue({ status: 'unsupported_or_unresolved', registry: 'npm', packageName: 'pkg-a' });

    await runRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Completed: 0 refreshed, 0 insufficient_data, 1 unsupported/unresolved, 0 failed'));
  });

  it('Test 7 — Rate limiting delay is called', async () => {
    const packages = [
      { packageName: 'pkg-a', registry: 'npm' },
      { packageName: 'pkg-b', registry: 'npm' },
    ] as PackageScoreRecord[];
    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute.mockResolvedValue({ status: 'success', registry: 'npm', packageName: 'pkg' });

    const startTime = Date.now();
    await runRefreshBatch(dependencies, { packageDelayMs: 50 });
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(40); // Close to 50ms, some leeway for timer resolution
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledTimes(2);
  });
  it('Test 8 — Returns correct RefreshBatchSummary', async () => {
    const packages = [
      { packageName: 'pkg-success', registry: 'npm' },
      { packageName: 'pkg-insufficient', registry: 'npm' },
      { packageName: 'pkg-unsupported', registry: 'npm' },
      { packageName: 'pkg-fail', registry: 'npm' },
    ] as PackageScoreRecord[];
    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute
      .mockResolvedValueOnce({ status: 'success', registry: 'npm', packageName: 'pkg-success', healthScore: 80 })
      .mockResolvedValueOnce({ status: 'insufficient_data', registry: 'npm', packageName: 'pkg-insufficient' })
      .mockResolvedValueOnce({ status: 'unsupported_or_unresolved', registry: 'npm', packageName: 'pkg-unsupported' })
      .mockRejectedValueOnce(new Error('Network error on pkg-fail'));

    const summary = await runRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(summary).toEqual({
      total: 4,
      refreshed: 1,
      insufficient: 1,
      unsupported: 1,
      failed: 1,
    });
  });
});

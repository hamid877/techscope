/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPackageRefreshBatch, PackageRefreshDependencies } from '../../../scripts/refresh-packages';
import { PackageScoreRecord } from '../../../application/interfaces/PackageScoreRepository';

describe('refresh-packages orchestration', () => {
  let mockGetBenchmarkSnapshotUseCase: any;
  let mockGetPackageScoreUseCase: any;
  let mockPackageScoreRepository: any;
  let dependencies: PackageRefreshDependencies;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockGetBenchmarkSnapshotUseCase = { execute: vi.fn().mockResolvedValue({ commitCadence: [] }) };
    mockGetPackageScoreUseCase = { execute: vi.fn() };
    mockPackageScoreRepository = { findAll: vi.fn().mockResolvedValue([]) };

    dependencies = {
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

  it('Test P1 — Does NOT call CreateBenchmarkSnapshotUseCase', async () => {
    // The dependencies type does not even include createBenchmarkSnapshotUseCase.
    // This test verifies the shape: only getBenchmarkSnapshotUseCase is present.
    expect('createBenchmarkSnapshotUseCase' in dependencies).toBe(false);
    expect('getBenchmarkSnapshotUseCase' in dependencies).toBe(true);

    await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    // getBenchmarkSnapshotUseCase is called (loads existing snapshot)
    expect(mockGetBenchmarkSnapshotUseCase.execute).toHaveBeenCalledOnce();
  });

  it('Test P2 — Loads benchmark populations from existing snapshot', async () => {
    const populations = { commitCadence: [1, 2, 3], starCount: [10, 20] };
    mockGetBenchmarkSnapshotUseCase.execute.mockResolvedValue(populations);

    const packages = [
      { packageName: 'react', registry: 'npm' },
    ] as PackageScoreRecord[];
    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute.mockResolvedValue({ status: 'success', healthScore: 85, registry: 'npm', packageName: 'react' });

    await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(mockGetBenchmarkSnapshotUseCase.execute).toHaveBeenCalledOnce();
    // Populations should be passed to GetPackageScoreUseCase
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledWith('react', 'npm', {
      forceRefresh: true,
      populations,
    });
  });

  it('Test P3 — Refreshes packages with forceRefresh=true and passes loaded populations', async () => {
    const packages = [
      { packageName: 'react', registry: 'npm' },
      { packageName: 'requests', registry: 'pypi' },
    ] as PackageScoreRecord[];

    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute
      .mockResolvedValueOnce({ status: 'success', healthScore: 85, registry: 'npm', packageName: 'react' })
      .mockResolvedValueOnce({ status: 'success', healthScore: 90, registry: 'pypi', packageName: 'requests' });

    await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledTimes(2);
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenNthCalledWith(1, 'react', 'npm', {
      forceRefresh: true,
      populations: { commitCadence: [] },
    });
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenNthCalledWith(2, 'requests', 'pypi', {
      forceRefresh: true,
      populations: { commitCadence: [] },
    });
  });

  it('Test P4 — Counts success/insufficient/unsupported/failed correctly', async () => {
    const packages = [
      { packageName: 'pkg-success', registry: 'npm' },
      { packageName: 'pkg-insufficient', registry: 'npm' },
      { packageName: 'pkg-unsupported', registry: 'npm' },
      { packageName: 'pkg-fail', registry: 'npm' },
    ] as PackageScoreRecord[];

    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute
      .mockResolvedValueOnce({ status: 'success', healthScore: 80, registry: 'npm', packageName: 'pkg-success' })
      .mockResolvedValueOnce({ status: 'insufficient_data', registry: 'npm', packageName: 'pkg-insufficient' })
      .mockResolvedValueOnce({ status: 'unsupported_or_unresolved', registry: 'npm', packageName: 'pkg-unsupported' })
      .mockRejectedValueOnce(new Error('Network error on pkg-fail'));

    const summary = await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(summary).toEqual({
      total: 4,
      refreshed: 1,
      insufficient: 1,
      unsupported: 1,
      failed: 1,
    });
  });

  it('Test P5 — One package failure does not stop remaining packages', async () => {
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

    const summary = await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    // All three packages were attempted
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledTimes(3);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('pkg-b -> FAILED, preserving previous score'));
    expect(summary).toEqual({ total: 3, refreshed: 2, insufficient: 0, unsupported: 0, failed: 1 });
  });

  it('Test P6 — Delay behavior is preserved between packages', async () => {
    const packages = [
      { packageName: 'pkg-a', registry: 'npm' },
      { packageName: 'pkg-b', registry: 'npm' },
    ] as PackageScoreRecord[];

    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute.mockResolvedValue({ status: 'success', registry: 'npm', packageName: 'pkg', healthScore: 80 });

    const startTime = Date.now();
    await runPackageRefreshBatch(dependencies, { packageDelayMs: 50 });
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(40); // Close to 50ms, some leeway for timer resolution
    expect(mockGetPackageScoreUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it('Test P7 — Missing benchmark snapshot propagates as error (edge case)', async () => {
    mockGetBenchmarkSnapshotUseCase.execute.mockRejectedValue(new Error('Benchmark snapshot not found'));

    await expect(runPackageRefreshBatch(dependencies, { packageDelayMs: 0 }))
      .rejects.toThrow('Benchmark snapshot not found');

    // Neither packages nor individual scores are touched
    expect(mockPackageScoreRepository.findAll).not.toHaveBeenCalled();
    expect(mockGetPackageScoreUseCase.execute).not.toHaveBeenCalled();
  });

  it('Test P8 — Empty package list returns zero summary', async () => {
    mockPackageScoreRepository.findAll.mockResolvedValue([]);

    const summary = await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(summary).toEqual({ total: 0, refreshed: 0, insufficient: 0, unsupported: 0, failed: 0 });
    expect(mockGetPackageScoreUseCase.execute).not.toHaveBeenCalled();
  });

  it('Test P9 — Returns correct completion log line', async () => {
    const packages = [
      { packageName: 'react', registry: 'npm' },
      { packageName: 'requests', registry: 'pypi' },
    ] as PackageScoreRecord[];

    mockPackageScoreRepository.findAll.mockResolvedValue(packages);
    mockGetPackageScoreUseCase.execute
      .mockResolvedValueOnce({ status: 'success', healthScore: 85, registry: 'npm', packageName: 'react' })
      .mockResolvedValueOnce({ status: 'success', healthScore: 90, registry: 'pypi', packageName: 'requests' });

    await runPackageRefreshBatch(dependencies, { packageDelayMs: 0 });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Completed: 2 refreshed, 0 insufficient_data, 0 unsupported/unresolved, 0 failed')
    );
  });
});

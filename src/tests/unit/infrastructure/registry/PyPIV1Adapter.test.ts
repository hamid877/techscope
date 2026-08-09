import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { PyPIV1Adapter } from '../../../../infrastructure/registry/PyPIV1Adapter';
import { PyPIClient } from '../../../../infrastructure/registry/PyPIClient';

describe('PyPIV1Adapter', () => {
  let adapter: PyPIV1Adapter;
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    adapter = new PyPIV1Adapter(new PyPIClient());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockData = (startDate: string, days: number, downloadsPerDay: number) => {
    const data = [];
    const current = new Date(startDate);
    for (let i = 0; i < days; i++) {
      data.push({
        category: 'without_mirrors',
        date: current.toISOString().split('T')[0],
        downloads: downloadsPerDay
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return data;
  };

  it('should return download momentum successfully for a valid package with 60+ days of data', async () => {
    // Generate 60 days of data ending on 2026-08-08
    // Start date = 2026-06-10 (60 days inclusive)
    const mockData = createMockData('2026-06-10', 60, 100);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: mockData,
        package: 'requests',
        type: 'overall_downloads'
      })
    });

    const result = await adapter.getDownloadMomentum('requests');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'success',
      metricName: 'download_momentum',
      data: {
        // 30 days * 100 downloads/day = 3000
        current30DayDownloads: 3000,
        prior30DayDownloads: 3000,
        lowerConfidence: true
      }
    });

    // Ensure no credentials are sent in the fetch calls
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
  });

  it('should correctly sum only without_mirrors category', async () => {
    const mockData = createMockData('2026-06-10', 60, 100);
    // Add with_mirrors data which should be ignored
    const mockDataWithMirrors = createMockData('2026-06-10', 60, 50).map(d => ({ ...d, category: 'with_mirrors' }));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [...mockData, ...mockDataWithMirrors],
        package: 'requests',
        type: 'overall_downloads'
      })
    });

    const result = await adapter.getDownloadMomentum('requests');

    expect(result).toEqual({
      status: 'success',
      metricName: 'download_momentum',
      data: {
        current30DayDownloads: 3000,
        prior30DayDownloads: 3000,
        lowerConfidence: true
      }
    });
  });

  it('should return insufficient_data if less than 60 days of data are available', async () => {
    // Generate 59 days of data
    const mockData = createMockData('2026-06-11', 59, 100);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: mockData,
        package: 'requests',
        type: 'overall_downloads'
      })
    });

    const result = await adapter.getDownloadMomentum('requests');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should return insufficient_data if the response spans 60+ days but has missing dates in the 60-day window', async () => {
    // Generate 65 days of data ending on 2026-08-08 (starts 2026-06-05)
    const mockData = createMockData('2026-06-05', 65, 100);
    
    // Remove a date that falls inside the 60-day window (2026-06-10 to 2026-08-08)
    const incompleteData = mockData.filter(d => d.date !== '2026-07-01');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: incompleteData,
        package: 'requests',
        type: 'overall_downloads'
      })
    });

    const result = await adapter.getDownloadMomentum('requests');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should return insufficient_data on HTTP failure', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    const result = await adapter.getDownloadMomentum('requests');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should return insufficient_data on missing or malformed data array', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: null, // Malformed
        package: 'requests',
        type: 'overall_downloads'
      })
    });

    const result = await adapter.getDownloadMomentum('requests');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should URL encode package names', async () => {
    const mockData = createMockData('2026-06-10', 60, 100);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: mockData,
        package: 'some/package',
        type: 'overall_downloads'
      })
    });

    await adapter.getDownloadMomentum('some/package');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('some%2Fpackage');
  });

  it('should correctly handle zero downloads (no substitution)', async () => {
    const mockData = createMockData('2026-06-10', 60, 0); // 0 downloads per day

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: mockData,
        package: 'requests',
        type: 'overall_downloads'
      })
    });

    const result = await adapter.getDownloadMomentum('requests');

    expect(result).toEqual({
      status: 'success',
      metricName: 'download_momentum',
      data: {
        current30DayDownloads: 0,
        prior30DayDownloads: 0,
        lowerConfidence: true
      }
    });
  });
});

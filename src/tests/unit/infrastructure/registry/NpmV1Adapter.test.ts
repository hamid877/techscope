import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { NpmV1Adapter } from '../../../../infrastructure/registry/NpmV1Adapter';
import { NpmClient } from '../../../../infrastructure/registry/NpmClient';

describe('NpmV1Adapter', () => {
  let adapter: NpmV1Adapter;
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    adapter = new NpmV1Adapter(new NpmClient());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return download momentum successfully for a valid package', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/last-month/')) {
        return {
          ok: true,
          json: async () => ({
            downloads: 1000,
            start: '2026-07-10',
            end: '2026-08-08',
            package: 'react'
          })
        };
      }
      if (url.includes('/2026-06-10:2026-07-09/')) {
        return {
          ok: true,
          json: async () => ({
            downloads: 800,
            start: '2026-06-10',
            end: '2026-07-09',
            package: 'react'
          })
        };
      }
      return { ok: false };
    });

    const result = await adapter.getDownloadMomentum('react');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'success',
      metricName: 'download_momentum',
      data: {
        current30DayDownloads: 1000,
        prior30DayDownloads: 800,
        lowerConfidence: true
      }
    });

    // Ensure no credentials are sent in the fetch calls
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
    expect(fetchMock.mock.calls[1][1]).toBeUndefined();
  });

  it('should correctly URL-encode scoped packages', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/last-month/')) {
        return {
          ok: true,
          json: async () => ({
            downloads: 500,
            start: '2026-07-10',
            end: '2026-08-08',
            package: '@babel/core'
          })
        };
      }
      if (url.includes('/2026-06-10:2026-07-09/')) {
        return {
          ok: true,
          json: async () => ({
            downloads: 400,
            start: '2026-06-10',
            end: '2026-07-09',
            package: '@babel/core'
          })
        };
      }
      return { ok: false };
    });

    await adapter.getDownloadMomentum('@babel/core');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('%40babel%2Fcore');
    expect(fetchMock.mock.calls[1][0]).toContain('%40babel%2Fcore');
  });

  it('should return insufficient_data on HTTP failure for current month', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    const result = await adapter.getDownloadMomentum('react');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should return insufficient_data on HTTP failure for prior month', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        downloads: 1000,
        start: '2026-07-10',
        end: '2026-08-08',
        package: 'react'
      })
    })).mockImplementationOnce(async () => ({
      ok: false
    }));

    const result = await adapter.getDownloadMomentum('react');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should return insufficient_data on missing downloads field', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        start: '2026-07-10',
        end: '2026-08-08',
        package: 'react'
        // downloads missing
      })
    });

    const result = await adapter.getDownloadMomentum('react');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should return insufficient_data on null response from fetch (e.g., network error thrown)', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await adapter.getDownloadMomentum('react');

    expect(result).toEqual({
      status: 'unavailable',
      metricName: 'download_momentum',
      reason: 'insufficient_data'
    });
  });

  it('should correctly handle zero downloads as a valid value rather than missing data', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/last-month/')) {
        return {
          ok: true,
          json: async () => ({
            downloads: 0,
            start: '2026-07-10',
            end: '2026-08-08',
            package: 'react'
          })
        };
      }
      if (url.includes('/2026-06-10:2026-07-09/')) {
        return {
          ok: true,
          json: async () => ({
            downloads: 0,
            start: '2026-06-10',
            end: '2026-07-09',
            package: 'react'
          })
        };
      }
      return { ok: false };
    });

    const result = await adapter.getDownloadMomentum('react');

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

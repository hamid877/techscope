import { describe, expect, it, vi, beforeEach, MockInstance } from 'vitest';
import { GET } from '@/app/api/v1/packages/route';
import { GetPackageScoreUseCase } from '@/application/use-cases/GetPackageScoreUseCase';

// Mock the PrismaClient to prevent actual DB connections during module evaluation
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class {}
  };
});

describe('GET /api/v1/packages', () => {
  let executeSpy: MockInstance;

  beforeEach(() => {
    executeSpy = vi.spyOn(GetPackageScoreUseCase.prototype, 'execute');
    executeSpy.mockReset();
  });

  const createRequest = (url: string) => {
    return new Request(`http://localhost${url}`);
  };

  it('1. Valid npm request returns HTTP 200 and success response', async () => {
    executeSpy.mockResolvedValue({
      status: 'success',
      healthScore: 74,
      metricsAvailable: 5,
      metricsTotal: 6,
      methodologyVersion: '1.0',
      isProvisional: false,
      metricsBreakdown: [
        { metric: 'commit_cadence', percentile: 80, weight: 0.20 }
      ]
    });

    const response = await GET(createRequest('/api/v1/packages?name=react&registry=npm'));
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.score).toBe(74);
    expect(data.reason).toBeNull();
    expect(data.methodology_version).toBe('1.0');
    expect(data.provisional).toBe(false);
    expect(data.completeness).toEqual({
      health_score: 74,
      metrics_available: 5,
      metrics_total: 6
    });
    expect(data.metrics).toEqual([
      { metric: 'commit_cadence', percentile: 80, weight: 0.20, status: 'success' }
    ]);
    expect(executeSpy).toHaveBeenCalledWith('react', 'npm');
  });

  it('2. Valid PyPI request returns HTTP 200', async () => {
    executeSpy.mockResolvedValue({
      status: 'success',
      healthScore: 85,
      metricsAvailable: 6,
      metricsTotal: 6,
      methodologyVersion: '1.0',
      isProvisional: false,
      metricsBreakdown: []
    });

    const response = await GET(createRequest('/api/v1/packages?name=requests&registry=pypi'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.score).toBe(85);
    expect(executeSpy).toHaveBeenCalledWith('requests', 'pypi');
  });

  it('3. Missing name returns HTTP 400', async () => {
    const response = await GET(createRequest('/api/v1/packages?registry=npm'));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_request');
  });

  it('4. Empty name returns HTTP 400', async () => {
    const response = await GET(createRequest('/api/v1/packages?name=   &registry=npm'));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_request');
  });

  it('5. Missing registry returns HTTP 400', async () => {
    const response = await GET(createRequest('/api/v1/packages?name=react'));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_request');
  });

  it('6. Invalid registry returns HTTP 400', async () => {
    const response = await GET(createRequest('/api/v1/packages?name=react&registry=cargo'));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('invalid_request');
  });

  it('7. Unsupported/unresolved package maps correctly', async () => {
    executeSpy.mockResolvedValue({
      status: 'unsupported_or_unresolved',
      healthScore: null,
      metricsAvailable: null,
      metricsTotal: null,
      methodologyVersion: '1.0',
      isProvisional: false,
      metricsBreakdown: null
    });

    const response = await GET(createRequest('/api/v1/packages?name=unknown-pkg&registry=npm'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      score: null,
      reason: 'unsupported_or_unresolved'
    });
  });

  it('8. Insufficient metric data maps correctly', async () => {
    executeSpy.mockResolvedValue({
      status: 'insufficient_data',
      healthScore: null,
      metricsAvailable: 2,
      metricsTotal: 6,
      methodologyVersion: '1.0',
      isProvisional: true,
      metricsBreakdown: [
        { metric: 'commit_cadence', percentile: null, weight: 0.20 }
      ]
    });

    const response = await GET(createRequest('/api/v1/packages?name=small-pkg&registry=npm'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.score).toBeNull();
    expect(data.reason).toBe('insufficient_data');
    expect(data.methodology_version).toBe('1.0');
    expect(data.provisional).toBe(true);
    expect(data.completeness).toEqual({
      health_score: null,
      metrics_available: 2,
      metrics_total: 6
    });
    expect(data.metrics).toEqual([
      { metric: 'commit_cadence', percentile: null, weight: 0.20, status: 'unavailable' }
    ]);
  });

  it('9. Successful response contains expected fields', async () => {
    executeSpy.mockResolvedValue({
      status: 'success',
      healthScore: 90,
      metricsAvailable: 6,
      metricsTotal: 6,
      methodologyVersion: '1.0',
      isProvisional: false,
      metricsBreakdown: [
        { metric: 'commit_cadence', percentile: 95, weight: 0.20 }
      ]
    });

    const response = await GET(createRequest('/api/v1/packages?name=react&registry=npm'));
    const data = await response.json();

    expect(data).toHaveProperty('score');
    expect(data).toHaveProperty('reason');
    expect(data).toHaveProperty('methodology_version');
    expect(data).toHaveProperty('provisional');
    expect(data).toHaveProperty('completeness');
    expect(data).toHaveProperty('metrics');
  });

  it('10. Internal/unexpected failure returns HTTP 500 without exposing internal error details', async () => {
    // Suppress console.error for this test to keep output clean
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    executeSpy.mockRejectedValue(new Error('Database connection failed! SECRET_PASSWORD'));

    const response = await GET(createRequest('/api/v1/packages?name=react&registry=npm'));
    expect(response.status).toBe(500);
    const data = await response.json();

    expect(data.error).toBe('internal_error');
    expect(data.message).toBe('Unable to calculate package score');
    expect(JSON.stringify(data)).not.toContain('Database connection failed');
    expect(JSON.stringify(data)).not.toContain('SECRET_PASSWORD');

    consoleSpy.mockRestore();
  });

  it('11. Verify the route delegates to GetPackageScoreUseCase rather than implementing scoring itself', async () => {
    executeSpy.mockResolvedValue({
      status: 'success',
      healthScore: 50,
      metricsAvailable: 6,
      metricsTotal: 6,
      methodologyVersion: '1.0',
      isProvisional: false,
      metricsBreakdown: []
    });

    await GET(createRequest('/api/v1/packages?name=test-pkg&registry=npm'));

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith('test-pkg', 'npm');
  });
});

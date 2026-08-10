import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateExplanationUseCase } from '../../../../../src/application/use-cases/GenerateExplanationUseCase';
import { PackageScoreRepository, PackageScoreRecord } from '../../../../../src/application/interfaces/PackageScoreRepository';
import { ExplanationService, ExplanationPromptDTO } from '../../../../../src/infrastructure/ai/ExplanationService';


describe('GenerateExplanationUseCase', () => {
  let repository: import('vitest').Mocked<PackageScoreRepository>;
  let explanationService: import('vitest').Mocked<ExplanationService>;
  let useCase: GenerateExplanationUseCase;

  beforeEach(() => {
    repository = {
      findByPackageAndRegistry: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn()
    };
    explanationService = {
      generateExplanation: vi.fn()
    };
    useCase = new GenerateExplanationUseCase(repository, explanationService);
  });

  it('throws when no score is found', async () => {
    repository.findByPackageAndRegistry.mockResolvedValue(null);
    await expect(useCase.execute('react', 'npm')).rejects.toThrow('Score not found');
    expect(explanationService.generateExplanation).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws when status is insufficient_data', async () => {
    repository.findByPackageAndRegistry.mockResolvedValue({
      status: 'insufficient_data'
    } as PackageScoreRecord);
    await expect(useCase.execute('react', 'npm')).rejects.toThrow('Invalid package status');
    expect(explanationService.generateExplanation).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws when status is unsupported_or_unresolved', async () => {
    repository.findByPackageAndRegistry.mockResolvedValue({
      status: 'unsupported_or_unresolved'
    } as PackageScoreRecord);
    await expect(useCase.execute('react', 'npm')).rejects.toThrow('Invalid package status');
    expect(explanationService.generateExplanation).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('passes sanitized DTO with explicitly derived caveats to ExplanationService', async () => {
    const mockRecord: PackageScoreRecord = {
      packageName: 'react',
      registry: 'npm',
      status: 'success',
      healthScore: 85,
      metricsAvailable: 6,
      metricsTotal: 6,
      methodologyVersion: '1.0',
      isProvisional: true,
      calculatedAt: new Date(),
      refreshedAt: new Date(),
      metricsBreakdown: [
        { metric: 'download_momentum', percentile: 90, weight: 1 },
        { metric: 'contributor_concentration', percentile: 15, weight: 1 } // Low percentile means high concentration
      ]
    };
    repository.findByPackageAndRegistry.mockResolvedValue(mockRecord);
    explanationService.generateExplanation.mockResolvedValue('Expected explanation');

    const result = await useCase.execute('react', 'npm');

    expect(result).toBe('Expected explanation');
    expect(explanationService.generateExplanation).toHaveBeenCalledWith({
      healthScore: 85,
      isProvisional: true,
      completeness: {
        available: 6,
        total: 6
      },
      metrics: [
        { metric: 'download_momentum', percentile: 90, weight: 1 },
        { metric: 'contributor_concentration', percentile: 15, weight: 1 }
      ],
      caveats: {
        hasLowerConfidenceDownloadMomentum: true,
        hasHighContributorConcentration: true
      }
    } as ExplanationPromptDTO);
    expect(repository.save).not.toHaveBeenCalled(); // AI failure or success must never write back to score storage
  });
});

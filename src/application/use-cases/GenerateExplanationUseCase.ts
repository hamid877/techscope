import { Registry } from '../../domain/types/registry';
import { PackageScoreRepository } from '../interfaces/PackageScoreRepository';
import { ExplanationService, ExplanationPromptDTO } from '../../infrastructure/ai/ExplanationService';


export class GenerateExplanationUseCase {
  constructor(
    private readonly repository: PackageScoreRepository,
    private readonly explanationService: ExplanationService
  ) {}

  async execute(packageName: string, registry: Registry): Promise<string> {
    const record = await this.repository.findByPackageAndRegistry(packageName, registry);

    if (!record) {
      throw new Error('Score not found');
    }

    if (record.status === 'insufficient_data' || record.status === 'unsupported_or_unresolved') {
      throw new Error('Invalid package status');
    }

    if (record.healthScore === null || record.metricsAvailable === null || record.metricsTotal === null) {
      throw new Error('Incomplete score data');
    }

    const metricsBreakdown = record.metricsBreakdown || [];

    // Evaluate known methodological caveats
    const hasDownloadMomentum = metricsBreakdown.some(
      m => m.metric === 'download_momentum' && m.percentile !== null
    );
    
    // Contributor concentration is high if the score is low (meaning high concentration, so low health score component)
    // Assuming a percentile < 30 on Contributor Concentration is considered "high concentration"
    const hasHighContributorConcentration = metricsBreakdown.some(
      m => m.metric === 'contributor_concentration' && m.percentile !== null && (m.percentile as number) < 30
    );

    const dto: ExplanationPromptDTO = {
      healthScore: record.healthScore,
      isProvisional: record.isProvisional,
      completeness: {
        available: record.metricsAvailable,
        total: record.metricsTotal
      },
      metrics: metricsBreakdown.map(m => ({
        metric: m.metric as string,
        percentile: m.percentile as number | null,
        weight: m.weight as number
      })),
      caveats: {
        hasLowerConfidenceDownloadMomentum: hasDownloadMomentum,
        hasHighContributorConcentration: hasHighContributorConcentration
      }
    };

    return this.explanationService.generateExplanation(dto);
  }
}

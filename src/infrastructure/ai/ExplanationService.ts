export interface ExplanationPromptDTO {
  healthScore: number;
  isProvisional: boolean;
  completeness: {
    available: number;
    total: number;
  };
  metrics: {
    metric: string;
    percentile: number | null;
    weight: number;
  }[];
  caveats: {
    hasLowerConfidenceDownloadMomentum: boolean;
    hasHighContributorConcentration: boolean;
  };
}

export interface ExplanationService {
  generateExplanation(dto: ExplanationPromptDTO): Promise<string>;
}

import OpenAI from 'openai';
import { ExplanationPromptDTO, ExplanationService } from './ExplanationService';

export class OpenAIExplanationService implements ExplanationService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async generateExplanation(dto: ExplanationPromptDTO): Promise<string> {
    const prompt = this.buildPrompt(dto);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a technical assistant explaining a package's health score.
Your task is to generate ONE short, plain-text paragraph explaining the health score and metrics provided.
DO NOT use Markdown (no bold, no italics, no bullet points).
DO NOT calculate, infer, classify, or invent scores, metrics, percentiles, caveats, popularity, maturity, or any external facts.
DO NOT use qualitative score labels such as "strong", "weak", "healthy", or "unhealthy".
ONLY explain the exact values and caveats provided in the input.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0,
        max_tokens: 150,
      });

      const explanation = response.choices[0]?.message?.content?.trim();
      if (!explanation) {
        throw new Error('LLM returned an empty explanation.');
      }

      return explanation;
    } catch (error) {
      console.error('OpenAI explanation generation failed:', error);
      throw new Error('Failed to generate AI explanation.');
    }
  }

  private buildPrompt(dto: ExplanationPromptDTO): string {
    const lines = [
      `Health Score: ${dto.healthScore}/100`,
      `Completeness: ${dto.completeness.available} of ${dto.completeness.total} metrics available`,
      `Provisional (less than 90 days old): ${dto.isProvisional ? 'Yes' : 'No'}`,
      '',
      'Metrics:'
    ];

    for (const m of dto.metrics) {
      const percentileStr = m.percentile !== null ? m.percentile.toString() : 'unavailable';
      lines.push(`- ${m.metric}: percentile ${percentileStr} (weight: ${m.weight})`);
    }

    if (dto.caveats.hasLowerConfidenceDownloadMomentum || dto.caveats.hasHighContributorConcentration) {
      lines.push('', 'Caveats to mention in the explanation:');
      if (dto.caveats.hasLowerConfidenceDownloadMomentum) {
        lines.push('- The Download Momentum metric has lower confidence (may be inflated by CI/mirror traffic).');
      }
      if (dto.caveats.hasHighContributorConcentration) {
        lines.push('- Contributor Concentration is high (maintenance burden is highly concentrated).');
      }
    }

    return lines.join('\n');
  }
}

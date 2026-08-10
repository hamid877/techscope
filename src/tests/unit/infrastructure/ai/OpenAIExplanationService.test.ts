import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIExplanationService } from '../../../../../src/infrastructure/ai/OpenAIExplanationService';
import { ExplanationPromptDTO } from '../../../../../src/infrastructure/ai/ExplanationService';
import OpenAI from 'openai';

// Mock the openai module
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = {
        completions: {
          create: mockCreate
        }
      };
    }
  };
});

describe('OpenAIExplanationService', () => {
  let service: OpenAIExplanationService;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new OpenAIExplanationService();
    // Re-acquire the mocked create function to set return values per test
    const openaiInstance = new OpenAI();
    mockCreate = openaiInstance.chat.completions.create as ReturnType<typeof vi.fn>;
  });

  it('generates an explanation successfully and respects prompt constraints', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'This is a test explanation.' } }]
    });

    const dto: ExplanationPromptDTO = {
      healthScore: 80,
      isProvisional: false,
      completeness: { available: 6, total: 6 },
      metrics: [
        { metric: 'commit_cadence', percentile: 50, weight: 1 }
      ],
      caveats: {
        hasLowerConfidenceDownloadMomentum: false,
        hasHighContributorConcentration: false
      }
    };

    const explanation = await service.generateExplanation(dto);
    expect(explanation).toBe('This is a test explanation.');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    
    // Check constraints in system prompt
    expect(callArgs.messages[0].content).toContain('DO NOT calculate, infer, classify, or invent scores');
    expect(callArgs.messages[0].content).toContain('DO NOT use qualitative score labels such as "strong"');

    // Check data mapping in user prompt
    const userContent = callArgs.messages[1].content;
    expect(userContent).toContain('Health Score: 80/100');
    expect(userContent).toContain('6 of 6 metrics available');
    expect(userContent).toContain('Provisional (less than 90 days old): No');
    expect(userContent).toContain('commit_cadence: percentile 50 (weight: 1)');
  });

  it('throws an error if OpenAI API fails', async () => {
    mockCreate.mockRejectedValue(new Error('Network error'));

    const dto: ExplanationPromptDTO = {
      healthScore: 80,
      isProvisional: false,
      completeness: { available: 6, total: 6 },
      metrics: [],
      caveats: {
        hasLowerConfidenceDownloadMomentum: false,
        hasHighContributorConcentration: false
      }
    };

    await expect(service.generateExplanation(dto)).rejects.toThrow('Failed to generate AI explanation.');
  });
});

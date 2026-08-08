import { DomainError } from './DomainError';

/**
 * Raised when fewer than the required minimum number of V1 metrics have
 * a non-null percentile, making it impossible to produce a reliable score.
 *
 * Corresponds to NullReason = 'insufficient_data' (SCORING.md §8–9, PRD FR-9).
 */
export class InsufficientMetricDataError extends DomainError {
  readonly reason = 'insufficient_data' as const;

  constructor(availableCount: number, requiredCount: number) {
    super(
      `Insufficient metric data: ${availableCount} metric(s) available, at least ${requiredCount} required.`,
    );
  }
}

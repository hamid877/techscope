import { DomainError } from './DomainError';

/**
 * Raised when the input MetricResult array does not contain exactly one entry
 * for each of the six V1 MetricName values — either a metric is missing or
 * a metric appears more than once.
 */
export class InvalidMetricSetError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

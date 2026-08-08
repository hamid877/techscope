import { DomainError } from './DomainError';

export class InvalidMetricWeightError extends DomainError {
  constructor(weight: number) {
    super(
      `Metric weight ${weight} is invalid: must be a finite number in the range [0, 1].`,
    );
  }
}

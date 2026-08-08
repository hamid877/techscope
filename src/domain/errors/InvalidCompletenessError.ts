import { DomainError } from './DomainError';

export class InvalidCompletenessError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

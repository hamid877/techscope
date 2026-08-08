import { SCORE_MAX, SCORE_MIN } from '../constants/score.constants';
import { DomainError } from './DomainError';

export class InvalidScoreError extends DomainError {
  constructor(score: number) {
    super(
      `Score ${score} is outside the allowed range [${SCORE_MIN}, ${SCORE_MAX}].`,
    );
  }
}

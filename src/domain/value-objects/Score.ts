import { SCORE_MAX, SCORE_MIN } from '../constants/score.constants';
import { InvalidScoreError } from '../errors/InvalidScoreError';

export class Score {
  readonly #value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) {
      throw new InvalidScoreError(value);
    }

    this.#value = value;
  }

  get value(): number {
    return this.#value;
  }
}

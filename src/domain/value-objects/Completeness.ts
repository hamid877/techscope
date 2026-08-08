import { METRICS_TOTAL_V1 } from '../constants/score.constants';
import { InvalidCompletenessError } from '../errors/InvalidCompletenessError';
import { Score } from './Score';

export class Completeness {
  readonly #healthScore: Score;
  readonly #metricsAvailable: number;
  readonly #metricsTotal: number;

  constructor(healthScore: Score, metricsAvailable: number) {
    if (
      !Number.isInteger(metricsAvailable) ||
      metricsAvailable < 0 ||
      metricsAvailable > METRICS_TOTAL_V1
    ) {
      throw new InvalidCompletenessError(
        `metrics_available must be an integer from 0 through ${METRICS_TOTAL_V1}, got ${metricsAvailable}.`,
      );
    }

    this.#healthScore = healthScore;
    this.#metricsAvailable = metricsAvailable;
    this.#metricsTotal = METRICS_TOTAL_V1;
  }

  get healthScore(): Score {
    return this.#healthScore;
  }

  get metricsAvailable(): number {
    return this.#metricsAvailable;
  }

  get metricsTotal(): number {
    return this.#metricsTotal;
  }
}

import { InvalidMetricWeightError } from '../errors/InvalidMetricWeightError';
import { MetricName } from '../types/metric-name';
import { Score } from './Score';

export class MetricResult {
  readonly #metric: MetricName;
  readonly #percentile: Score | null;
  readonly #weight: number;

  constructor(metric: MetricName, percentile: Score | null, weight: number) {
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new InvalidMetricWeightError(weight);
    }

    this.#metric = metric;
    this.#percentile = percentile;
    this.#weight = weight;
  }

  get metric(): MetricName {
    return this.#metric;
  }

  get percentile(): Score | null {
    return this.#percentile;
  }

  get weight(): number {
    return this.#weight;
  }
}

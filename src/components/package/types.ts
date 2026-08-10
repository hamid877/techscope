/**
 * Shape returned by GET /api/v1/packages.
 * All field names match the actual API response exactly.
 */
export type MetricEntry = {
  metric: string;
  percentile: number | null;
  weight: number;
  status: 'success' | 'unavailable';
};

export type ScoreResponseSuccess = {
  score: number;
  reason: null;
  methodology_version: string;
  provisional: boolean;
  refreshed_at: string;
  completeness: {
    health_score: number;
    metrics_available: number;
    metrics_total: number;
  };
  metrics: MetricEntry[];
};

export type ScoreResponseInsufficient = {
  score: null;
  reason: 'insufficient_data';
  methodology_version: string;
  provisional: boolean;
  refreshed_at: string;
  completeness: {
    health_score: null;
    metrics_available: number | null;
    metrics_total: number | null;
  };
  metrics: MetricEntry[];
};

export type ScoreResponseUnresolved = {
  score: null;
  reason: 'unsupported_or_unresolved';
};

export type ScoreResponse =
  | ScoreResponseSuccess
  | ScoreResponseInsufficient
  | ScoreResponseUnresolved;

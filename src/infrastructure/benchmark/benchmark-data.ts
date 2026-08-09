import { BenchmarkEntry } from './types';

// TODO: Curate 50-100 well-known npm/PyPI packages spanning all four tiers (Thriving, Stable, Declining, Abandoned)
// as per SCORING.md §10.1. Each package requires a written justification cross-checked against objective 
// external signals (GitHub archived status, deprecation notices, last-commit recency).
// Do not fabricate packages; this dataset should remain empty until manual curation is complete.
export const BENCHMARK_DATASET: BenchmarkEntry[] = [];

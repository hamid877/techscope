/**
 * V1 global metric weight vector (SCORING.md §7).
 *
 * These values are the canonical source of truth for the V1 formula.
 * Do not inline or re-declare them elsewhere.
 */
export const V1_WEIGHT_COMMIT_CADENCE = 0.3;
export const V1_WEIGHT_RELEASE_FREQUENCY = 0.25;
export const V1_WEIGHT_ISSUE_RESOLUTION_HEALTH = 0.15;
export const V1_WEIGHT_CONTRIBUTOR_CONCENTRATION = 0.15;
export const V1_WEIGHT_DOWNLOAD_MOMENTUM = 0.05;
export const V1_WEIGHT_DOCUMENTATION_PRESENCE = 0.1;

/** Minimum number of available (non-null percentile) metrics required to produce a score (SCORING.md §8–9). */
export const V1_MIN_AVAILABLE_METRICS = 4;

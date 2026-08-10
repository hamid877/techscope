/**
 * One-line plain-language definitions for each V1 metric.
 * Sourced directly from SCORING.md §5.1–5.6.
 * These are static strings — not fetched from the API.
 */
export const METRIC_DEFINITIONS: Record<string, string> = {
  commit_cadence:
    'Total human commits over the trailing 52 weeks — the most direct maintenance signal.',
  release_frequency:
    'Count of stable, non-draft releases in the trailing 12 months.',
  issue_resolution_health:
    'Resolution rate and median days-to-close for issues opened in the trailing 180 days.',
  contributor_concentration:
    'Share of commits by the single most active contributor over the trailing 12 months; lower is healthier.',
  download_momentum:
    'Current 30-day download count combined with log-scale growth over the prior period.',
  documentation_presence:
    'Structural checklist: README ≥ 1.5 KB, homepage or /docs folder, and at least one code block.',
};

export const METRIC_LABELS: Record<string, string> = {
  commit_cadence:           'Commit Cadence',
  release_frequency:        'Release Frequency',
  issue_resolution_health:  'Issue Resolution Health',
  contributor_concentration:'Contributor Concentration',
  download_momentum:        'Download Momentum',
  documentation_presence:   'Documentation Presence',
};

import {
  CommitCadenceSignal,
  ContributorConcentrationSignal,
  DocumentationPresenceSignal,
  DownloadMomentumSignal,
  IssueResolutionHealthSignal,
  ReleaseFrequencySignal,
} from '../types/raw-signals';

/**
 * Calculates the raw value for Commit Cadence.
 * @param signal The raw signal.
 * @returns The number of commits in the trailing 52 weeks.
 */
export function calculateCommitCadence(signal: CommitCadenceSignal): number {
  return signal.commits52Weeks;
}

/**
 * Calculates the raw value for Release Frequency.
 * @param signal The raw signal.
 * @returns The number of releases in the trailing 12 months.
 */
export function calculateReleaseFrequency(signal: ReleaseFrequencySignal): number {
  return signal.releases12Months;
}

export interface IssueResolutionHealthRawValue {
  readonly resolutionRate: number | null;
  readonly medianDaysToClose: number | null;
}

/**
 * Calculates the raw value for Issue Resolution Health.
 * @param signal The raw signal.
 * @returns An object containing the resolution rate and median days to close.
 */
export function calculateIssueResolutionHealth(
  signal: IssueResolutionHealthSignal,
): IssueResolutionHealthRawValue {
  return {
    resolutionRate:
      signal.openedIssues180Days === 0
        ? null
        : signal.closedIssues180Days / signal.openedIssues180Days,
    medianDaysToClose: signal.medianDaysToClose180Days,
  };
}

/**
 * Calculates the raw value for Contributor Concentration.
 * @param signal The raw signal.
 * @returns The ratio of commits by the top contributor to total human commits, or null if total human commits is 0.
 */
export function calculateContributorConcentration(
  signal: ContributorConcentrationSignal,
): number | null {
  if (signal.totalHumanCommits12Months === 0) {
    return null;
  }
  return signal.topContributorCommits12Months / signal.totalHumanCommits12Months;
}

export interface DownloadMomentumRawValue {
  readonly growth: number;
  readonly lowerConfidence: boolean;
}

/**
 * Calculates the raw value for Download Momentum.
 * @param signal The raw signal.
 * @returns An object containing the logarithmic growth and the lower confidence flag.
 */
export function calculateDownloadMomentum(
  signal: DownloadMomentumSignal,
): DownloadMomentumRawValue {
  const currentLog = Math.log(1 + signal.current30DayDownloads);
  const priorLog = Math.log(1 + signal.prior30DayDownloads);
  return {
    growth: currentLog - priorLog,
    lowerConfidence: signal.lowerConfidence,
  };
}

const README_SIZE_THRESHOLD_BYTES = 1500; // 1.5KB

/**
 * Calculates the raw value for Documentation Presence.
 * @param signal The raw signal.
 * @returns A presence count from 0 to 3 based on the checklist.
 */
export function calculateDocumentationPresence(
  signal: DocumentationPresenceSignal,
): number {
  let score = 0;

  if (signal.readmeSizeBytes !== null && signal.readmeSizeBytes >= README_SIZE_THRESHOLD_BYTES) {
    score += 1;
  }

  if (signal.hasHomepageUrl || signal.hasDocsFolder) {
    score += 1;
  }

  if (signal.fencedCodeBlockCount >= 1) {
    score += 1;
  }

  return score;
}

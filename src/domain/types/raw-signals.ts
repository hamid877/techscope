import { MetricName } from './metric-name';
import { NullReason } from './null-reason';

export interface CommitCadenceSignal {
  readonly commits52Weeks: number;
}

export interface ReleaseFrequencySignal {
  readonly releases12Months: number;
}

export interface IssueResolutionHealthSignal {
  readonly openedIssues180Days: number;
  readonly closedIssues180Days: number;
  readonly medianDaysToClose180Days: number | null;
}

export interface ContributorConcentrationSignal {
  readonly topContributorCommits12Months: number;
  readonly totalHumanCommits12Months: number;
}

export interface DownloadMomentumSignal {
  readonly current30DayDownloads: number;
  readonly prior30DayDownloads: number;
  readonly lowerConfidence: boolean;
}

export interface DocumentationPresenceSignal {
  readonly readmeSizeBytes: number | null;
  readonly hasHomepageUrl: boolean;
  readonly hasDocsFolder: boolean;
  readonly fencedCodeBlockCount: number;
}

export type SignalResult<T> =
  | {
      readonly status: 'success';
      readonly metricName: MetricName;
      readonly data: T;
    }
  | {
      readonly status: 'unavailable';
      readonly metricName: MetricName;
      readonly reason: NullReason;
    };

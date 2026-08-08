import { describe, expect, it } from 'vitest';
import {
  calculateCommitCadence,
  calculateContributorConcentration,
  calculateDocumentationPresence,
  calculateDownloadMomentum,
  calculateIssueResolutionHealth,
  calculateReleaseFrequency,
} from '@/domain/services/metric-calculations';

describe('metric-calculations', () => {
  describe('calculateCommitCadence', () => {
    it('returns the number of commits in 52 weeks', () => {
      expect(calculateCommitCadence({ commits52Weeks: 100 })).toBe(100);
      expect(calculateCommitCadence({ commits52Weeks: 0 })).toBe(0);
    });
  });

  describe('calculateReleaseFrequency', () => {
    it('returns the number of releases in 12 months', () => {
      expect(calculateReleaseFrequency({ releases12Months: 12 })).toBe(12);
      expect(calculateReleaseFrequency({ releases12Months: 0 })).toBe(0);
    });
  });

  describe('calculateIssueResolutionHealth', () => {
    it('computes the resolution rate correctly', () => {
      const result = calculateIssueResolutionHealth({
        openedIssues180Days: 100,
        closedIssues180Days: 75,
        medianDaysToClose180Days: 5.5,
      });
      expect(result.resolutionRate).toBe(0.75);
      expect(result.medianDaysToClose).toBe(5.5);
    });

    it('preserves null when median days-to-close is unavailable', () => {
      const result = calculateIssueResolutionHealth({
        openedIssues180Days: 10,
        closedIssues180Days: 5,
        medianDaysToClose180Days: null,
      });
      expect(result.resolutionRate).toBe(0.5);
      expect(result.medianDaysToClose).toBeNull();
    });

    it('returns null for resolution rate if opened issues is 0', () => {
      const result = calculateIssueResolutionHealth({
        openedIssues180Days: 0,
        closedIssues180Days: 0,
        medianDaysToClose180Days: null,
      });
      expect(result.resolutionRate).toBeNull();
      
      const result2 = calculateIssueResolutionHealth({
        openedIssues180Days: 0,
        closedIssues180Days: 5,
        medianDaysToClose180Days: 2.0,
      });
      expect(result2.resolutionRate).toBeNull();
    });
  });

  describe('calculateContributorConcentration', () => {
    it('computes the ratio of top contributor commits to total human commits', () => {
      expect(
        calculateContributorConcentration({
          topContributorCommits12Months: 60,
          totalHumanCommits12Months: 100,
        }),
      ).toBe(0.6);
    });

    it('returns null if total human commits is 0 to avoid Infinity/NaN', () => {
      expect(
        calculateContributorConcentration({
          topContributorCommits12Months: 0,
          totalHumanCommits12Months: 0,
        }),
      ).toBeNull();
    });
  });

  describe('calculateDownloadMomentum', () => {
    it('computes the growth formula log(1 + current) - log(1 + prior)', () => {
      const result = calculateDownloadMomentum({
        current30DayDownloads: 1000,
        prior30DayDownloads: 500,
        lowerConfidence: false,
      });
      const expected = Math.log(1 + 1000) - Math.log(1 + 500);
      expect(result.growth).toBeCloseTo(expected);
      expect(result.lowerConfidence).toBe(false);
    });

    it('preserves lowerConfidence flag', () => {
      const result = calculateDownloadMomentum({
        current30DayDownloads: 50,
        prior30DayDownloads: 50,
        lowerConfidence: true,
      });
      expect(result.growth).toBe(0);
      expect(result.lowerConfidence).toBe(true);
    });

    it('handles zero downloads correctly', () => {
      const result = calculateDownloadMomentum({
        current30DayDownloads: 0,
        prior30DayDownloads: 0,
        lowerConfidence: false,
      });
      expect(result.growth).toBe(0);
    });
  });

  describe('calculateDocumentationPresence', () => {
    it('returns 3 if all checklist items are met (with docs folder)', () => {
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 2000,
          hasHomepageUrl: false,
          hasDocsFolder: true,
          fencedCodeBlockCount: 2,
        }),
      ).toBe(3);
    });

    it('returns 3 if all checklist items are met (with homepage)', () => {
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 1500, // Exact boundary
          hasHomepageUrl: true,
          hasDocsFolder: false,
          fencedCodeBlockCount: 1, // Exact boundary
        }),
      ).toBe(3);
    });

    it('returns 0 if no checklist items are met', () => {
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 1499,
          hasHomepageUrl: false,
          hasDocsFolder: false,
          fencedCodeBlockCount: 0,
        }),
      ).toBe(0);
    });

    it('handles null readme size gracefully', () => {
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: null,
          hasHomepageUrl: true,
          hasDocsFolder: false,
          fencedCodeBlockCount: 5,
        }),
      ).toBe(2);
    });

    it('scores README size strictly >= 1.5KB (1500 bytes boundary)', () => {
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 1500,
          hasHomepageUrl: false,
          hasDocsFolder: false,
          fencedCodeBlockCount: 0,
        }),
      ).toBe(1);

      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 1499,
          hasHomepageUrl: false,
          hasDocsFolder: false,
          fencedCodeBlockCount: 0,
        }),
      ).toBe(0);
    });
    
    it('scores 1 for homepage OR docs folder', () => {
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 0,
          hasHomepageUrl: true,
          hasDocsFolder: false,
          fencedCodeBlockCount: 0,
        }),
      ).toBe(1);

      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 0,
          hasHomepageUrl: false,
          hasDocsFolder: true,
          fencedCodeBlockCount: 0,
        }),
      ).toBe(1);
      
      expect(
        calculateDocumentationPresence({
          readmeSizeBytes: 0,
          hasHomepageUrl: true,
          hasDocsFolder: true,
          fencedCodeBlockCount: 0,
        }),
      ).toBe(1);
    });
  });
});

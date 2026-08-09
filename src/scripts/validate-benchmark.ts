import * as fs from 'fs';
import * as path from 'path';

import { BENCHMARK_DATASET } from '../infrastructure/benchmark/benchmark-data';
import { GitHubV1Adapter } from '../infrastructure/github/GitHubV1Adapter';
import { NpmV1Adapter } from '../infrastructure/registry/NpmV1Adapter';
import { PyPIV1Adapter } from '../infrastructure/registry/PyPIV1Adapter';
import { BenchmarkPopulationService } from '../infrastructure/benchmark/BenchmarkPopulationService';
import { orchestrateV1Scoring, V1MetricSignals } from '../domain/services/V1ScoringService';
import { BenchmarkValidationService, ScoredBenchmarkEntry } from '../infrastructure/benchmark/BenchmarkValidationService';

const CACHE_FILE = path.join(__dirname, 'benchmark-signals-cache.json');

async function main(): Promise<void> {
  console.log(`Starting benchmark validation with ${BENCHMARK_DATASET.length} packages.`);

  const githubAdapter = new GitHubV1Adapter();
  const npmAdapter = new NpmV1Adapter();
  const pypiAdapter = new PyPIV1Adapter();

  let cache: Record<string, V1MetricSignals> = {};
  if (fs.existsSync(CACHE_FILE)) {
    console.log('Loading from cache...');
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  }

  const signalsList: { entry: typeof BENCHMARK_DATASET[0], signals: V1MetricSignals }[] = [];

  const concurrency = 10;
  let active = 0;
  let index = 0;

  await new Promise<void>((resolve) => {
    const next = async () => {
      if (index >= BENCHMARK_DATASET.length) {
        if (active === 0) resolve();
        return;
      }

      const i = index++;
      active++;

      const entry = BENCHMARK_DATASET[i];
      const key = `${entry.registry}:${entry.packageName}`;

      try {
        if (cache[key]) {
          signalsList.push({ entry, signals: cache[key] });
        } else {
          console.log(`[${i + 1}/${BENCHMARK_DATASET.length}] Fetching data for ${key}...`);

          const signals: Partial<V1MetricSignals> = {};

          if (entry.githubOwner && entry.githubRepo) {
            const [cadence, concentration, releases, issues, docs] = await Promise.all([
              githubAdapter.getCommitCadence(entry.githubOwner, entry.githubRepo),
              githubAdapter.getContributorConcentration(entry.githubOwner, entry.githubRepo),
              githubAdapter.getReleaseFrequency(entry.githubOwner, entry.githubRepo),
              githubAdapter.getIssueResolutionHealth(entry.githubOwner, entry.githubRepo),
              githubAdapter.getDocumentationPresence(entry.githubOwner, entry.githubRepo)
            ]);
            signals.commitCadence = cadence;
            signals.contributorConcentration = concentration;
            signals.releaseFrequency = releases;
            signals.issueResolutionHealth = issues;
            signals.documentationPresence = docs;
          } else {
            const dummy = { status: 'unavailable', reason: 'unsupported_or_unresolved' } as const;
            signals.commitCadence = { ...dummy, metricName: 'commit_cadence' };
            signals.contributorConcentration = { ...dummy, metricName: 'contributor_concentration' };
            signals.releaseFrequency = { ...dummy, metricName: 'release_frequency' };
            signals.issueResolutionHealth = { ...dummy, metricName: 'issue_resolution_health' };
            signals.documentationPresence = { ...dummy, metricName: 'documentation_presence' };
          }

          if (entry.registry === 'npm') {
            signals.downloadMomentum = await npmAdapter.getDownloadMomentum(entry.packageName);
          } else if (entry.registry === 'pypi') {
            signals.downloadMomentum = await pypiAdapter.getDownloadMomentum(entry.packageName);
          }

          cache[key] = signals as V1MetricSignals;
          signalsList.push({ entry, signals: signals as V1MetricSignals });
          fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
          console.log(`[${i + 1}/${BENCHMARK_DATASET.length}] Finished ${key}`);
        }
      } catch (e: unknown) {
        console.error(`Error processing ${key}`, e);
      }

      active--;
      next();
    };

    for (let i = 0; i < concurrency; i++) next();
  });

  const extractedMetrics = signalsList.map(s => {
    return {
      commitCadence: s.signals.commitCadence.status === 'success' ? s.signals.commitCadence.data.commits52Weeks : null,
      releaseFrequency: s.signals.releaseFrequency.status === 'success' ? s.signals.releaseFrequency.data.releases12Months : null,
      issueResolutionHealth: s.signals.issueResolutionHealth.status === 'success' ?
        {
          resolutionRate: s.signals.issueResolutionHealth.data.openedIssues180Days > 0 ?
             s.signals.issueResolutionHealth.data.closedIssues180Days / s.signals.issueResolutionHealth.data.openedIssues180Days : null,
          medianDaysToClose: s.signals.issueResolutionHealth.data.medianDaysToClose180Days
        } : null,
      contributorConcentration: s.signals.contributorConcentration.status === 'success' ?
         (s.signals.contributorConcentration.data.topContributorCommits12Months / s.signals.contributorConcentration.data.totalHumanCommits12Months) : null,
      downloadMomentum: s.signals.downloadMomentum.status === 'success' ?
         (Math.log(1 + s.signals.downloadMomentum.data.current30DayDownloads) - Math.log(1 + s.signals.downloadMomentum.data.prior30DayDownloads)) : null,
      documentationPresence: s.signals.documentationPresence.status === 'success' ?
         ((s.signals.documentationPresence.data.readmeSizeBytes && s.signals.documentationPresence.data.readmeSizeBytes >= 1500 ? 1 : 0) +
          (s.signals.documentationPresence.data.hasHomepageUrl || s.signals.documentationPresence.data.hasDocsFolder ? 1 : 0) +
          (s.signals.documentationPresence.data.fencedCodeBlockCount > 0 ? 1 : 0)) * (100 / 3) : null
    };
  });

  const populations = BenchmarkPopulationService.extractPopulations(extractedMetrics);

  const scoredEntries: ScoredBenchmarkEntry[] = [];

  const distributions: Record<string, number[]> = {
    'Thriving': [],
    'Stable': [],
    'Declining': [],
    'Abandoned': []
  };

  for (const { entry, signals } of signalsList) {
    try {
      const score = orchestrateV1Scoring(signals, populations);
      if (score.value !== null) {
        scoredEntries.push({
          ...entry,
          healthScore: score.value
        });
        distributions[entry.tier].push(score.value);
      }
    } catch (e: unknown) {
        if (e && typeof e === 'object' && 'name' in e && e.name === 'InsufficientMetricDataError') {
            // expected omission for unscoreable packages
        } else {
            console.error(`Unexpected error scoring ${entry.packageName}:`, e);
        }
    }
  }

  const validator = new BenchmarkValidationService();
  const validationResult = validator.validate(scoredEntries);

  console.log('\n--- VALIDATION RESULTS ---');
  console.log(`Sample Size: ${validationResult.sampleSize}`);
  if (validationResult.status === 'valid') {
    console.log(`Initial Spearman Rho: ${validationResult.rho.toFixed(4)}`);
  }

  console.log('\n--- PER-TIER SCORE DISTRIBUTIONS ---');
  for (const tier of Object.keys(distributions)) {
    const scores = distributions[tier].sort((a,b)=>a-b);
    if (scores.length > 0) {
      console.log(`${tier.padEnd(10)}: Count = ${scores.length}, Min = ${Math.min(...scores)}, Max = ${Math.max(...scores)}, Median = ${scores[Math.floor(scores.length / 2)]}`);
    }
  }
}

main().catch(console.error);

import { BENCHMARK_DATASET } from '../benchmark-data';
import { DatasetValidator } from '../DatasetValidator';

function generateReviewReport() {
  const dataset = BENCHMARK_DATASET;
  const readinessErrors = DatasetValidator.validateDatasetReadiness(dataset);
  const structuralErrors = DatasetValidator.validateDataset(dataset);

  let report = '# Benchmark Curation Review Report\n\n';

  report += `## Summary\n`;
  report += `- Total Packages: ${dataset.length}\n`;
  if (readinessErrors.length > 0) {
    report += `- Readiness Errors:\n${readinessErrors.map(e => `  - ${e}`).join('\n')}\n`;
  } else {
    report += `- Readiness: READY (50-100 packages, all tiers present)\n`;
  }

  if (structuralErrors.length > 0) {
    report += `- Structural Errors:\n${structuralErrors.map(e => `  - ${e}`).join('\n')}\n`;
  } else {
    report += `- Structural Validation: PASS\n`;
  }

  report += `\n## Candidates\n\n`;

  if (dataset.length === 0) {
    report += `*The dataset is currently empty. Please curate packages in \`benchmark-data.ts\`.*\n`;
  } else {
    dataset.forEach((entry, index) => {
      report += `### ${index + 1}. ${entry.registry}/${entry.packageName}\n`;
      report += `- **GitHub**: ${entry.githubOwner ? `${entry.githubOwner}/${entry.githubRepo}` : 'N/A'}\n`;
      report += `- **Tier**: ${entry.tier}\n`;
      report += `- **Justification**: ${entry.justification}\n`;
      report += '\n';
    });
  }

  return report;
}

if (require.main === module) {
  console.log(generateReviewReport());
}

export { generateReviewReport };

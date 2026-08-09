/**
 * Calculates Spearman's rank correlation coefficient (rho) for two variables.
 *
 * Requirements:
 * - Equal-length arrays are required.
 * - Empty input returns null.
 * - A single observation returns null.
 * - If either variable has zero variance, return null.
 * - Handle ties using average/fractional ranks.
 */
export function calculateSpearmanCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length) return null;
  const n = x.length;
  if (n <= 1) return null;

  const rankX = computeRanks(x);
  const rankY = computeRanks(y);

  if (!rankX || !rankY) return null;

  return calculatePearsonCorrelation(rankX, rankY);
}

function computeRanks(values: number[]): number[] | null {
  const n = values.length;
  if (n <= 1) return null;
  
  // Create array of objects with value and original index
  const indexedValues = values.map((val, idx) => ({ val, idx }));
  indexedValues.sort((a, b) => a.val - b.val);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexedValues[j].val === indexedValues[j + 1].val) {
      j++;
    }
    // average rank (1-indexed)
    const sumRanks = ((i + 1) + (j + 1)) * (j - i + 1) / 2;
    const avgRank = sumRanks / (j - i + 1);
    
    for (let k = i; k <= j; k++) {
      ranks[indexedValues[k].idx] = avgRank;
    }
    i = j + 1;
  }
  
  return ranks;
}

function calculatePearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominatorSq = (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY);

  if (denominatorSq <= 0) return null; // zero variance in at least one array

  return numerator / Math.sqrt(denominatorSq);
}

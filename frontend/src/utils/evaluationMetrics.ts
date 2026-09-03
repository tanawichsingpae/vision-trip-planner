/**
 * Evaluation Metrics and Statistical Analysis Utility for Visual Place Recognition (VPR)
 * Designed for Academic Thesis Benchmarks (Chapter 3 & Chapter 4)
 */

// ==========================================
// 1. Multi-Alias Ground Truth & String Matching
// ==========================================

export interface AliasMatchResult {
  isCorrect: boolean;
  matchScore: number; // 0 to 1
  matchedAlias: string | null;
  rank: number; // 1-indexed rank among candidates (1 if top-1 matches, 0 if not found)
}

/**
 * Normalizes a string for robust fuzzy comparison
 */
export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics/accents
    .replace(/[^a-z0-9\u0E00-\u0E7F\s]/g, " ") // Keep alphanumeric, Thai unicode, and spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses Ground Truth strings that may contain multiple aliases (separated by |, ;, or commas)
 * Example: "Wat Arun | วัดอรุณ | Temple of Dawn" -> ["wat arun", "วัดอรุณ", "temple of dawn"]
 */
export function parseAliases(groundTruthStr: string): string[] {
  if (!groundTruthStr) return [];
  return groundTruthStr
    .split(/[|;,]/)
    .map(s => normalizeString(s))
    .filter(s => s.length > 0);
}

/**
 * Computes Levenshtein Distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (b[j - 1] === a[i - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Calculates similarity score (0.0 to 1.0) based on substring containment, token overlap, and Levenshtein similarity
 */
export function calculateStringSimilarity(candidate: string, target: string): number {
  const cNorm = normalizeString(candidate);
  const tNorm = normalizeString(target);

  if (!cNorm || !tNorm) return 0;
  if (cNorm === tNorm) return 1.0;

  // Substring containment check
  if (cNorm.includes(tNorm) || tNorm.includes(cNorm)) {
    const minLen = Math.min(cNorm.length, tNorm.length);
    const maxLen = Math.max(cNorm.length, tNorm.length);
    return Math.max(0.85, minLen / maxLen);
  }

  // Token Jaccard similarity
  const cTokens = new Set(cNorm.split(" "));
  const tTokens = new Set(tNorm.split(" "));
  const intersection = new Set([...cTokens].filter(x => tTokens.has(x)));
  const union = new Set([...cTokens, ...tTokens]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  // Levenshtein similarity ratio
  const maxLen = Math.max(cNorm.length, tNorm.length);
  const levDist = levenshteinDistance(cNorm, tNorm);
  const levSim = maxLen > 0 ? 1 - levDist / maxLen : 0;

  return Math.max(jaccard, levSim);
}

/**
 * Evaluates whether a prediction matches any of the ground truth aliases,
 * and checks candidate rankings for Recall@K and MRR computation.
 */
export function evaluatePredictionWithAliases(
  predicted: string,
  groundTruth: string,
  candidates: Array<{ name: string; similarity?: number }> = [],
  threshold: number = 0.72
): AliasMatchResult {
  const aliases = parseAliases(groundTruth);
  if (aliases.length === 0) {
    return { isCorrect: false, matchScore: 0, matchedAlias: null, rank: 0 };
  }

  // 1. Check top-1 prediction
  let bestScore = 0;
  let bestAlias: string | null = null;

  for (const alias of aliases) {
    const score = calculateStringSimilarity(predicted, alias);
    if (score > bestScore) {
      bestScore = score;
      bestAlias = alias;
    }
  }

  const isTop1Correct = bestScore >= threshold;

  // 2. Determine rank across candidate list
  let foundRank = isTop1Correct ? 1 : 0;

  if (!isTop1Correct && candidates && candidates.length > 0) {
    for (let i = 0; i < candidates.length; i++) {
      const candName = candidates[i]?.name || "";
      for (const alias of aliases) {
        const score = calculateStringSimilarity(candName, alias);
        if (score >= threshold) {
          foundRank = i + 1;
          break;
        }
      }
      if (foundRank > 0) break;
    }
  }

  return {
    isCorrect: isTop1Correct,
    matchScore: parseFloat(bestScore.toFixed(3)),
    matchedAlias: bestAlias,
    rank: foundRank
  };
}


// ==========================================
// 2. Academic Retrieval Metrics (Recall@K, MRR)
// ==========================================

/**
 * Calculates Recall@K (%) from an array of match ranks (1-indexed, 0 if not found)
 */
export function calculateRecallAtK(ranks: number[], k: number): number {
  if (!ranks || ranks.length === 0) return 0;
  const count = ranks.filter(r => r > 0 && r <= k).length;
  return parseFloat(((count / ranks.length) * 100).toFixed(2));
}

/**
 * Calculates Mean Reciprocal Rank (MRR)
 */
export function calculateMRR(ranks: number[]): number {
  if (!ranks || ranks.length === 0) return 0;
  const sumReciprocal = ranks.reduce((sum, r) => {
    return sum + (r > 0 ? 1.0 / r : 0.0);
  }, 0);
  return parseFloat((sumReciprocal / ranks.length).toFixed(4));
}


// ==========================================
// 3. Geographic Coordinates & Haversine Distance
// ==========================================

/**
 * Calculates great-circle distance between two points on Earth in Kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2) ||
    (lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)
  ) {
    return -1; // Unknown
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}


// ==========================================
// 4. Statistical Significance Testing
// ==========================================

export interface McNemarResult {
  chi2: number;
  pValue: number;
  isSignificant: boolean; // p < 0.05
  contingency: {
    bothCorrect: number;  // a
    modelACorrectOnly: number; // b
    modelBCorrectOnly: number; // c
    bothIncorrect: number; // d
  };
  interpretation: string;
}

/**
 * Error Function (erf) approximation for Gaussian / Normal CDF
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * McNemar's Test for Paired Nominal Data (comparing accuracy of two models on the same images)
 * Uses Edwards' continuity correction: chi2 = (|b - c| - 1)^2 / (b + c)
 */
export function calculateMcNemarTest(
  modelAOutcomes: boolean[],
  modelBOutcomes: boolean[],
  modelALabel: string = "Model A",
  modelBLabel: string = "Model B"
): McNemarResult {
  const n = Math.min(modelAOutcomes.length, modelBOutcomes.length);
  let a = 0, b = 0, c = 0, d = 0;

  for (let i = 0; i < n; i++) {
    const resA = modelAOutcomes[i];
    const resB = modelBOutcomes[i];
    if (resA && resB) a++;
    else if (resA && !resB) b++;
    else if (!resA && resB) c++;
    else d++;
  }

  const discordant = b + c;
  let chi2 = 0;
  let pValue = 1.0;

  if (discordant > 0) {
    chi2 = Math.pow(Math.max(0, Math.abs(b - c) - 1), 2) / discordant;
    // p-value from chi2 with 1 degree of freedom: P(Chi2 >= x) = 2 * (1 - NormalCDF(sqrt(x)))
    const z = Math.sqrt(chi2);
    pValue = Math.max(0, Math.min(1, 2 * (1 - normalCDF(z))));
  }

  const isSignificant = pValue < 0.05;
  let interpretation = "";
  if (discordant === 0) {
    interpretation = "Both models achieved identical performance across all samples.";
  } else if (isSignificant) {
    const superior = b > c ? modelALabel : modelBLabel;
    interpretation = `Statistically significant difference detected (p = ${pValue.toFixed(4)} < 0.05). ${superior} demonstrated a statistically superior classification rate.`;
  } else {
    interpretation = `No statistically significant difference found between models (p = ${pValue.toFixed(4)} ≥ 0.05). Observed differences may be due to chance.`;
  }

  return {
    chi2: parseFloat(chi2.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    isSignificant,
    contingency: {
      bothCorrect: a,
      modelACorrectOnly: b,
      modelBCorrectOnly: c,
      bothIncorrect: d
    },
    interpretation
  };
}

export interface PairedTResult {
  tStat: number;
  pValue: number;
  meanDiff: number;
  isSignificant: boolean;
  interpretation: string;
}

/**
 * Paired Sample t-Test for continuous data (e.g. comparing Latency ms between two pipelines)
 */
export function calculatePairedTTest(
  sampleA: number[],
  sampleB: number[],
  labelA: string = "Pipeline A",
  labelB: string = "Pipeline B"
): PairedTResult {
  const n = Math.min(sampleA.length, sampleB.length);
  if (n < 2) {
    return {
      tStat: 0,
      pValue: 1.0,
      meanDiff: 0,
      isSignificant: false,
      interpretation: "Insufficient paired samples (n < 2) to perform statistical test."
    };
  }

  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    diffs.push(sampleA[i] - sampleB[i]);
  }

  const meanDiff = diffs.reduce((s, v) => s + v, 0) / n;
  const variance = diffs.reduce((s, v) => s + Math.pow(v - meanDiff, 2), 0) / (n - 1);
  const stdError = Math.sqrt(variance / n);

  let tStat = 0;
  let pValue = 1.0;

  if (stdError > 0) {
    tStat = meanDiff / stdError;
    // Two-tailed p-value approximation via normal approximation for moderate n
    const z = Math.abs(tStat);
    pValue = Math.max(0, Math.min(1, 2 * (1 - normalCDF(z))));
  }

  const isSignificant = pValue < 0.05;
  const faster = meanDiff < 0 ? labelA : labelB;
  const absDiff = Math.abs(Math.round(meanDiff));

  const interpretation = isSignificant
    ? `Significant latency difference (p = ${pValue.toFixed(4)} < 0.05). ${faster} was on average ${absDiff} ms faster.`
    : `No statistically significant latency difference observed (p = ${pValue.toFixed(4)} ≥ 0.05).`;

  return {
    tStat: parseFloat(tStat.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    meanDiff: parseFloat(meanDiff.toFixed(2)),
    isSignificant,
    interpretation
  };
}


// ==========================================
// 5. Expected Calibration Error (ECE)
// ==========================================

export interface ECEBin {
  binIndex: number;
  confidenceRange: string;
  avgConfidence: number;
  accuracy: number;
  count: number;
}

export interface ECEResult {
  ece: number; // 0 to 1
  bins: ECEBin[];
}

/**
 * Computes Expected Calibration Error (ECE) with M bins (default 10)
 */
export function calculateECE(
  confidences: number[],
  outcomes: boolean[],
  numBins: number = 10
): ECEResult {
  const n = Math.min(confidences.length, outcomes.length);
  if (n === 0) return { ece: 0, bins: [] };

  const bins: Array<{ confSum: number; correctCount: number; count: number }> = Array.from(
    { length: numBins },
    () => ({ confSum: 0, correctCount: 0, count: 0 })
  );

  for (let i = 0; i < n; i++) {
    const conf = Math.max(0, Math.min(1, confidences[i]));
    const isCorrect = outcomes[i];
    let binIdx = Math.floor(conf * numBins);
    if (binIdx >= numBins) binIdx = numBins - 1;

    bins[binIdx].confSum += conf;
    bins[binIdx].count += 1;
    if (isCorrect) bins[binIdx].correctCount += 1;
  }

  let weightedEceSum = 0;
  const detailedBins: ECEBin[] = [];

  bins.forEach((b, idx) => {
    const minC = (idx / numBins).toFixed(1);
    const maxC = ((idx + 1) / numBins).toFixed(1);
    const avgConf = b.count > 0 ? b.confSum / b.count : 0;
    const acc = b.count > 0 ? b.correctCount / b.count : 0;

    if (b.count > 0) {
      weightedEceSum += (b.count / n) * Math.abs(acc - avgConf);
    }

    detailedBins.push({
      binIndex: idx + 1,
      confidenceRange: `[${minC}, ${maxC})`,
      avgConfidence: parseFloat(avgConf.toFixed(3)),
      accuracy: parseFloat(acc.toFixed(3)),
      count: b.count
    });
  });

  return {
    ece: parseFloat(weightedEceSum.toFixed(4)),
    bins: detailedBins
  };
}


// ==========================================
// 6. Academic Table Generators (LaTeX & Markdown)
// ==========================================

export interface ModelBenchmarkRow {
  model: string;
  modelLabel: string;
  totalTests: number;
  recall1: number; // percentage
  recall3?: number; // percentage
  recall5?: number; // percentage
  mrr?: number;
  meanLatency: number; // ms
  medianLatency: number; // ms
  throughputFPS: number;
  avgConfidence?: number;
}

/**
 * Generates LaTeX Table source code using booktabs package (Ready for Thesis Chapter 4)
 */
export function generateLatexTable(
  data: ModelBenchmarkRow[],
  caption: string = "Visual Place Recognition (VPR) Model Benchmark Performance",
  label: string = "tab:vpr_benchmark"
): string {
  const hasRecall3 = data.some(d => d.recall3 !== undefined);
  const hasRecall5 = data.some(d => d.recall5 !== undefined);
  const hasMRR = data.some(d => d.mrr !== undefined);

  let colSpec = "l r r";
  let headerRow = "\\textbf{Model} & \\textbf{N} & \\textbf{Recall@1 (\\%)}";

  if (hasRecall3) {
    colSpec += " r";
    headerRow += " & \\textbf{Recall@3 (\\%)}";
  }
  if (hasRecall5) {
    colSpec += " r";
    headerRow += " & \\textbf{Recall@5 (\\%)}";
  }
  if (hasMRR) {
    colSpec += " r";
    headerRow += " & \\textbf{MRR}";
  }

  colSpec += " r r r";
  headerRow += " & \\textbf{Mean Lat. (ms)} & \\textbf{Med. Lat. (ms)} & \\textbf{FPS} \\\\";

  const rows = data.map(d => {
    let row = `    ${d.modelLabel} & ${d.totalTests} & ${d.recall1.toFixed(1)}\\%`;
    if (hasRecall3) row += ` & ${(d.recall3 || 0).toFixed(1)}\\%`;
    if (hasRecall5) row += ` & ${(d.recall5 || 0).toFixed(1)}\\%`;
    if (hasMRR) row += ` & ${(d.mrr || 0).toFixed(3)}`;
    row += ` & ${d.meanLatency} & ${d.medianLatency} & ${d.throughputFPS.toFixed(2)} \\\\`;
    return row;
  }).join("\n");

  return `\\begin{table}[htbp]
  \\centering
  \\caption{${caption}}
  \\label{${label}}
  \\begin{tabular}{${colSpec}}
    \\toprule
    ${headerRow}
    \\midrule
${rows}
    \\bottomrule
  \\end{tabular}
\\end{table}`;
}

/**
 * Generates clean GitHub Flavored Markdown Table
 */
export function generateMarkdownTable(data: ModelBenchmarkRow[]): string {
  const hasRecall3 = data.some(d => d.recall3 !== undefined);
  const hasRecall5 = data.some(d => d.recall5 !== undefined);
  const hasMRR = data.some(d => d.mrr !== undefined);

  const headers = ["Model", "Tests (N)", "Recall@1"];
  if (hasRecall3) headers.push("Recall@3");
  if (hasRecall5) headers.push("Recall@5");
  if (hasMRR) headers.push("MRR");
  headers.push("Mean Latency", "Median Latency", "Throughput");

  const align = headers.map(() => "---");
  const headerLine = `| ${headers.join(" | ")} |`;
  const alignLine = `| ${align.join(" | ")} |`;

  const rows = data.map(d => {
    const cols = [
      `**${d.modelLabel}**`,
      d.totalTests.toString(),
      `${d.recall1.toFixed(1)}%`
    ];
    if (hasRecall3) cols.push(`${(d.recall3 || 0).toFixed(1)}%`);
    if (hasRecall5) cols.push(`${(d.recall5 || 0).toFixed(1)}%`);
    if (hasMRR) cols.push((d.mrr || 0).toFixed(3));
    cols.push(`${d.meanLatency} ms`, `${d.medianLatency} ms`, `${d.throughputFPS.toFixed(2)} FPS`);
    return `| ${cols.join(" | ")} |`;
  }).join("\n");

  return `${headerLine}\n${alignLine}\n${rows}`;
}

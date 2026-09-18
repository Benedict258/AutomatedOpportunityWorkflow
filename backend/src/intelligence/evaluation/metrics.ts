import { EvaluationMetrics, ItemResult } from './types';

export function computeClassificationMetrics(results: ItemResult[]): EvaluationMetrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  let correct = 0;

  for (const r of results) {
    if (r.success) correct++;
    const pred = r.predicted as any;
    const exp = r.expected as any;

    if (pred && exp) {
      const predCat = pred.primaryCategory || pred.categoryId;
      const expCat = exp.primaryCategory || exp.categoryId;
      if (predCat === expCat) {
        tp++;
      } else {
        fp++;
        fn++;
      }
    }
  }

  const total = results.length;
  const accuracy = total > 0 ? correct / total : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

  return { accuracy, precision, recall, f1 };
}

export function computeExtractionMetrics(results: ItemResult[]): EvaluationMetrics {
  let fieldTp = 0, fieldFp = 0, fieldFn = 0;
  let schemaValid = 0;
  let totalLatency = 0;
  let totalTokens = 0;

  for (const r of results) {
    if (r.success) {
      schemaValid++;
    }
    if (r.latencyMs) totalLatency += r.latencyMs;
    if (r.tokenUsage) totalTokens += r.tokenUsage.total;

    const pred = r.predicted as any;
    const exp = r.expected as any;
    if (!pred || !exp) continue;

    const predKeys = Object.keys(pred);
    const expKeys = Object.keys(exp);

    for (const k of expKeys) {
      if (predKeys.includes(k)) {
        const predVal = JSON.stringify(pred[k]);
        const expVal = JSON.stringify(exp[k]);
        if (predVal === expVal) fieldTp++;
        else fieldFp++;
      } else {
        fieldFn++;
      }
    }
    for (const k of predKeys) {
      if (!expKeys.includes(k)) fieldFp++;
    }
  }

  const total = results.length;
  const precision = fieldTp + fieldFp > 0 ? fieldTp / (fieldTp + fieldFp) : 0;
  const recall = fieldTp + fieldFn > 0 ? fieldTp / (fieldTp + fieldFn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const schemaValidity = total > 0 ? schemaValid / total : 0;

  return { precision, recall, f1, schemaValidity, avgLatencyMs: total / totalLatency, avgTokens: total > 0 ? totalTokens / total : 0 };
}

export function computeEligibilityMetrics(results: ItemResult[]): EvaluationMetrics {
  let correct = 0;
  let falseEligible = 0;
  let falseIneligible = 0;
  let uncertainCorrect = 0;
  let uncertainTotal = 0;

  for (const r of results) {
    const pred = r.predicted as any;
    const exp = r.expected as any;
    if (!pred || !exp) continue;

    if (pred.status === exp.status) {
      correct++;
      if (exp.status === 'UNCERTAIN') uncertainCorrect++;
    } else {
      if (exp.status === 'ELIGIBLE' && pred.status === 'INELIGIBLE') falseIneligible++;
      if (exp.status === 'INELIGIBLE' && pred.status === 'ELIGIBLE') falseEligible++;
    }
    if (exp.status === 'UNCERTAIN') uncertainTotal++;
  }

  const total = results.length;
  const accuracy = total > 0 ? correct / total : 0;
  const uncertainAccuracy = uncertainTotal > 0 ? uncertainCorrect / uncertainTotal : 0;

  return { accuracy, recall: uncertainAccuracy };
}

export function computeSemanticMatchingMetrics(results: ItemResult[]): EvaluationMetrics {
  let totalError = 0;
  let count = 0;
  let rankingAgreements = 0;

  for (const r of results) {
    const pred = r.predicted as any;
    const exp = r.expected as any;
    if (!pred || !exp) continue;

    const predScore = pred.weightedScore || pred.skillSimilarity || 0;
    const expScore = exp.skillSimilarity || exp.domainSimilarity || 0;

    totalError += Math.abs(predScore - expScore);
    count++;

    if (pred.rankingAgreement === exp.rankingAgreement) rankingAgreements++;
  }

  const avgError = count > 0 ? totalError / count : 0;
  const consistency = count > 0 ? rankingAgreements / count : 0;

  return { accuracy: 1 - avgError, precision: consistency };
}

export function computeExplanationMetrics(results: ItemResult[]): EvaluationMetrics {
  let schemaValid = 0;
  let grounded = 0;
  let noHallucination = 0;
  let hasUncertainties = 0;

  for (const r of results) {
    const pred = r.predicted as any;
    if (!pred) continue;

    if (pred.summary && pred.strengths && pred.gaps) schemaValid++;
    if (pred.grounded) grounded++;
    if (!pred.hallucination) noHallucination++;
    if (pred.uncertainties?.length > 0) hasUncertainties++;
  }

  const total = results.length;
  return {
    schemaValidity: total > 0 ? schemaValid / total : 0,
    groundingScore: total > 0 ? grounded / total : 0,
    hallucinationRate: total > 0 ? (total - noHallucination) / total : 0,
    recall: total > 0 ? hasUncertainties / total : 0
  };
}

export function computeAggregatedMetrics(results: ItemResult[], operation: string): EvaluationMetrics {
  switch (operation) {
    case 'classification': return computeClassificationMetrics(results);
    case 'extraction': return computeExtractionMetrics(results);
    case 'eligibility': return computeEligibilityMetrics(results);
    case 'requirement-extraction': return computeExtractionMetrics(results);
    case 'semantic-matching': return computeSemanticMatchingMetrics(results);
    case 'reasoning': return computeExplanationMetrics(results);
    default:
      const success = results.filter(r => r.success).length;
      return { accuracy: results.length > 0 ? success / results.length : 0 };
  }
}
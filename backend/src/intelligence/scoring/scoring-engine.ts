import { MatchScoreResult, MatchFactorScore } from './types';

const DEFAULT_WEIGHTS: Record<string, number> = {
  careerAlignment: 0.25,
  skillAlignment: 0.20,
  eligibility: 0.15,
  experienceFit: 0.10,
  educationFit: 0.10,
  opportunityValue: 0.10,
  locationRemoteFit: 0.05,
  timingDeadline: 0.05,
};

export class DeterministicScoringEngine {
  score(inputs: {
    opportunityId: string;
    candidateId: string;
    factorScores: Record<string, { rawScore: number; confidence: number; evidence: string[] }>;
    hardEligibility: number;
  }): MatchScoreResult {
    const factors: MatchFactorScore[] = [];
    let weightedSum = 0;

    for (const [name, w] of Object.entries(DEFAULT_WEIGHTS)) {
      const input = inputs.factorScores[name] || { rawScore: 0, confidence: 0, evidence: [] };
      const normalizedScore = Math.max(0, Math.min(1, input.rawScore));
      const factor: MatchFactorScore = {
        name,
        weight: w,
        rawScore: input.rawScore,
        normalizedScore,
        confidence: input.confidence,
        evidence: input.evidence,
      };
      factors.push(factor);
      weightedSum += normalizedScore * w;
    }

    const weightedMatchScore = weightedSum;
    const finalScore = inputs.hardEligibility * weightedMatchScore;

    return {
      opportunityId: inputs.opportunityId,
      candidateId: inputs.candidateId,
      factors,
      weightedMatchScore,
      hardEligibility: inputs.hardEligibility,
      finalScore,
    };
  }
}

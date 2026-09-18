export interface MatchFactorScore {
  name: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  confidence: number;
  evidence: string[];
}

export interface MatchScoreResult {
  opportunityId: string;
  candidateId: string;
  factors: MatchFactorScore[];
  weightedMatchScore: number;
  hardEligibility: number;
  finalScore: number;
}

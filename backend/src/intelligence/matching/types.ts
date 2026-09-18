export interface SemanticFactor {
  name: string;
  score: number;
  confidence: number;
  evidence: string[];
}

export interface SemanticMatchResult {
  opportunityId: string;
  candidateId: string;
  skillSimilarity: SemanticFactor;
  careerSimilarity: SemanticFactor;
  technologySimilarity: SemanticFactor;
  domainSimilarity: SemanticFactor;
  experienceSimilarity: SemanticFactor;
  roleSimilarity: SemanticFactor;
  overall: number;
}

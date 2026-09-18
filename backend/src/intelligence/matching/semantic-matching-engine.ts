import { SemanticMatcher } from './semantic-matcher.interface';
import { SemanticMatchResult, SemanticFactor } from './types';

export class SemanticMatchingEngine implements SemanticMatcher {
  async match(opportunityId: string, candidateId: string): Promise<SemanticMatchResult> {
    const emptyFactor = (name: string): SemanticFactor => ({ name, score: 0, confidence: 0, evidence: [] });
    return {
      opportunityId,
      candidateId,
      skillSimilarity: emptyFactor('skillSimilarity'),
      careerSimilarity: emptyFactor('careerSimilarity'),
      technologySimilarity: emptyFactor('technologySimilarity'),
      domainSimilarity: emptyFactor('domainSimilarity'),
      experienceSimilarity: emptyFactor('experienceSimilarity'),
      roleSimilarity: emptyFactor('roleSimilarity'),
      overall: 0,
    };
  }
}

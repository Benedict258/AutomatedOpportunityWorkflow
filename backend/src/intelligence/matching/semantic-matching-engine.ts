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

  async computeMatch(candidate: any, opportunity: any): Promise<any> {
    const emptyFactor = (name: string) => ({ name, score: 0, confidence: 0, evidence: [] });
    return {
      factors: {
        skillSimilarity: 0,
        careerSimilarity: 0,
        experienceSimilarity: 0,
        technologySimilarity: 0,
        domainSimilarity: 0,
      },
      overall: 0,
      confidence: 0,
    };
  }
}

export const realMatchingEngine = new SemanticMatchingEngine();

import { SemanticMatchResult } from './types';

export interface SemanticMatcher {
  match(opportunityId: string, candidateId: string): Promise<SemanticMatchResult>;
}

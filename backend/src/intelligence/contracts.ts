import { OpportunityClassification, EligibilityAssessment, CandidateMatch, MatchScore, RankingResult, Explanation } from './types';

export interface Classifier { classify(opportunity): Promise<OpportunityClassification> }
export interface EligibilityEngine { assess(opportunity, candidate): EligibilityAssessment }
export interface MatchingEngine { match(opportunity, candidate): CandidateMatch }
export interface ScoringEngine { score(match): MatchScore }
export interface RankingEngine { rank(scores): RankingResult }
export interface ExplanationEngine { explain(intelligence): Explanation }

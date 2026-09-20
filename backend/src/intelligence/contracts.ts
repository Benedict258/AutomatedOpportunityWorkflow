import { OpportunityClassification, EligibilityAssessment, CandidateMatch, MatchScore, RankingResult, Explanation } from './types';

export interface Classifier { classify(opportunity: any): Promise<OpportunityClassification> }
export interface EligibilityEngine { assess(opportunity: any, candidate: any): EligibilityAssessment }
export interface MatchingEngine { match(opportunity: any, candidate: any): CandidateMatch }
export interface ScoringEngine { score(match: any): MatchScore }
export interface RankingEngine { rank(scores: any): RankingResult }
export interface ExplanationEngine { explain(intelligence: any): Explanation }

import { NormalizedOpportunity } from '../normalization/types';

export interface DuplicateCandidate {
  opportunity: NormalizedOpportunity;
  fingerprint: string;
  source: string;
  externalId?: string;
  normalizedTitle?: string;
  normalizedOrg?: string;
  normalizedUrl?: string;
  descriptionHash?: string;
}

export interface MatchingRule {
  id: string;
  name: string;
  weight: number;
  description?: string;
  evaluate: (a: DuplicateCandidate, b: DuplicateCandidate) => number; // score 0-1
}

export interface CandidatePair {
  a: DuplicateCandidate;
  b: DuplicateCandidate;
  scores: Record<string, number>;
  aggregateScore: number;
  matchedRules: string[];
}

export interface DuplicateGroup {
  groupId: string;
  canonicalCandidate?: DuplicateCandidate;
  candidates: DuplicateCandidate[];
  similarityScore: number; // average pairwise score within group
  matchingRulesTriggered: string[];
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface DeduplicationResult {
  groups: DuplicateGroup[];
  uniqueCandidates: DuplicateCandidate[];
  duplicateCandidates: DuplicateCandidate[];
  stats: {
    totalCandidates: number;
    totalGroups: number;
    duplicateGroups: number;
    uniqueCount: number;
    duplicateCount: number;
    processedAt: string;
    processingMs: number;
  };
  unmatched?: DuplicateCandidate[];
}

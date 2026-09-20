import crypto from 'crypto';
import { DuplicateCandidate, DuplicateGroup, DeduplicationResult, CandidatePair } from './types';
import { MatchingRule } from './types';
import { getMatchingRules } from './matching-rules';

export interface DedupEngineOptions {
  rules?: MatchingRule[];
  similarityThreshold?: number;
  clusterThreshold?: number;
}

export class DeduplicationEngine {
  private rules: MatchingRule[];
  private similarityThreshold: number;
  private clusterThreshold: number;

  constructor(options: DedupEngineOptions = {}) {
    this.rules = getMatchingRules(options.rules);
    this.similarityThreshold = options.similarityThreshold ?? 0.75;
    this.clusterThreshold = options.clusterThreshold ?? 0.75;
  }

  public deduplicate(candidates: DuplicateCandidate[]): DeduplicationResult {
    const startMs = Date.now();
    
    if (!candidates || candidates.length === 0) {
      return this.emptyResult(startMs);
    }

    // Pre-group by fingerprint for fast exact matches
    const fingerprintMap = new Map<string, DuplicateCandidate[]>();
    for (const c of candidates) {
      const list = fingerprintMap.get(c.fingerprint) ?? [];
      list.push(c);
      fingerprintMap.set(c.fingerprint, list);
    }

    const visited = new Set<string>();
    const groups: DuplicateGroup[] = [];
    const uniqueCandidates: DuplicateCandidate[] = [];
    const duplicateCandidates: DuplicateCandidate[] = [];

    // Process fingerprint buckets first
    for (const [fingerprint, bucket] of fingerprintMap.entries()) {
      if (bucket.length === 1) {
        const c = bucket[0];
        if (!visited.has(this.candidateKey(c))) {
          uniqueCandidates.push(c);
          visited.add(this.candidateKey(c));
        }
        continue;
      }

      // Create a group for fingerprint collision
      const group = this.createGroup(bucket, fingerprint, 'fingerprint_exact');
      groups.push(group);
      bucket.forEach(c => {
        visited.add(this.candidateKey(c));
        duplicateCandidates.push(c);
      });
    }

    // Find remaining duplicates via pairwise similarity
    const remaining = candidates.filter(c => !visited.has(this.candidateKey(c)));
    
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[i];
      if (visited.has(this.candidateKey(a))) continue;

      const pairGroup: DuplicateCandidate[] = [a];
      visited.add(this.candidateKey(a));

      for (let j = i + 1; j < remaining.length; j++) {
        const b = remaining[j];
        if (visited.has(this.candidateKey(b))) continue;

        const pair = this.scorePair(a, b);
        if (pair.aggregateScore >= this.clusterThreshold) {
          pairGroup.push(b);
          visited.add(this.candidateKey(b));
        }
      }

      if (pairGroup.length > 1) {
        const group = this.createGroup(pairGroup);
        groups.push(group);
        pairGroup.forEach(c => duplicateCandidates.push(c));
      } else {
        uniqueCandidates.push(a);
      }
    }

    // Ensure all visited candidates are accounted for
    const allVisited = new Set<string>();
    groups.forEach(g => g.candidates.forEach(c => allVisited.add(this.candidateKey(c))));
    
    const totalGroups = groups.length;
    const duplicateGroups = groups.filter(g => g.candidates.length > 1).length;

    return {
      groups,
      uniqueCandidates,
      duplicateCandidates,
      stats: {
        totalCandidates: candidates.length,
        totalGroups: totalGroups,
        duplicateGroups,
        uniqueCount: uniqueCandidates.length,
        duplicateCount: duplicateCandidates.length,
        processedAt: new Date().toISOString(),
        processingMs: Date.now() - startMs,
      },
    };
  }

  private scorePair(a: DuplicateCandidate, b: DuplicateCandidate): CandidatePair {
    const scores: Record<string, number> = {};
    const matchedRules: string[] = [];
    let weightedSum = 0;
    let weightTotal = 0;

    for (const rule of this.rules) {
      const score = rule.evaluate(a, b);
      scores[rule.id] = score;
      if (score > 0) {
        matchedRules.push(rule.id);
        weightedSum += score * rule.weight;
        weightTotal += rule.weight;
      }
    }

    const aggregateScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

    return {
      a,
      b,
      scores,
      aggregateScore,
      matchedRules,
    };
  }

  private createGroup(candidates: DuplicateCandidate[], fingerprint?: string, forcedRule?: string): DuplicateGroup {
    const groupId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const createdAt = new Date().toISOString();

    // Choose canonical candidate: prefer non-empty externalId, then earliest firstSeenAt
    const canonicalCandidate = candidates.reduce((best, curr) => {
      if (!best) return curr;
      if (curr.opportunity.externalId && !best.opportunity.externalId) return curr;
      if (curr.opportunity.externalId && best.opportunity.externalId && curr.opportunity.externalId === best.opportunity.externalId) return best;
      const currSeen = curr.opportunity.firstSeenAt ? new Date(curr.opportunity.firstSeenAt).getTime() : Infinity;
      const bestSeen = best.opportunity.firstSeenAt ? new Date(best.opportunity.firstSeenAt).getTime() : Infinity;
      return currSeen < bestSeen ? curr : best;
    }, candidates[0] as DuplicateCandidate);

    // Compute average pairwise similarity
    let totalScore = 0;
    let pairCount = 0;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const pair = this.scorePair(candidates[i], candidates[j]);
        totalScore += pair.aggregateScore;
        pairCount++;
      }
    }
    const similarityScore = pairCount > 0 ? totalScore / pairCount : 1;

    // Determine matching rules triggered
    const matchingRulesTriggered = new Set<string>();
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const pair = this.scorePair(candidates[i], candidates[j]);
        pair.matchedRules.forEach(r => matchingRulesTriggered.add(r));
      }
    }
    if (forcedRule) matchingRulesTriggered.add(forcedRule);

    return {
      groupId,
      canonicalCandidate,
      candidates,
      similarityScore,
      matchingRulesTriggered: Array.from(matchingRulesTriggered),
      createdAt,
      meta: {
        fingerprint,
        size: candidates.length,
      },
    };
  }

  private candidateKey(c: DuplicateCandidate): string {
    return `${c.source}::${c.opportunity.externalId ?? c.opportunity.title ?? ''}::${c.fingerprint}`;
  }

  private emptyResult(startMs: number): DeduplicationResult {
    return {
      groups: [],
      uniqueCandidates: [],
      duplicateCandidates: [],
      stats: {
        totalCandidates: 0,
        totalGroups: 0,
        duplicateGroups: 0,
        uniqueCount: 0,
        duplicateCount: 0,
        processedAt: new Date().toISOString(),
        processingMs: Date.now() - startMs,
      },
    };
  }
}

export const createDeduplicationEngine = (options?: DedupEngineOptions) => {
  return new DeduplicationEngine(options);
};

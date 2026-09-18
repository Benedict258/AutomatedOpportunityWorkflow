import { RankedOpportunity, RankingOptions } from './types';

export class RankingEngine {
  rank(scores: { opportunityId: string; finalScore: number; hardEligibility: number; factors: any }[], options?: RankingOptions): RankedOpportunity[] {
    let items = scores.slice();
    if (options?.filterEligibleOnly) {
      items = items.filter(s => s.hardEligibility === 1);
    }
    if (options?.minScore !== undefined) {
      items = items.filter(s => s.finalScore >= options.minScore!);
    }
    items.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return a.opportunityId.localeCompare(b.opportunityId);
    });
    return items.map((s, idx) => ({ ...s, rank: idx + 1 }));
  }
}

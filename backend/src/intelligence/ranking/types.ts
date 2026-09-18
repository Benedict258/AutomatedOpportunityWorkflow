export interface RankedOpportunity {
  opportunityId: string;
  finalScore: number;
  hardEligibility: number;
  factors: any;
  rank: number;
}

export interface RankingOptions {
  filterEligibleOnly?: boolean;
  minScore?: number;
  category?: string;
}

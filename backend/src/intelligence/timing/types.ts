export interface TimingAssessment {
  opportunityId: string;
  deadlineDistanceDays: number | null;
  deadlineUrgency: 'low' | 'medium' | 'high' | 'expired';
  isExpired: boolean;
  isStale: boolean;
  timeToApply: number | null;
  actionability: number;
  evidence: string[];
}

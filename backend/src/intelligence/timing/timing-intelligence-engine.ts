import { TimingAssessment } from './types';

export class TimingIntelligenceEngine {
  assess(opportunity: any): TimingAssessment {
    const now = new Date();
    const deadline = opportunity.deadline ? new Date(opportunity.deadline) : null;
    const distance = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000*60*60*24)) : null;
    const isExpired = distance !== null && distance < 0;
    const urgency: TimingAssessment['deadlineUrgency'] = isExpired ? 'expired' : distance === null ? 'low' : distance <= 7 ? 'high' : distance <= 30 ? 'medium' : 'low';
    const actionability = isExpired ? 0 : (distance === null ? 0.5 : Math.min(1, Math.max(0, 1 - distance/90)));
    return {
      opportunityId: opportunity.id,
      deadlineDistanceDays: distance,
      deadlineUrgency: urgency,
      isExpired,
      isStale: !!opportunity.isStale,
      timeToApply: distance,
      actionability,
      evidence: ['computed from deadline']
    };
  }
}

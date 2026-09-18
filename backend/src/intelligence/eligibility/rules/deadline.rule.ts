import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function deadlineRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id ?? 'deadline';
  const reqDesc = requirement.description ?? 'Application deadline';
  const candidateField = 'availability.earliestStartDate';
  const deadlineStr = requirement.value ?? ctx.opportunity.deadline;
  
  if (isMissing(deadlineStr)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Deadline not set', undefined, 0);
  }
  
  const deadline = new Date(deadlineStr);
  const now = new Date();
  if (isNaN(deadline.getTime())) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Invalid deadline format', { deadline: deadlineStr }, 0);
  }
  
  const stillOpen = deadline >= now;
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    stillOpen ? 'ELIGIBLE' : 'INELIGIBLE',
    stillOpen ? `Deadline ${deadlineStr} is in future` : `Deadline ${deadlineStr} has passed`,
    { deadline: deadlineStr, now: now.toISOString() },
    1
  );
}

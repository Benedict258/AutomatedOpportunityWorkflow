import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function graduationTimingRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Graduation timing requirement';
  const candidateField = 'education.graduationDate';
  const operator = requirement.operator ?? 'lte';
  
  const actual = candidate.education?.graduationDate;
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Graduation date missing', undefined, 0);
  }
  
  const gradDate = new Date(actual);
  if (isNaN(gradDate.getTime())) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Graduation date invalid', { candidate: actual }, 0);
  }
  
  const now = new Date();
  let eligible = false;
  if (operator === 'lte') eligible = gradDate <= now;
  if (operator === 'gte') eligible = gradDate >= now;
  
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Graduation timing acceptable' : `Graduation date ${actual} does not satisfy ${operator}`,
    { candidate: actual, operator },
    1
  );
}

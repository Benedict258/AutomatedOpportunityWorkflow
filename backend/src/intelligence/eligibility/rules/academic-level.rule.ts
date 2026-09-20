import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function academicLevelRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Academic level requirement';
  const candidateField = 'education.academicLevel';
  const required = requirement.value;
  
  const actual = candidate.education?.academicLevel;
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Academic level missing', undefined, 0);
  }
  
  const eligible = actual!.toLowerCase() === String(required).toLowerCase();
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Academic level matches' : `Academic level ${actual} != ${required}`,
    { candidate: actual, required },
    1
  );
}

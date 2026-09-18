import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function educationRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Education requirement';
  const candidateField = 'education.highestDegree';
  const requiredValue = requirement.value;
  
  const actual = candidate.education?.highestDegree;
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Candidate education information missing', undefined, 0);
  }
  
  const eligible = !requiredValue || actual === requiredValue || (Array.isArray(requiredValue) && requiredValue.includes(actual));
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Education matches requirement' : `Education ${actual} does not match required ${requiredValue}`,
    { candidate: actual, required: requiredValue },
    eligible ? 1 : 1
  );
}

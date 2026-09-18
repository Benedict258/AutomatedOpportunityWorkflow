import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function securityClearanceRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Security clearance requirement';
  const candidateField = 'securityClearance';
  const required = requirement.value;
  
  const actual = candidate.securityClearance;
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Security clearance unknown', undefined, 0);
  }
  
  const eligible = !required || actual.toLowerCase() === String(required).toLowerCase();
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Security clearance satisfies' : `Clearance ${actual} != ${required}`,
    { candidate: actual, required },
    1
  );
}

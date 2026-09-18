import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function remoteEligibilityRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Remote eligibility requirement';
  const candidateField = 'remoteEligibility';
  const required = requirement.value === true;
  
  const actual = candidate.remoteEligibility;
  if (actual === undefined || actual === null) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Remote eligibility unknown', undefined, 0);
  }
  
  const eligible = actual === required;
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Remote eligibility matches' : `Candidate remote ${actual} != required ${required}`,
    { candidate: actual, required },
    1
  );
}

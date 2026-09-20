import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function certificationsRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Certifications requirement';
  const candidateField = 'certifications';
  const requiredCerts = Array.isArray(requirement.value) ? requirement.value : [requirement.value].filter(Boolean);
  
  const actual = candidate.certifications ?? [];
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Certifications missing', undefined, 0);
  }
  
  const hasAll = requiredCerts.every((rc: any) => actual.some(ac => ac.toLowerCase() === String(rc).toLowerCase()));
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    hasAll ? 'ELIGIBLE' : 'INELIGIBLE',
    hasAll ? 'All required certifications present' : `Missing certifications`,
    { candidate: actual, required: requiredCerts },
    1
  );
}

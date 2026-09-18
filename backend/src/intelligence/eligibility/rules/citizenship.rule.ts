import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function citizenshipRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Citizenship requirement';
  const candidateField = 'citizenship';
  const required = Array.isArray(requirement.value) ? requirement.value : [requirement.value].filter(Boolean);
  
  const actual = candidate.citizenship ?? [];
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Citizenship missing', undefined, 0);
  }
  
  const eligible = required.some(r => actual.map(a => a.toLowerCase()).includes(String(r).toLowerCase()));
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Citizenship matches' : `Citizenship ${actual.join(', ')} not in ${required.join(', ')}`,
    { candidate: actual, required },
    1
  );
}

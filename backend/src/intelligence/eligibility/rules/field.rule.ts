import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function fieldRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Field of study requirement';
  const candidateField = 'education.fieldOfStudy';
  const requiredFields = Array.isArray(requirement.value) ? requirement.value : [requirement.value].filter(Boolean);
  
  const actualFields = candidate.education?.fieldOfStudy ?? [];
  if (isMissing(actualFields)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Candidate field of study missing', undefined, 0);
  }
  
  const match = requiredFields.some((rf: any) => actualFields.some(af => af.toLowerCase().includes(String(rf).toLowerCase())));
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    match ? 'ELIGIBLE' : 'INELIGIBLE',
    match ? 'Field matches requirement' : `Fields ${actualFields.join(', ')} do not match required ${requiredFields.join(', ')}`,
    { candidate: actualFields, required: requiredFields },
    1
  );
}

import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function experienceRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Experience requirement';
  const candidateField = 'experience.years';
  const requiredYears = Number(requirement.value) || 0;
  const operator = requirement.operator ?? 'gte';
  
  const actual = candidate.experience?.years;
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Experience years missing', undefined, 0);
  }
  
  let eligible = false;
  if (operator === 'gte') eligible = actual >= requiredYears;
  else if (operator === 'lte') eligible = actual <= requiredYears;
  
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? `Experience ${actual} years meets ${operator} ${requiredYears}` : `Experience ${actual} years does not meet ${operator} ${requiredYears}`,
    { candidate: actual, required: requiredYears, operator },
    1
  );
}

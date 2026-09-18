import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function locationRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Location requirement';
  const candidateField = 'location.country';
  const requiredCountry = requirement.value;
  
  const actualCountry = candidate.location?.country;
  if (isMissing(actualCountry)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Candidate location missing', undefined, 0);
  }
  
  const eligible = !requiredCountry || actualCountry.toLowerCase() === String(requiredCountry).toLowerCase();
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Location matches' : `Location ${actualCountry} != ${requiredCountry}`,
    { candidate: actualCountry, required: requiredCountry },
    1
  );
}

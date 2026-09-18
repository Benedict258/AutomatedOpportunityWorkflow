import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

export function workAuthorizationRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Work authorization requirement';
  const candidateField = 'workAuthorization';
  const requiredCountry = requirement.value;
  
  const wa = candidate.workAuthorization;
  if (isMissing(wa) || isMissing(wa?.country) || isMissing(wa?.type)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Work authorization missing', undefined, 0);
  }
  
  const countryMatch = !requiredCountry || wa.country.toLowerCase() === String(requiredCountry).toLowerCase();
  const valid = ['citizen', 'permanent_resident', 'work_visa'].includes(wa.type.toLowerCase());
  
  const eligible = countryMatch && valid;
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Work authorization valid' : `Work authorization ${wa.type} in ${wa.country} insufficient`,
    { candidate: wa, requiredCountry },
    1
  );
}

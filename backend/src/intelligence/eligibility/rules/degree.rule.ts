import { EligibilityContext } from '../types';
import { isMissing, makeDecision } from './utils';

const DEGREE_RANK: Record<string, number> = {
  'high school': 1,
  'associate': 2,
  'bachelor': 3,
  'master': 4,
  'phd': 5,
};

export function degreeRule(candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) {
  const reqId = requirement.id;
  const reqDesc = requirement.description ?? 'Degree requirement';
  const candidateField = 'education.highestDegree';
  const required = requirement.value;
  const operator = requirement.operator ?? 'eq';
  
  const actual = candidate.education?.highestDegree?.toLowerCase();
  if (isMissing(actual)) {
    return makeDecision(reqId, reqDesc, candidateField, 'UNCERTAIN', 'Candidate degree missing', undefined, 0);
  }
  
  const actualRank = DEGREE_RANK[actual!] ?? 0;
  const requiredRank = DEGREE_RANK[String(required).toLowerCase()] ?? 0;
  
  let eligible = false;
  if (operator === 'gte') eligible = actualRank >= requiredRank;
  else if (operator === 'eq') eligible = actualRank === requiredRank;
  else eligible = actual === required;
  
  return makeDecision(
    reqId,
    reqDesc,
    candidateField,
    eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    eligible ? 'Degree satisfies requirement' : `Degree rank ${actualRank} does not meet ${operator} ${requiredRank}`,
    { candidate: actual, required, operator },
    1
  );
}

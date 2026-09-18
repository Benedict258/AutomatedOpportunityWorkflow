import { EligibilityResult, EligibilityContext } from './types';

export interface IEligibilityEngine {
  evaluate(context: EligibilityContext): EligibilityResult;
  evaluateRequirement(requirementId: string, context: EligibilityContext): Promise<EligibilityResult['decisions'][number]>;
}

export interface IEligibilityRule {
  type: string;
  evaluate(candidate: EligibilityContext['candidate'], requirement: EligibilityContext['opportunity']['requirements'][number], context: EligibilityContext): EligibilityResult['decisions'][number];
}

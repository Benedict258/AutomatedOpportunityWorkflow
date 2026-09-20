import { EligibilityContext, EligibilityResult, EligibilityState, EligibilityDecision } from './types';
import { IEligibilityEngine } from './eligibility-engine.interface';
import * as Rules from './rules';

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function makeDecision(params: {
  requirementId: string;
  requirement: string;
  candidateField: string;
  state: EligibilityState;
  reason: string;
  evidence?: unknown;
  confidence: number;
  missing?: boolean;
}): EligibilityDecision {
  return { ...params, missing: params.missing ?? false };
}

export class EligibilityEngine implements IEligibilityEngine {
  private ruleMap: Record<string, (candidate: EligibilityContext['candidate'], requirement: any, ctx: EligibilityContext) => EligibilityDecision>;

  constructor() {
    this.ruleMap = {
      education: Rules.educationRule,
      degree: Rules.degreeRule,
      field: Rules.fieldRule,
      academic_level: Rules.academicLevelRule,
      graduation_timing: Rules.graduationTimingRule,
      citizenship: Rules.citizenshipRule,
      work_authorization: Rules.workAuthorizationRule,
      location: Rules.locationRule,
      remote_eligibility: Rules.remoteEligibilityRule,
      experience: Rules.experienceRule,
      certifications: Rules.certificationsRule,
      security_clearance: Rules.securityClearanceRule,
      deadline: Rules.deadlineRule,
    };
  }

  evaluate(context: EligibilityContext): EligibilityResult {
    const { candidate, opportunity } = context;
    const decisions: EligibilityDecision[] = [];

    for (const req of opportunity.requirements) {
      const handler = this.ruleMap[req.type];
      if (!handler) {
        decisions.push(makeDecision({
          requirementId: req.id,
          requirement: req.description ?? req.type,
          candidateField: '',
          state: 'UNCERTAIN',
          reason: `No rule handler for requirement type ${req.type}`,
          confidence: 0,
        }));
        continue;
      }
      const decision = handler(candidate, req, context);
      decisions.push(decision);
    }

    // deadline is not a requirement but opportunity level
    if (opportunity.deadline) {
      const deadlineDecision = Rules.deadlineRule(candidate, { id: 'deadline', type: 'deadline', value: opportunity.deadline }, context);
      decisions.push(deadlineDecision);
    }

    const eligibleCount = decisions.filter(d => d.state === 'ELIGIBLE').length;
    const uncertainCount = decisions.filter(d => d.state === 'UNCERTAIN').length;
    const ineligibleCount = decisions.filter(d => d.state === 'INELIGIBLE').length;

    let overall: EligibilityState = 'ELIGIBLE';
    if (ineligibleCount > 0) overall = 'INELIGIBLE';
    else if (uncertainCount > 0) overall = 'UNCERTAIN';
    else if (eligibleCount > 0) overall = 'ELIGIBLE';
    else overall = 'UNCERTAIN';

    return {
      opportunityId: opportunity.id,
      candidateId: candidate.id,
      overall,
      decisions,
      summary: {
        eligibleCount,
        uncertainCount,
        ineligibleCount,
        totalRequirements: decisions.length,
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  async evaluateRequirement(requirementId: string, context: EligibilityContext): Promise<EligibilityResult['decisions'][number]> {
    const req = context.opportunity.requirements.find(r => r.id === requirementId);
    if (!req) throw new Error(`Requirement ${requirementId} not found`);
    const handler = this.ruleMap[req.type];
    if (!handler) throw new Error(`No handler for ${req.type}`);
    return handler(context.candidate, req, context);
  }

  assess(opportunity: any, candidate: any): EligibilityResult {
    const context: EligibilityContext = {
      candidate: {
        id: candidate?.id || 'unknown',
        education: candidate?.education || [],
        experience: candidate?.experience || [],
        certifications: candidate?.certifications || [],
        location: candidate?.location || '',
        citizenship: candidate?.citizenship || '',
        workAuthorization: candidate?.workAuthorization || '',
        securityClearance: candidate?.securityClearance || '',
      },
      opportunity: {
        id: opportunity?.id || 'unknown',
        requirements: opportunity?.requirements || [],
        deadline: opportunity?.deadline,
        location: opportunity?.location || '',
        remoteAllowed: opportunity?.remoteAllowed || false,
      },
    };
    return this.evaluate(context);
  }
}

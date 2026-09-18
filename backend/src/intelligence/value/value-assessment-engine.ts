import {
  OpportunityValueAssessment,
  OpportunityValueProfile,
  CandidateProfile,
  ValueFactors,
  EvidencedScore,
  EvidenceItem,
  UncertaintyLevel,
  ValueAssessmentOptions,
} from './types';

type FactorKey = keyof ValueFactors;

const DEFAULT_WEIGHTS: Record<FactorKey, number> = {
  careerRelevance: 0.15,
  experienceBuildingValue: 0.15,
  skillDevelopment: 0.12,
  credentialValue: 0.08,
  networkingPotential: 0.08,
  organizationRelevance: 0.08,
  compensation: 0.10,
  accessibility: 0.07,
  deadlineUrgency: 0.05,
  effortApplicationComplexity: 0.12,
};

function normalize01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function uncertaintyFromConfidence(confidence: number): UncertaintyLevel {
  if (confidence >= 0.8) return 'low';
  if (confidence >= 0.5) return 'medium';
  return 'high';
}

function rangeFromScore(value: number, confidence: number): [number, number] {
  const spread = (1 - confidence) * 0.4;
  const min = normalize01(value - spread);
  const max = normalize01(value + spread);
  return [min, max];
}

function makeScore(value: number, confidence: number, evidence: EvidenceItem[], rationale: string): EvidencedScore {
  const v = normalize01(value);
  const c = normalize01(confidence);
  return {
    value: v,
    confidence: c,
    uncertainty: uncertaintyFromConfidence(c),
    range: rangeFromScore(v, c),
    evidence,
    rationale,
  };
}

function evidence(source: string, field: string, snippet: string, weight = 0.5): EvidenceItem {
  return { source, field, snippet: snippet.slice(0, 500), weight };
}

export class ValueAssessmentEngine {
  private weights: Record<FactorKey, number>;

  constructor(options?: { weights?: Partial<Record<FactorKey, number>> }) {
    this.weights = { ...DEFAULT_WEIGHTS, ...(options?.weights || {}) };
    // normalize weights sum to 1
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(this.weights) as FactorKey[]) {
      this.weights[k] = this.weights[k] / sum;
    }
  }

  async assess(
    opportunity: OpportunityValueProfile,
    candidate?: CandidateProfile,
    options?: ValueAssessmentOptions
  ): Promise<OpportunityValueAssessment> {
    const weightingProfile = { ...this.weights, ...(options?.weightingProfile || {}) };
    const sumW = Object.values(weightingProfile).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(weightingProfile) as FactorKey[]) {
      weightingProfile[k] = weightingProfile[k] / sumW;
    }

    const factors: ValueFactors = {
      careerRelevance: this.assessCareerRelevance(opportunity, candidate),
      experienceBuildingValue: this.assessExperienceBuilding(opportunity, candidate),
      skillDevelopment: this.assessSkillDevelopment(opportunity, candidate),
      credentialValue: this.assessCredentialValue(opportunity),
      networkingPotential: this.assessNetworkingPotential(opportunity),
      organizationRelevance: this.assessOrganizationRelevance(opportunity, candidate),
      compensation: this.assessCompensation(opportunity, candidate),
      accessibility: this.assessAccessibility(opportunity, candidate),
      deadlineUrgency: this.assessDeadlineUrgency(opportunity),
      effortApplicationComplexity: this.assessEffortComplexity(opportunity),
    };

    const composite = this.computeComposite(factors, weightingProfile);

    const evidenceSummary = Object.values(factors).flatMap(f => f.evidence);

    return {
      opportunityId: opportunity.id,
      candidateId: undefined,
      assessedAt: new Date().toISOString(),
      factors,
      composite,
      weightingProfile,
      evidenceSummary,
      notes: this.generateNotes(factors),
    };
  }

  private assessCareerRelevance(opportunity: OpportunityValueProfile, candidate?: CandidateProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.5;
    let confidence = 0.5;

    if (candidate?.targetRoles?.length && opportunity.title) {
      const match = candidate.targetRoles.some(r =>
        opportunity.title!.toLowerCase().includes(r.toLowerCase())
      );
      evidenceList.push(evidence('opportunity.title', 'title', opportunity.title!, match ? 0.9 : 0.3));
      score = match ? 0.8 : 0.4;
      confidence = 0.7;
    }

    if (candidate?.targetIndustries?.length && opportunity.industry) {
      const match = candidate.targetIndustries.some(i =>
        opportunity.industry!.toLowerCase().includes(i.toLowerCase())
      );
      evidenceList.push(evidence('opportunity.industry', 'industry', opportunity.industry!, match ? 0.9 : 0.3));
      score = (score + (match ? 0.8 : 0.3)) / 2;
      confidence = Math.min(0.85, confidence + 0.1);
    }

    if (!candidate) {
      confidence = 0.4;
      score = 0.5;
    }

    return makeScore(score, confidence, evidenceList, 'Career relevance inferred from role and industry alignment with candidate targets.');
  }

  private assessExperienceBuilding(opportunity: OpportunityValueProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.5;
    let confidence = 0.6;

    const desc = (opportunity.description || '').toLowerCase();
    const signals = ['project', 'lead', 'manage', 'build', 'deliver', 'ownership', 'end-to-end'];
    const hits = signals.filter(s => desc.includes(s)).length;
    score = normalize01(0.4 + hits * 0.08);
    evidenceList.push(evidence('opportunity.description', 'description', opportunity.description || '', 0.6));

    if (opportunity.duration?.hoursPerWeek) {
      const hrs = opportunity.duration.hoursPerWeek;
      const hrsScore = hrs >= 20 ? 0.8 : hrs >= 10 ? 0.6 : 0.4;
      score = (score + hrsScore) / 2;
      evidenceList.push(evidence('opportunity.duration', 'hoursPerWeek', String(hrs), 0.7));
      confidence = 0.75;
    }

    return makeScore(score, confidence, evidenceList, 'Experience building estimated from responsibility signals and time commitment.');
  }

  private assessSkillDevelopment(opportunity: OpportunityValueProfile, candidate?: CandidateProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.5;
    let confidence = 0.6;

    const oppSkills = (opportunity.skills || []).map(s => s.toLowerCase());
    if (oppSkills.length) {
      evidenceList.push(evidence('opportunity.skills', 'skills', oppSkills.join(', '), 0.8));
      score = Math.min(0.9, 0.4 + oppSkills.length * 0.05);
      confidence = 0.7;
    }

    if (candidate?.skills?.length) {
      const overlap = candidate.skills.filter(s => oppSkills.includes(s.toLowerCase())).length;
      const novelty = oppSkills.filter(s => !candidate.skills!.map(x => x.toLowerCase()).includes(s)).length;
      const devScore = normalize01(0.3 + novelty * 0.07 - overlap * 0.02);
      score = (score + devScore) / 2;
      confidence = 0.75;
      evidenceList.push(evidence('candidate.skills', 'skills', candidate.skills.join(', '), 0.6));
    }

    return makeScore(score, confidence, evidenceList, 'Skill development based on required skills and novelty relative to candidate.');
  }

  private assessCredentialValue(opportunity: OpportunityValueProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.4;
    let confidence = 0.5;

    const desc = (opportunity.description || '').toLowerCase();
    const benefits = (opportunity.benefits || []).map(b => b.toLowerCase()).join(' ');
    const signals = ['certificate', 'credential', 'certification', 'diploma', 'accredited', 'official'];
    const hits = signals.some(s => desc.includes(s) || benefits.includes(s)) ? 1 : 0;
    score = 0.3 + hits * 0.5;
    evidenceList.push(evidence('opportunity.benefits', 'benefits', opportunity.benefits?.join('; ') || '', 0.6));

    if (opportunity.organization?.reputation) {
      score = Math.min(1, score + 0.2);
      evidenceList.push(evidence('opportunity.organization', 'reputation', opportunity.organization.reputation, 0.7));
      confidence = 0.65;
    }

    return makeScore(score, confidence, evidenceList, 'Credential value from explicit certification signals and organizational reputation.');
  }

  private assessNetworkingPotential(opportunity: OpportunityValueProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.5;
    let confidence = 0.55;

    const desc = (opportunity.description || '').toLowerCase();
    const signals = ['network', 'mentor', 'community', 'conference', 'industry leaders', 'partnership'];
    const hits = signals.filter(s => desc.includes(s)).length;
    score = normalize01(0.3 + hits * 0.12);
    evidenceList.push(evidence('opportunity.description', 'description', opportunity.description || '', 0.5));

    if (opportunity.organization?.size) {
      const sizeScore = /large|enterprise|global/i.test(opportunity.organization.size) ? 0.2 : 0;
      score = normalize01(score + sizeScore);
      evidenceList.push(evidence('opportunity.organization', 'size', opportunity.organization.size, 0.6));
      confidence = 0.65;
    }

    return makeScore(score, confidence, evidenceList, 'Networking potential inferred from community signals and org size.');
  }

  private assessOrganizationRelevance(opportunity: OpportunityValueProfile, candidate?: CandidateProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.5;
    let confidence = 0.5;

    if (opportunity.organization?.name) {
      evidenceList.push(evidence('opportunity.organization', 'name', opportunity.organization.name, 0.7));
      score = 0.6;
      confidence = 0.6;
    }

    if (candidate?.targetIndustries?.length && opportunity.industry) {
      const match = candidate.targetIndustries.some(i => opportunity.industry!.toLowerCase().includes(i.toLowerCase()));
      score = match ? 0.8 : 0.4;
      confidence = 0.7;
    }

    return makeScore(score, confidence, evidenceList, 'Organization relevance from industry alignment and known entity.');
  }

  private assessCompensation(opportunity: OpportunityValueProfile, candidate?: CandidateProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.4;
    let confidence = 0.6;

    const comp = opportunity.compensation;
    if (!comp) {
      return makeScore(0.2, 0.3, evidenceList, 'Compensation unknown.');
    }

    evidenceList.push(evidence('opportunity.compensation', 'type', comp.type || 'unknown', 0.8));

    if (comp.type === 'salary' || comp.type === 'stipend') {
      score = comp.amount ? normalize01(Math.min(1, Math.log10(comp.amount + 1) / 5)) : 0.6;
      confidence = 0.8;
    } else if (comp.type === 'volunteer') {
      score = 0.2;
      confidence = 0.9;
    } else {
      score = 0.3;
      confidence = 0.5;
    }

    if (candidate?.compensationPreference?.min && comp.amount) {
      const meets = comp.amount >= candidate.compensationPreference.min;
      score = meets ? normalize01(score + 0.2) : normalize01(score - 0.2);
      confidence = Math.min(0.9, confidence + 0.05);
    }

    return makeScore(score, confidence, evidenceList, 'Compensation scored from type and amount relative to candidate preference.');
  }

  private assessAccessibility(opportunity: OpportunityValueProfile, candidate?: CandidateProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.6;
    let confidence = 0.6;

    if (opportunity.remote) {
      score = 0.8;
      evidenceList.push(evidence('opportunity', 'remote', 'true', 0.9));
    } else if (opportunity.location) {
      evidenceList.push(evidence('opportunity', 'location', opportunity.location, 0.7));
      if (candidate?.locationPreference?.length) {
        const match = candidate.locationPreference.some(p => opportunity.location!.toLowerCase().includes(p.toLowerCase()));
        score = match ? 0.7 : 0.4;
      }
    }

    const app = opportunity.application;
    if (app?.steps) {
      const stepsScore = app.steps <= 2 ? 0.8 : app.steps <= 4 ? 0.5 : 0.3;
      score = (score + stepsScore) / 2;
      evidenceList.push(evidence('opportunity.application', 'steps', String(app.steps), 0.7));
      confidence = 0.7;
    }

    if (app?.materials?.length) {
      const matScore = app.materials.length <= 2 ? 0.8 : app.materials.length <= 4 ? 0.5 : 0.3;
      score = (score + matScore) / 2;
      confidence = 0.7;
    }

    return makeScore(score, confidence, evidenceList, 'Accessibility from remote/location fit and application friction.');
  }

  private assessDeadlineUrgency(opportunity: OpportunityValueProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    const deadline = opportunity.application?.deadline;
    let score = 0.5;
    let confidence = 0.7;

    if (!deadline) {
      return makeScore(0.3, 0.4, evidenceList, 'No deadline provided.');
    }

    evidenceList.push(evidence('opportunity.application', 'deadline', deadline, 0.9));
    const days = this.daysUntil(deadline);
    if (days < 0) {
      score = 0.1;
      confidence = 0.9;
    } else if (days <= 3) {
      score = 0.9;
    } else if (days <= 7) {
      score = 0.7;
    } else if (days <= 14) {
      score = 0.5;
    } else {
      score = 0.2;
    }

    return makeScore(score, confidence, evidenceList, `Deadline urgency based on ${days} days remaining.`);
  }

  private assessEffortComplexity(opportunity: OpportunityValueProfile): EvidencedScore {
    const evidenceList: EvidenceItem[] = [];
    let score = 0.5;
    let confidence = 0.6;

    const app = opportunity.application;
    const steps = app?.steps ?? 1;
    const materials = app?.materials?.length ?? 1;
    const reqCount = opportunity.requirements?.length ?? 0;

    const stepsScore = normalize01(1 - Math.min(1, steps / 8));
    const materialsScore = normalize01(1 - Math.min(1, materials / 6));
    const reqScore = normalize01(1 - Math.min(1, reqCount / 20));

    score = (stepsScore + materialsScore + reqScore) / 3;
    evidenceList.push(evidence('opportunity.application', 'steps', String(steps), 0.7));
    evidenceList.push(evidence('opportunity.requirements', 'count', String(reqCount), 0.6));

    // Invert for complexity: higher score = easier/less effort
    const easeScore = score;
    return makeScore(easeScore, confidence, evidenceList, 'Effort complexity derived from steps, materials, and requirement count.');
  }

  private computeComposite(factors: ValueFactors, weights: Record<FactorKey, number>) {
    let weightedSum = 0;
    let confidenceSum = 0;
    const confidences: number[] = [];

    for (const key of Object.keys(factors) as FactorKey[]) {
      const f = factors[key];
      const w = weights[key] ?? 0;
      weightedSum += f.value * w;
      confidenceSum += f.confidence * w;
      confidences.push(f.confidence);
    }

    const overallConfidence = confidenceSum;
    const overallUncertainty = uncertaintyFromConfidence(overallConfidence);
    const range = rangeFromScore(weightedSum, overallConfidence);

    return {
      valueScore: normalize01(weightedSum),
      confidence: normalize01(overallConfidence),
      uncertainty: overallUncertainty,
      range,
    };
  }

  private generateNotes(factors: ValueFactors): string[] {
    const notes: string[] = [];
    for (const [k, f] of Object.entries(factors) as [FactorKey, EvidencedScore][]) {
      if (f.uncertainty === 'high') {
        notes.push(`${k} has high uncertainty due to limited evidence.`);
      }
      if (f.value < 0.3) {
        notes.push(`${k} is weak.`);
      }
    }
    return notes;
  }

  private daysUntil(dateStr?: string): number {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return Infinity;
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

export default ValueAssessmentEngine;

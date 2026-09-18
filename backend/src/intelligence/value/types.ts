export type UncertaintyLevel = 'low' | 'medium' | 'high';

export interface EvidenceItem {
  source: string;
  field: string;
  snippet: string;
  weight: number; // 0-1
}

export interface EvidencedScore {
  value: number; // normalized 0-1
  confidence: number; // 0-1
  uncertainty: UncertaintyLevel;
  range: [number, number]; // [min, max] plausible bounds
  evidence: EvidenceItem[];
  rationale: string;
}

export interface OpportunityValueProfile {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  industry?: string;
  organization?: {
    name?: string;
    size?: string;
    reputation?: string;
  };
  compensation?: {
    amount?: number;
    currency?: string;
    type?: 'stipend' | 'salary' | 'volunteer' | 'unpaid' | 'unknown';
  };
  requirements?: string[];
  skills?: string[];
  duration?: {
    startDate?: string;
    endDate?: string;
    hoursPerWeek?: number;
  };
  application?: {
    deadline?: string;
    steps?: number;
    materials?: string[];
    openTo?: string[];
  };
  benefits?: string[];
  location?: string;
  remote?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CandidateProfile {
  targetRoles?: string[];
  targetIndustries?: string[];
  skills?: string[];
  experienceYears?: number;
  education?: string[];
  careerStage?: string;
  locationPreference?: string[];
  remotePreference?: boolean;
  availabilityHoursPerWeek?: number;
  compensationPreference?: {
    min?: number;
    type?: string[];
  };
}

export interface ValueFactors {
  careerRelevance: EvidencedScore;
  experienceBuildingValue: EvidencedScore;
  skillDevelopment: EvidencedScore;
  credentialValue: EvidencedScore;
  networkingPotential: EvidencedScore;
  organizationRelevance: EvidencedScore;
  compensation: EvidencedScore;
  accessibility: EvidencedScore;
  deadlineUrgency: EvidencedScore;
  effortApplicationComplexity: EvidencedScore;
}

export interface OpportunityValueAssessment {
  opportunityId: string;
  candidateId?: string;
  assessedAt: string;
  factors: ValueFactors;
  composite: {
    valueScore: number; // weighted aggregate 0-1
    confidence: number;
    uncertainty: UncertaintyLevel;
    range: [number, number];
  };
  weightingProfile: Record<keyof ValueFactors, number>;
  evidenceSummary: EvidenceItem[];
  notes?: string[];
}

export interface ValueAssessmentOptions {
  weightingProfile?: Partial<Record<keyof ValueFactors, number>>;
  candidateProfile?: CandidateProfile;
  strictMode?: boolean;
}

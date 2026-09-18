export type EligibilityState = 'ELIGIBLE' | 'UNCERTAIN' | 'INELIGIBLE';

export interface EligibilityDecision {
  requirementId: string;
  requirement: string;
  candidateField: string;
  state: EligibilityState;
  reason: string;
  evidence?: unknown;
  confidence: number; // 0-1
  missing?: boolean;
}

export interface EligibilityResult {
  opportunityId: string;
  candidateId: string;
  overall: EligibilityState;
  decisions: EligibilityDecision[];
  summary: {
    eligibleCount: number;
    uncertainCount: number;
    ineligibleCount: number;
    totalRequirements: number;
  };
  evaluatedAt: string;
}

export interface CandidateProfile {
  id: string;
  education?: {
    highestDegree?: string;
    fieldOfStudy?: string[];
    academicLevel?: string;
    graduationDate?: string | null;
    gpa?: number | null;
    institution?: string;
  };
  citizenship?: string[];
  workAuthorization?: {
    country?: string;
    type?: string; // e.g., 'citizen', 'permanent_resident', 'visa'
    expiresAt?: string | null;
  };
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
    willingToRelocate?: boolean;
  };
  remoteEligibility?: boolean | null;
  experience?: {
    years?: number | null;
    yearsInField?: number | null;
    relevantRoles?: string[];
  };
  certifications?: string[];
  securityClearance?: string | null;
  availability?: {
    earliestStartDate?: string | null;
  };
}

export interface OpportunityRequirement {
  id: string;
  type: RequirementType;
  value?: unknown;
  operator?: 'eq' | 'in' | 'gte' | 'lte' | 'contains' | 'matches';
  required?: boolean;
  description?: string;
}

export type RequirementType =
  | 'education'
  | 'degree'
  | 'field'
  | 'academic_level'
  | 'graduation_timing'
  | 'citizenship'
  | 'work_authorization'
  | 'location'
  | 'remote_eligibility'
  | 'experience'
  | 'certifications'
  | 'security_clearance'
  | 'deadline';

export interface EligibilityContext {
  candidate: CandidateProfile;
  opportunity: {
    id: string;
    requirements: OpportunityRequirement[];
    deadline?: string | null;
    location?: string | null;
    remoteAllowed?: boolean | null;
  };
}

import type { CandidateProfile, Experience as CanonicalExperience, Education as CanonicalEducation, Project as CanonicalProject } from '@shared/domain/candidate';

/**
 * Derived intelligence types - separate from canonical CandidateProfile.
 * Canonical data lives in shared/src/domain/candidate.ts and is never overwritten.
 * Derived data is computed with provenance.
 */

export interface Provenance {
  derivedFrom: {
    candidateProfileId: string;
    version?: string;
  };
  derivedAt: string; // ISO timestamp
  derivedBy: 'candidate-intelligence-builder';
  sources: string[]; // e.g., ['candidateProfile.education[0]', 'candidateProfile.skills']
  confidence?: number; // 0-1
}

export interface CandidateSkill {
  id: string;
  name: string;
  category: 'TECHNICAL' | 'SOFT' | 'DOMAIN' | 'LANGUAGE' | 'TOOL';
  proficiency?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  evidence: string[]; // references to source fields
  confidence: number;
  provenance: Pick<Provenance, 'sources' | 'derivedAt'>;
}

export interface CandidateExperience extends CanonicalExperience {
  id: string;
  durationMonths?: number;
  skillsInferred?: string[];
  technologiesInferred?: string[];
  domain?: string;
  seniority?: string;
  isDerived: true;
  provenance: Provenance;
}

export interface DerivedCandidateProfile {
  candidateProfileId: string;
  
  // Derived from canonical fields
  careerGoals: string[];
  technicalSkills: CandidateSkill[];
  softSkills: CandidateSkill[];
  
  technologies: string[];
  domains: string[];
  interests: {
    government: string[];
    policy: string[];
    internationalAffairs: string[];
    other: string[];
  };
  
  experience: CandidateExperience[];
  education: CanonicalEducation[];
  certifications: string[];
  projects: CanonicalProject[];
  
  preferredOpportunityTypes: string[];
  locationPreferences: string[];
  remotePreference?: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE';
  professionalDevelopmentGoals: string[];
  
  // Metadata
  provenance: Provenance;
  derivationVersion: string;
}

export interface CandidateIntelligence {
  candidateId: string;
  candidateProfileId: string;
  
  derivedProfile: DerivedCandidateProfile;
  
  // Additional derived insights
  skillGaps?: string[];
  careerTrajectory?: {
    currentLevel?: string;
    nextLikelyRoles?: string[];
    yearsExperience?: number;
  };
  fitIndicators?: {
    sectorAlignment: number;
    skillAlignment: number;
    locationAlignment: number;
  };
  
  // Provenance & audit
  provenance: Provenance;
  lastUpdated: string;
  status: 'DRAFT' | 'VALIDATED' | 'STALE';
}

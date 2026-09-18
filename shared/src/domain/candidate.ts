import { BaseEntity, EntityId } from '../types';

export interface Education {
  institution?: string;
  degree?: string;
  field?: string;
  startYear?: number;
  endYear?: number;
}

export interface Experience {
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface Project {
  name?: string;
  description?: string;
  url?: string;
  technologies?: string[];
}

export interface CandidateProfile extends BaseEntity {
  userId: EntityId;
  education?: Education[];
  skills?: string[];
  experience?: Experience[];
  projects?: Project[];
  certifications?: EntityId[];
  careerTargets?: string[];
  sectors?: string[];
  preferredLocations?: string[];
  remotePreference?: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE';
  workAuthorization?: string;
  eligibilityInfo?: Record<string, unknown>;
  opportunityPreferences?: Record<string, unknown>;
  professionalDevelopmentPreferences?: Record<string, unknown>;
  governmentInterests?: string[];
  policyInterests?: string[];
  internationalAffairsInterests?: string[];
}

import type { CandidateProfile } from '@shared/domain/candidate';
import type { CandidateIntelligence, DerivedCandidateProfile, Provenance } from './types';
import { deriveProfile } from './profile-derivation';

export interface BuildCandidateIntelligenceOptions {
  candidateId: string;
  candidateProfile: CandidateProfile;
  derivationVersion?: string;
}

/**
 * Builds derived CandidateIntelligence from canonical CandidateProfile.
 * Never mutates or overwrites canonical CandidateProfile.
 * All derived fields include provenance linking back to source.
 */
export function buildCandidateIntelligence({
  candidateId,
  candidateProfile,
  derivationVersion = '1.0.0',
}: BuildCandidateIntelligenceOptions): CandidateIntelligence {
  const derivedAt = new Date().toISOString();
  
  const provenance: Provenance = {
    derivedFrom: {
      candidateProfileId: candidateProfile.id,
      version: candidateProfile.version?.toString(),
    },
    derivedAt,
    derivedBy: 'candidate-intelligence-builder',
    sources: [
      'candidateProfile.education',
      'candidateProfile.skills',
      'candidateProfile.experience',
      'candidateProfile.projects',
      'candidateProfile.certifications',
      'candidateProfile.careerTargets',
      'candidateProfile.sectors',
      'candidateProfile.preferredLocations',
      'candidateProfile.remotePreference',
      'candidateProfile.opportunityPreferences',
      'candidateProfile.professionalDevelopmentPreferences',
      'candidateProfile.governmentInterests',
      'candidateProfile.policyInterests',
      'candidateProfile.internationalAffairsInterests',
    ],
  };

  const derivedProfile: DerivedCandidateProfile = deriveProfile(candidateProfile, {
    provenance,
    derivationVersion,
  });

  // Compute high-level insights
  const yearsExperience = estimateYearsExperience(candidateProfile.experience ?? []);
  
  const intelligence: CandidateIntelligence = {
    candidateId,
    candidateProfileId: candidateProfile.id,
    derivedProfile,
    careerTrajectory: {
      currentLevel: inferCurrentLevel(derivedProfile.experience),
      nextLikelyRoles: inferNextRoles(derivedProfile.careerGoals, derivedProfile.domains),
      yearsExperience,
    },
    fitIndicators: {
      sectorAlignment: computeSectorAlignment(derivedProfile.domains),
      skillAlignment: computeSkillAlignment(derivedProfile.technicalSkills),
      locationAlignment: 0.5, // placeholder - requires opportunity context
    },
    provenance,
    lastUpdated: derivedAt,
    status: 'DRAFT',
  };

  return intelligence;
}

/**
 * Helper: estimate total years of experience from canonical experience entries
 */
function estimateYearsExperience(experiences: CandidateProfile['experience']): number {
  if (!experiences?.length) return 0;
  
  let totalMonths = 0;
  for (const exp of experiences) {
    if (exp.startDate && exp.endDate) {
      const start = new Date(exp.startDate);
      const end = new Date(exp.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        totalMonths += Math.max(months, 0);
      }
    }
  }
  return Math.round(totalMonths / 12);
}

/**
 * Helper: infer current seniority level from derived experience
 */
function inferCurrentLevel(experiences: import('./types').CandidateExperience[]): string | undefined {
  if (!experiences.length) return undefined;
  const roles = experiences.map(e => (e.role || '').toLowerCase());
  if (roles.some(r => /senior|lead|principal|director|vp|head/.test(r))) return 'SENIOR';
  if (roles.some(r => /mid|intermediate/.test(r))) return 'MID';
  return 'ENTRY';
}

/**
 * Helper: infer next likely roles from goals and domains
 */
function inferNextRoles(goals: string[], domains: string[]): string[] {
  const suggestions = new Set<string>();
  for (const goal of goals) {
    suggestions.add(goal);
  }
  for (const domain of domains) {
    suggestions.add(`${domain} Specialist`);
    suggestions.add(`${domain} Lead`);
  }
  return Array.from(suggestions).slice(0, 5);
}

/**
 * Helper: placeholder alignment scores
 */
function computeSectorAlignment(domains: string[]): number {
  return domains.length > 0 ? Math.min(0.5 + domains.length * 0.05, 1) : 0;
}

function computeSkillAlignment(skills: import('./types').CandidateSkill[]): number {
  if (!skills.length) return 0;
  const avgConfidence = skills.reduce((sum, s) => sum + s.confidence, 0) / skills.length;
  return avgConfidence;
}

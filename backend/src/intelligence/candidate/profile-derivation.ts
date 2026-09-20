import type { CandidateProfile } from 'shared/domain/candidate';
import type { DerivedCandidateProfile, CandidateSkill, CandidateExperience, Provenance } from './types';

export interface DeriveProfileOptions {
  provenance: Provenance;
  derivationVersion: string;
}

/**
 * Derives enriched candidate profile from canonical CandidateProfile.
 * Canonical data is read-only; all outputs are derived with provenance.
 */
export function deriveProfile(
  profile: CandidateProfile,
  options: DeriveProfileOptions
): DerivedCandidateProfile {
  const { provenance, derivationVersion } = options;

  return {
    candidateProfileId: profile.id,
    
    careerGoals: deriveCareerGoals(profile),
    technicalSkills: deriveTechnicalSkills(profile),
    softSkills: deriveSoftSkills(profile),
    
    technologies: deriveTechnologies(profile),
    domains: deriveDomains(profile),
    interests: deriveInterests(profile),
    
    experience: deriveExperience(profile.experience ?? [], provenance),
    education: profile.education ?? [],
    certifications: deriveCertifications(profile),
    projects: profile.projects ?? [],
    
    preferredOpportunityTypes: derivePreferredOpportunityTypes(profile),
    locationPreferences: profile.preferredLocations ?? [],
    remotePreference: profile.remotePreference,
    professionalDevelopmentGoals: deriveProfessionalDevelopmentGoals(profile),
    
    provenance,
    derivationVersion,
  };
}

function deriveCareerGoals(profile: CandidateProfile): string[] {
  const goals = new Set<string>();
  
  // From canonical careerTargets
  (profile.careerTargets ?? []).forEach((g: any) => goals.add(g));
  
  // From opportunity preferences
  if (profile.opportunityPreferences?.careerGoals) {
    const arr = profile.opportunityPreferences.careerGoals;
    if (Array.isArray(arr)) arr.forEach(g => goals.add(String(g)));
  }
  
  // Infer from experience roles
  (profile.experience ?? []).forEach((exp: any) => {
    if (exp.role) goals.add(`Advance in ${exp.role}`);
  });
  
  return Array.from(goals);
}

function deriveTechnicalSkills(profile: CandidateProfile): CandidateSkill[] {
  const skills: CandidateSkill[] = [];
  const seen = new Set<string>();
  
  // From canonical skills list
  (profile.skills ?? []).forEach((skillName: any) => {
    const name = String(skillName).trim();
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    
    skills.push({
      id: `skill-${Math.random().toString(36).slice(2)}`,
      name,
      category: 'TECHNICAL',
      proficiency: undefined,
      evidence: ['candidateProfile.skills'],
      confidence: 0.9,
      provenance: {
        sources: ['candidateProfile.skills'],
        derivedAt: new Date().toISOString(),
      },
    });
  });
  
  // Infer from projects technologies
  (profile.projects ?? []).forEach((proj: any) => {
    (proj.technologies ?? []).forEach((tech: any) => {
      const name = String(tech).trim();
      if (seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      
      skills.push({
        id: `skill-${Math.random().toString(36).slice(2)}`,
        name,
        category: 'TECHNICAL',
        proficiency: undefined,
        evidence: [`candidateProfile.projects.${proj.name ?? 'unknown'}.technologies`],
        confidence: 0.7,
        provenance: {
          sources: ['candidateProfile.projects'],
          derivedAt: new Date().toISOString(),
        },
      });
    });
  });
  
  return skills;
}

function deriveSoftSkills(profile: CandidateProfile): CandidateSkill[] {
  const softSkillKeywords = [
    'leadership', 'communication', 'teamwork', 'problem solving', 'critical thinking',
    'adaptability', 'time management', 'collaboration', 'mentoring', 'presentation',
  ];
  
  const skills: CandidateSkill[] = [];
  const seen = new Set<string>();
  
  const textSources = [
    ...(profile.experience ?? []).map((e: any) => e.description ?? ''),
    ...(profile.projects ?? []).map((p: any) => p.description ?? ''),
  ].join(' ').toLowerCase();
  
  for (const keyword of softSkillKeywords) {
    if (textSources.includes(keyword) && !seen.has(keyword)) {
      seen.add(keyword);
      skills.push({
        id: `soft-${keyword}`,
        name: keyword,
        category: 'SOFT',
        proficiency: undefined,
        evidence: ['candidateProfile.experience.description', 'candidateProfile.projects.description'],
        confidence: 0.6,
        provenance: {
          sources: ['candidateProfile.experience', 'candidateProfile.projects'],
          derivedAt: new Date().toISOString(),
        },
      });
    }
  }
  
  return skills;
}

function deriveTechnologies(profile: CandidateProfile): string[] {
  const techs = new Set<string>();
  
  (profile.projects ?? []).forEach((p: any) => {
    (p.technologies ?? []).forEach((t: any) => techs.add(String(t)));
  });
  
  // Also extract from skills that look technical
  (profile.skills ?? []).forEach((s: any) => {
    const name = String(s);
    // Simple heuristic: if skill contains known tech patterns
    if (/js|ts|python|java|react|node|sql|aws|docker|kubernetes/i.test(name)) {
      techs.add(name);
    }
  });
  
  return Array.from(techs);
}

function deriveDomains(profile: CandidateProfile): string[] {
  const domains = new Set<string>();
  
  (profile.sectors ?? []).forEach((s: any) => domains.add(String(s)));
  
  // Infer from government/policy interests
  if ((profile.governmentInterests ?? []).length) domains.add('Public Sector');
  if ((profile.policyInterests ?? []).length) domains.add('Policy');
  if ((profile.internationalAffairsInterests ?? []).length) domains.add('International Affairs');
  
  // Infer from experience organizations
  (profile.experience ?? []).forEach((exp: any) => {
    if (exp.organization) {
      // Placeholder: could map org to domain via taxonomy
      domains.add(exp.organization);
    }
  });
  
  return Array.from(domains);
}

function deriveInterests(profile: CandidateProfile) {
  return {
    government: profile.governmentInterests ?? [],
    policy: profile.policyInterests ?? [],
    internationalAffairs: profile.internationalAffairsInterests ?? [],
    other: [],
  };
}

function deriveExperience(
  canonicalExperiences: CandidateProfile['experience'],
  provenance: Provenance
): CandidateExperience[] {
  return (canonicalExperiences ?? []).map((exp: any, idx: any) => {
    const durationMonths = estimateDurationMonths(exp.startDate, exp.endDate);
    const skillsInferred = inferSkillsFromDescription(exp.description ?? '');
    const technologiesInferred = inferTechnologiesFromDescription(exp.description ?? '');
    
    return {
      id: `derived-exp-${idx}`,
      ...exp,
      durationMonths,
      skillsInferred,
      technologiesInferred,
      domain: undefined,
      seniority: inferSeniority(exp.role),
      isDerived: true,
      provenance: {
        ...provenance,
        sources: [`candidateProfile.experience[${idx}]`],
      },
    };
  });
}

function deriveCertifications(profile: CandidateProfile): string[] {
  // Canonical certifications are EntityId array; map to readable names if needed
  return (profile.certifications ?? []).map((id: any) => String(id));
}

function derivePreferredOpportunityTypes(profile: CandidateProfile): string[] {
  const types = new Set<string>();
  
  if (profile.opportunityPreferences?.types) {
    const arr = profile.opportunityPreferences.types;
    if (Array.isArray(arr)) arr.forEach(t => types.add(String(t)));
  }
  
  // Infer from remote preference
  if (profile.remotePreference) {
    types.add(profile.remotePreference);
  }
  
  return Array.from(types);
}

function deriveProfessionalDevelopmentGoals(profile: CandidateProfile): string[] {
  const goals: string[] = [];
  
  if (profile.professionalDevelopmentPreferences?.goals) {
    const arr = profile.professionalDevelopmentPreferences.goals;
    if (Array.isArray(arr)) goals.push(...arr.map(String));
  }
  
  // Infer from career targets
  (profile.careerTargets ?? []).forEach((target: any) => {
    goals.push(`Develop skills for ${target}`);
  });
  
  return goals;
}

/* Helpers */

function estimateDurationMonths(start?: string, end?: string): number | undefined {
  if (!start) return undefined;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return undefined;
  return Math.max(0, (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()));
}

function inferSkillsFromDescription(description: string): string[] {
  const keywords = ['lead', 'manage', 'develop', 'design', 'analyze', 'coordinate', 'implement'];
  const found: string[] = [];
  const lower = description.toLowerCase();
  keywords.forEach(k => { if (lower.includes(k)) found.push(k); });
  return found;
}

function inferTechnologiesFromDescription(description: string): string[] {
  const techPattern = /\b(node|react|python|java|sql|aws|docker|kubernetes|typescript|javascript)\b/gi;
  const matches = description.match(techPattern);
  return matches ? Array.from(new Set(matches.map(m => m.toLowerCase()))) : [];
}

function inferSeniority(role?: string): string | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  if (/(senior|sr\.|lead|principal|director|vp|head|chief)/.test(r)) return 'SENIOR';
  if (/(mid|intermediate|ii|iii)/.test(r)) return 'MID';
  if (/(junior|jr\.|entry|associate|intern)/.test(r)) return 'ENTRY';
  return 'UNKNOWN';
}

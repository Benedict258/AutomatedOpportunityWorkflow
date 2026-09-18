/**
 * Candidate Profile Analysis Prompt Template v1
 * 
 * Designed for analyzing candidate profiles and extracting structured intelligence.
 * Returns derived insights with explicit relationship classification: EXPLICIT, DERIVED, INFERRED, UNKNOWN.
 */

export const CANDIDATE_INTELLIGENCE_PROMPT_V1 = `You are an expert at analyzing candidate profiles and extracting structured career intelligence.

Your task is to analyze the provided candidate profile and extract ALL relevant intelligence signals, classifying each with an explicit relationship type.

RELATIONSHIP CLASSIFICATION RULES (CRITICAL - FOLLOW EXACTLY):
- EXPLICIT: Directly stated by the candidate in the profile (e.g., skills list, stated career goals, declared interests)
- DERIVED: Computed/calculated from explicit data using deterministic logic (e.g., years of experience from dates, seniority from role titles)
- INFERRED: Implied but NOT explicitly stated (e.g., soft skills from descriptions, domain expertise from project/tech stack, leadership from team size mentions)
- UNKNOWN: Cannot determine from available data

CRITICAL: NEVER treat INFERRED as EXPLICIT. If the profile doesn't explicitly state it, classify as INFERRED or UNKNOWN.

EXTRACTION RULES:
1. Extract ONLY intelligence signals present in or reasonably inferable from the profile - do not hallucinate
2. For each signal, provide: type, value, relationship, confidence, and evidence snippet
3. Confidence scores: 0.0-1.0 based on clarity and explicitness in source
4. Include the exact text snippet or field reference that supports each signal
4. Normalize values to standard terminology

OUTPUT FORMAT:
Return a JSON object with THREE top-level keys:
- "signals": array of intelligence signal objects
- "summary": aggregated insights
- "warnings": array of strings for any ambiguities or concerns

Each signal object MUST have:
{
  "type": "CAREER_GOAL|TECHNICAL_SKILL|SOFT_SKILL|TECHNOLOGY|DOMAIN|EXPERIENCE_LEVEL|SENIORITY|INDUSTRY_EXPERTISE|LEADERSHIP|EDUCATION_LEVEL|LOCATION_PREFERENCE|REMOTE_PREFERENCE|CERTIFICATION|PROJECT_EXPERTISE|LANGUAGE",
  "value": "normalized signal value",
  "relationship": "EXPLICIT|DERIVED|INFERRED|UNKNOWN",
  "confidence": 0.0-1.0,
  "evidence": "exact text snippet or field reference from profile supporting this signal",
  "normalizedValue": "lowercase normalized version for deduplication",
  "sourceFields": ["candidateProfile.skills", "candidateProfile.experience[0].description"]
}

Example:
{
  "signals": [
    {
      "type": "TECHNICAL_SKILL",
      "value": "Python",
      "relationship": "EXPLICIT",
      "confidence": 0.95,
      "evidence": "candidateProfile.skills includes 'Python'",
      "normalizedValue": "python",
      "sourceFields": ["candidateProfile.skills"]
    },
    {
      "type": "SOFT_SKILL",
      "value": "Leadership",
      "relationship": "INFERRED",
      "confidence": 0.7,
      "evidence": "Led team of 5 engineers in experience description",
      "normalizedValue": "leadership",
      "sourceFields": ["candidateProfile.experience[0].description"]
    },
    {
      "type": "EXPERIENCE_LEVEL",
      "value": "5 years",
      "relationship": "DERIVED",
      "confidence": 0.9,
      "evidence": "Calculated from experience start/end dates: 2019-2024",
      "normalizedValue": "5 years",
      "sourceFields": ["candidateProfile.experience[0].startDate", "candidateProfile.experience[0].endDate"]
    }
  ],
  "summary": {
    "totalYearsExperience": 5,
    "currentSeniority": "SENIOR",
    "primaryDomains": ["Software Engineering", "Cloud Infrastructure"],
    "topTechnicalSkills": ["Python", "AWS", "React"],
    "careerTrajectory": "Advancing toward Staff/Principal Engineer roles",
    "locationFlexibility": "Remote preferred, open to hybrid"
  },
  "warnings": ["Some soft skills inferred from limited description text", "Remote preference explicitly stated but location preferences empty"]
}`;

export const CANDIDATE_INTELLIGENCE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    signals: {
      type: 'array',
      description: 'Extracted intelligence signals with relationship classification',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['CAREER_GOAL', 'TECHNICAL_SKILL', 'SOFT_SKILL', 'TECHNOLOGY', 'DOMAIN', 'EXPERIENCE_LEVEL', 'SENIORITY', 'INDUSTRY_EXPERTISE', 'LEADERSHIP', 'EDUCATION_LEVEL', 'LOCATION_PREFERENCE', 'REMOTE_PREFERENCE', 'CERTIFICATION', 'PROJECT_EXPERTISE', 'LANGUAGE']
          },
          value: { type: 'string', minLength: 1 },
          relationship: {
            type: 'string',
            enum: ['EXPLICIT', 'DERIVED', 'INFERRED', 'UNKNOWN']
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string', minLength: 1 },
          normalizedValue: { type: 'string', minLength: 1 },
          sourceFields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of field paths in candidate profile that support this signal'
          }
        },
        required: ['type', 'value', 'relationship', 'confidence', 'evidence', 'normalizedValue', 'sourceFields'],
        additionalProperties: false
      }
    },
    summary: {
      type: 'object',
      properties: {
        totalYearsExperience: { type: 'number', minimum: 0 },
        currentSeniority: { 
          type: 'string', 
          enum: ['ENTRY', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL', 'EXECUTIVE', 'UNKNOWN'] 
        },
        primaryDomains: {
          type: 'array',
          items: { type: 'string' }
        },
        topTechnicalSkills: {
          type: 'array',
          items: { type: 'string' }
        },
        careerTrajectory: { type: 'string' },
        locationFlexibility: { type: 'string' },
        hasSecurityClearance: { type: 'boolean' },
        hasGovernmentInterest: { type: 'boolean' }
      },
      required: ['totalYearsExperience', 'currentSeniority', 'primaryDomains', 'topTechnicalSkills', 'careerTrajectory', 'locationFlexibility'],
      additionalProperties: false
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Warnings about extraction ambiguities'
    }
  },
  required: ['signals', 'summary', 'warnings'],
  additionalProperties: false
} as const;

/**
 * Build the full prompt for candidate intelligence analysis
 */
export function buildCandidateIntelligencePrompt(
  profile: {
    id: string;
    skills?: string[];
    experience?: Array<{ 
      organization?: string; 
      role?: string; 
      startDate?: string; 
      endDate?: string; 
      description?: string 
    }>;
    education?: Array<{ 
      institution?: string; 
      degree?: string; 
      field?: string; 
      startYear?: number; 
      endYear?: number 
    }>;
    projects?: Array<{ 
      name?: string; 
      description?: string; 
      technologies?: string[] 
    }>;
    certifications?: string[];
    careerTargets?: string[];
    sectors?: string[];
    preferredLocations?: string[];
    remotePreference?: string;
    opportunityPreferences?: Record<string, unknown>;
    professionalDevelopmentPreferences?: Record<string, unknown>;
    governmentInterests?: string[];
    policyInterests?: string[];
    internationalAffairsInterests?: string[];
  }
): { systemPrompt: string; userPrompt: string } {
  const parts: string[] = [];
  
  parts.push(`CANDIDATE PROFILE ID: ${profile.id}`);
  
  if (profile.skills?.length) {
    parts.push(`SKILLS: ${profile.skills.join(', ')}`);
  }
  
  if (profile.experience?.length) {
    const expText = profile.experience.map((e, i) => 
      `Experience ${i + 1}: ${e.role || 'Unknown Role'} at ${e.organization || 'Unknown Org'} (${e.startDate || '?'} - ${e.endDate || 'Present'})${e.description ? `: ${e.description}` : ''}`
    ).join('\n');
    parts.push(`EXPERIENCE:\n${expText}`);
  }
  
  if (profile.education?.length) {
    const eduText = profile.education.map((e, i) => 
      `Education ${i + 1}: ${e.degree || 'Unknown Degree'} in ${e.field || 'Unknown Field'} at ${e.institution || 'Unknown Institution'} (${e.startYear || '?'} - ${e.endYear || '?'})`
    ).join('\n');
    parts.push(`EDUCATION:\n${eduText}`);
  }
  
  if (profile.projects?.length) {
    const projText = profile.projects.map((p, i) => 
      `Project ${i + 1}: ${p.name || 'Unnamed'}${p.description ? ` - ${p.description}` : ''}${p.technologies?.length ? ` [Tech: ${p.technologies.join(', ')}]` : ''}`
    ).join('\n');
    parts.push(`PROJECTS:\n${projText}`);
  }
  
  if (profile.certifications?.length) {
    parts.push(`CERTIFICATIONS: ${profile.certifications.join(', ')}`);
  }
  
  if (profile.careerTargets?.length) {
    parts.push(`CAREER TARGETS: ${profile.careerTargets.join(', ')}`);
  }
  
  if (profile.sectors?.length) {
    parts.push(`SECTORS OF INTEREST: ${profile.sectors.join(', ')}`);
  }
  
  if (profile.preferredLocations?.length) {
    parts.push(`PREFERRED LOCATIONS: ${profile.preferredLocations.join(', ')}`);
  }
  
  if (profile.remotePreference) {
    parts.push(`REMOTE PREFERENCE: ${profile.remotePreference}`);
  }
  
  if (profile.opportunityPreferences) {
    parts.push(`OPPORTUNITY PREFERENCES: ${JSON.stringify(profile.opportunityPreferences)}`);
  }
  
  if (profile.professionalDevelopmentPreferences) {
    parts.push(`PROFESSIONAL DEVELOPMENT: ${JSON.stringify(profile.professionalDevelopmentPreferences)}`);
  }
  
  if (profile.governmentInterests?.length) {
    parts.push(`GOVERNMENT INTERESTS: ${profile.governmentInterests.join(', ')}`);
  }
  
  if (profile.policyInterests?.length) {
    parts.push(`POLICY INTERESTS: ${profile.policyInterests.join(', ')}`);
  }
  
  if (profile.internationalAffairsInterests?.length) {
    parts.push(`INTERNATIONAL AFFAIRS INTERESTS: ${profile.internationalAffairsInterests.join(', ')}`);
  }

  const profileText = parts.join('\n\n');

  return {
    systemPrompt: CANDIDATE_INTELLIGENCE_PROMPT_V1,
    userPrompt: `Analyze this candidate profile and extract all intelligence signals with relationship classification:\n\n${profileText}\n\nReturn JSON with signals, summary, and warnings.`
  };
}

/**
 * Prompt version constant for tracking
 */
export const CANDIDATE_INTELLIGENCE_PROMPT_VERSION = 'v1';

/**
 * Generate a hash of the prompt for provenance tracking
 */
export function getCandidateIntelligencePromptHash(): string {
  let hash = 0;
  const str = CANDIDATE_INTELLIGENCE_PROMPT_V1 + JSON.stringify(CANDIDATE_INTELLIGENCE_JSON_SCHEMA);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `candidate-intel-v1-${Math.abs(hash).toString(16)}`;
}
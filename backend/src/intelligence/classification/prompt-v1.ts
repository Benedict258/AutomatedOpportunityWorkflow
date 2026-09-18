/**
 * Classification Prompt Template v1
 * 
 * Designed for taxonomy classification of opportunities.
 * Uses structured output with taxonomy category IDs.
 */

// Taxonomy categories from taxonomy/opportunities.yaml
const TAXONOMY_CATEGORIES = `
ROOT: opportunity (Root opportunity taxonomy)

TOP-LEVEL CATEGORIES:
- work (WORK): Employment opportunities
  - work.internship (Internship)
  - work.coop (Co-op)
  - work.part_time (Part-time)
  - work.full_time (Full-time)
  - work.contract (Contract)
  - work.apprenticeship (Apprenticeship)

- technical_experience (TECHNICAL EXPERIENCE): Technical skill-building opportunities
  - technical_experience.hackathon (Hackathon)
  - technical_experience.competition (Competition)
  - technical_experience.open_source (Open Source)
  - technical_experience.research (Research)
  - technical_experience.project_program (Project Program)
  - technical_experience.challenge (Challenge)

- cybersecurity (CYBERSECURITY): Cybersecurity-focused opportunities
  - cybersecurity.internship (Internship)
  - cybersecurity.ctf (CTF)
  - cybersecurity.security_program (Security Program)
  - cybersecurity.research (Research)
  - cybersecurity.training (Training)
  - cybersecurity.scholarship (Scholarship)

- government (GOVERNMENT): Government and public sector opportunities
  - government.federal (Federal)
  - government.state (State)
  - government.local (Local)
  - government.public_sector (Public Sector)
  - government.intelligence (Intelligence)
  - government.national_security (National Security)
  - government.government_technology (Government Technology)

- policy (POLICY): Policy and governance opportunities
  - policy.technology_policy (Technology Policy)
  - policy.ai_policy (AI Policy)
  - policy.cyber_policy (Cyber Policy)
  - policy.data_policy (Data Policy)
  - policy.digital_governance (Digital Governance)

- international_affairs (INTERNATIONAL AFFAIRS): International relations opportunities
  - international_affairs.diplomacy (Diplomacy)
  - international_affairs.foreign_policy (Foreign Policy)
  - international_affairs.international_security (International Security)
  - international_affairs.international_development (International Development)
  - international_affairs.global_governance (Global Governance)

- fellowship (FELLOWSHIP): Fellowship programs
  - fellowship.academic (Academic)
  - fellowship.research (Research)
  - fellowship.leadership (Leadership)
  - fellowship.policy (Policy)
  - fellowship.international_affairs (International Affairs)

- education (EDUCATION): Educational opportunities
  - education.certification (Certification)
  - education.course (Course)
  - education.bootcamp (Bootcamp)
  - education.training (Training)
  - education.professional_program (Professional Program)
  - education.scholarship (Scholarship)

- events (EVENTS): Events and gatherings
  - events.conference (Conference)
  - events.meetup (Meetup)
  - events.workshop (Workshop)
  - events.webinar (Webinar)
  - events.career_fair (Career Fair)
  - events.networking (Networking)

- news (NEWS): News and information
  - news.technology (Technology)
  - news.cybersecurity (Cybersecurity)
  - news.government (Government)
  - news.policy (Policy)
  - news.international_affairs (International Affairs)
`;

export const CLASSIFICATION_PROMPT_V1 = `You are an expert taxonomy classifier for professional and educational opportunities.

Your task is to classify the provided opportunity text into the most relevant categories from the taxonomy below.

TAXONOMY:
${TAXONOMY_CATEGORIES}

CLASSIFICATION RULES:
1. Select 1-3 most relevant category IDs from the taxonomy above
2. Prefer specific subcategories over parent categories when applicable
3. Only use category IDs that exist in the taxonomy (e.g., "work.internship", "cybersecurity.ctf")
4. Assign confidence scores (0.0-1.0) based on how well the text matches each category
5. Provide brief reasoning for each classification

OUTPUT FORMAT:
Return a JSON array of objects with the following structure:
[
  {
    "categoryId": "work.internship",
    "confidenceScore": 0.92,
    "reasoning": "Text explicitly mentions 'summer internship program' and 'intern'"
  },
  {
    "categoryId": "technical_experience.hackathon",
    "confidenceScore": 0.85,
    "reasoning": "Describes a weekend hackathon with prizes"
  }
]

IMPORTANT:
- Output ONLY valid JSON array - no extra text, no markdown
- Use exact category IDs from the taxonomy (e.g., "work.internship" not "Internship")
- Confidence must be between 0.0 and 1.0
- Return empty array [] if no categories match
`;

export const CLASSIFICATION_JSON_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      categoryId: {
        type: 'string',
        description: 'Exact taxonomy category ID (e.g., work.internship)'
      },
      confidenceScore: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score 0.0-1.0'
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation for this classification'
      }
    },
    required: ['categoryId', 'confidenceScore', 'reasoning'],
    additionalProperties: false
  },
  minItems: 0,
  maxItems: 3
} as const;

/**
 * Build the full prompt for model classification
 */
export function buildClassificationPrompt(
  opportunity: {
    title: string;
    description?: string;
    organization?: string;
    location?: string;
    tags?: string[];
    rawText?: string;
  }
): { systemPrompt: string; userPrompt: string } {
  const parts: string[] = [];
  
  if (opportunity.title) parts.push(`Title: ${opportunity.title}`);
  if (opportunity.organization) parts.push(`Organization: ${opportunity.organization}`);
  if (opportunity.location) parts.push(`Location: ${opportunity.location}`);
  if (opportunity.tags?.length) parts.push(`Tags: ${opportunity.tags.join(', ')}`);
  if (opportunity.description) parts.push(`Description: ${opportunity.description}`);
  if (opportunity.rawText) parts.push(`Full Text: ${opportunity.rawText}`);

  const textContent = parts.join('\n\n');

  return {
    systemPrompt: CLASSIFICATION_PROMPT_V1,
    userPrompt: `Classify this opportunity:\n\n${textContent}`
  };
}

/**
 * Prompt version constant for tracking
 */
export const PROMPT_VERSION = 'v1';

/**
 * Generate a hash of the prompt for provenance tracking
 */
export function getPromptHash(): string {
  let hash = 0;
  const str = CLASSIFICATION_PROMPT_V1 + JSON.stringify(CLASSIFICATION_JSON_SCHEMA);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `v1-${Math.abs(hash).toString(16)}`;
}
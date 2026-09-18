/**
 * Requirement Extraction Prompt Template v1
 * 
 * Designed for extracting structured requirements from opportunity/job posting documents.
 * Returns requirements with explicit relationship classification: REQUIRED, PREFERRED, OPTIONAL, INFERRED, UNKNOWN.
 */

export const REQUIREMENT_EXTRACTION_PROMPT_V1 = `You are an expert at extracting structured requirements from job postings, internship listings, fellowship opportunities, and similar opportunity documents.

Your task is to extract ALL requirements mentioned in the document and classify each with an explicit relationship type.

RELATIONSHIP CLASSIFICATION RULES (CRITICAL - FOLLOW EXACTLY):
- REQUIRED: Explicitly stated as mandatory, required, must have, essential, prerequisite, minimum requirement
- PREFERRED: Explicitly stated as preferred, nice to have, plus, bonus, advantage, desired, would be a plus
- OPTIONAL: Explicitly stated as optional, not required, if available
- INFERRED: Implied but NOT explicitly stated (e.g., "familiar with", "exposure to", "some experience with", or requirements implied by role/tech stack)
- UNKNOWN: Cannot determine relationship from context

CRITICAL: NEVER treat INFERRED as explicit. If the document doesn't explicitly state the relationship, classify as INFERRED or UNKNOWN.

EXTRACTION RULES:
1. Extract ONLY requirements explicitly present in the document - do not hallucinate
2. For each requirement, provide: type, value, relationship, confidence, and evidence snippet
3. Confidence scores: 0.0-1.0 based on clarity and explicitness in source
4. Include the exact text snippet that supports each requirement
5. Normalize values to standard terminology (e.g., "React.js" -> "React", "ML" -> "Machine Learning")

OUTPUT FORMAT:
Return a JSON object with TWO top-level keys:
- "requirements": array of requirement objects
- "warnings": array of strings for any ambiguities or concerns

Each requirement object MUST have:
{
  "type": "SKILL|TECHNOLOGY|CERTIFICATION|EDUCATION|EXPERIENCE|LOCATION|CITIZENSHIP|WORK_AUTHORIZATION|CLEARANCE|LANGUAGE",
  "value": "normalized requirement value",
  "relationship": "REQUIRED|PREFERRED|OPTIONAL|INFERRED|UNKNOWN",
  "confidence": 0.0-1.0,
  "evidence": "exact text snippet from document supporting this requirement",
  "normalizedValue": "lowercase normalized version for deduplication"
}

Example:
{
  "requirements": [
    {
      "type": "SKILL",
      "value": "Python",
      "relationship": "REQUIRED",
      "confidence": 0.95,
      "evidence": "Must have 3+ years experience with Python",
      "normalizedValue": "python"
    },
    {
      "type": "TECHNOLOGY",
      "value": "React",
      "relationship": "PREFERRED",
      "confidence": 0.85,
      "evidence": "Nice to have experience with React",
      "normalizedValue": "react"
    },
    {
      "type": "EXPERIENCE",
      "value": "3 years software development",
      "relationship": "REQUIRED",
      "confidence": 0.9,
      "evidence": "Minimum 3 years of software development experience required",
      "normalizedValue": "3 years software development"
    }
  ],
  "warnings": ["Some requirements inferred from tech stack mentions"]
}`;

export const REQUIREMENT_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    requirements: {
      type: 'array',
      description: 'Extracted requirements with relationship classification',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['SKILL', 'TECHNOLOGY', 'CERTIFICATION', 'EDUCATION', 'EXPERIENCE', 'LOCATION', 'CITIZENSHIP', 'WORK_AUTHORIZATION', 'CLEARANCE', 'LANGUAGE']
          },
          value: { type: 'string', minLength: 1 },
          relationship: {
            type: 'string',
            enum: ['REQUIRED', 'PREFERRED', 'OPTIONAL', 'INFERRED', 'UNKNOWN']
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string', minLength: 1 },
          normalizedValue: { type: 'string', minLength: 1 }
        },
        required: ['type', 'value', 'relationship', 'confidence', 'evidence', 'normalizedValue'],
        additionalProperties: false
      }
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Warnings about extraction ambiguities'
    }
  },
  required: ['requirements', 'warnings'],
  additionalProperties: false
} as const;

/**
 * Build the full prompt for requirement extraction
 */
export function buildRequirementExtractionPrompt(
  document: { contentType: string; rawData: unknown; rawPreview?: string },
  context: { sourceId: string; documentId: string; extractedFields?: Record<string, unknown> }
): { systemPrompt: string; userPrompt: string } {
  const rawText = typeof document.rawData === 'string' 
    ? document.rawData 
    : JSON.stringify(document.rawData, null, 2);

  const truncatedText = rawText.length > 15000 
    ? rawText.slice(0, 15000) + '\n\n[TRUNCATED - document exceeds 15000 chars]'
    : rawText;

  // Include pre-extracted fields as context if available
  const extractedContext = context.extractedFields 
    ? `\n\nPRE-EXTRACTED FIELDS (for context):\n${JSON.stringify(context.extractedFields, null, 2)}`
    : '';

  return {
    systemPrompt: REQUIREMENT_EXTRACTION_PROMPT_V1,
    userPrompt: `DOCUMENT METADATA:
Source: ${context.sourceId}
Document ID: ${context.documentId}
Content Type: ${document.contentType}
${extractedContext}

DOCUMENT CONTENT:
${truncatedText}

Extract all requirements with explicit relationship classification as JSON.`
  };
}

/**
 * Prompt version constant for tracking
 */
export const REQUIREMENT_PROMPT_VERSION = 'v1';

/**
 * Generate a hash of the prompt for provenance tracking
 */
export function getRequirementPromptHash(): string {
  let hash = 0;
  const str = REQUIREMENT_EXTRACTION_PROMPT_V1 + JSON.stringify(REQUIREMENT_EXTRACTION_JSON_SCHEMA);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `req-v1-${Math.abs(hash).toString(16)}`;
}
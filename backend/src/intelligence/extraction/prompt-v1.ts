/**
 * Extraction Prompt Template v1
 * 
 * Designed for structured extraction from opportunity/job posting documents.
 * Uses JSON schema for structured output validation.
 */

export const EXTRACTION_PROMPT_V1 = `You are an expert at extracting structured information from job postings, internship listings, fellowship opportunities, and similar opportunity documents.

Your task is to extract ALL relevant fields from the provided document and return them as structured JSON matching the exact schema provided.

EXTRACTION RULES:
1. Extract ONLY information explicitly present in the document - do not infer or hallucinate
2. If a field is not mentioned, omit it from the output (do not include null/empty)
3. For dates, normalize to ISO 8601 format (YYYY-MM-DD) when possible
4. For salaries, extract numeric values only (min/max separately), include currency and period
5. For skills, normalize to standard terminology (e.g., "React.js" -> "React", "ML" -> "Machine Learning")
6. For remote status, use only: "remote", "hybrid", "onsite", or "unknown"
5. For opportunity type, classify as: "job", "internship", "fellowship", "contract", "volunteer", "research", "scholarship", or "other"
6. Confidence scores: Assign 0.0-1.0 per field based on clarity and explicitness in source

OUTPUT FORMAT:
Return a JSON object with TWO top-level keys:
- "fields": object with extracted field names as keys, each containing { "value": ..., "confidence": 0.0-1.0 }
- "warnings": array of strings for any ambiguities or concerns

Example:
{
  "fields": {
    "title": { "value": "Software Engineer Intern", "confidence": 0.98 },
    "organization": { "value": "TechCorp Inc", "confidence": 0.95 },
    "salaryMin": { "value": 80000, "confidence": 0.7 },
    "salaryMax": { "value": 120000, "confidence": 0.7 },
    "salaryCurrency": { "value": "USD", "confidence": 0.9 },
    "salaryPeriod": { "value": "yearly", "confidence": 0.85 },
    "requiredSkills": { "value": ["Python", "React", "SQL"], "confidence": 0.9 },
    "remoteStatus": { "value": "hybrid", "confidence": 0.8 }
  },
  "warnings": ["Salary range inferred from 'competitive compensation' mention"]
}`;

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'object',
      description: 'Extracted fields with per-field confidence scores',
      additionalProperties: {
        type: 'object',
        properties: {
          value: {},
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['value', 'confidence']
      }
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Warnings about extraction ambiguities'
    }
  },
  required: ['fields', 'warnings'],
  additionalProperties: false
} as const;

/**
 * Build the full prompt for model extraction
 */
export function buildExtractionPrompt(
  document: { contentType: string; rawData: unknown; rawPreview?: string },
  context: { sourceId: string; documentId: string }
): { systemPrompt: string; userPrompt: string } {
  const rawText = typeof document.rawData === 'string' 
    ? document.rawData 
    : JSON.stringify(document.rawData, null, 2);

  const truncatedText = rawText.length > 15000 
    ? rawText.slice(0, 15000) + '\n\n[TRUNCATED - document exceeds 15000 chars]'
    : rawText;

  return {
    systemPrompt: EXTRACTION_PROMPT_V1,
    userPrompt: `DOCUMENT METADATA:
Source: ${context.sourceId}
Document ID: ${context.documentId}
Content Type: ${document.contentType}

DOCUMENT CONTENT:
${truncatedText}

Extract all relevant opportunity fields as JSON.`
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
  // Simple hash for version tracking
  let hash = 0;
  const str = EXTRACTION_PROMPT_V1 + JSON.stringify(EXTRACTION_JSON_SCHEMA);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `v1-${Math.abs(hash).toString(16)}`;
}
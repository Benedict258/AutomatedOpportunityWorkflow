# Extraction Pipeline Validation Report

**Phase 7 Validation - Agent D: Real Extraction + Normalization Validator**
**Date**: 2026-09-19
**Status**: BLOCKED (NVIDIA_API_KEY not available)
**Overall Assessment**: Pipeline is structurally complete and well-designed, but requires live NVIDIA API key for end-to-end verification.

---

## 1. Extraction Pipeline Architecture

### 1.1 End-to-End Flow
```
RawDocument → ExtractionEngine → ExtractedFields → Normalization → Canonical Opportunity
```

**Key Components:**
- **ExtractionEngine** (`backend/src/intelligence/extraction/extraction-engine.ts`): Main orchestrator
- **UnifiedModelService** (`shared/src/models/unified-service.ts`): Model routing and execution
- **DeterministicExtractor** (`backend/src/discovery/extraction/deterministic-extractor.ts`): Rule-based fallback
- **Prompt Template** (`backend/src/intelligence/extraction/prompt-v1.ts`): Structured extraction prompt
- **Validator** (`backend/src/intelligence/extraction/validator.ts`): Schema and business rule validation
- **RealPipeline** (`backend/src/intelligence/pipeline/real-pipeline.ts`): Normalization step

### 1.2 Extraction Flow Steps
1. **Document Input**: RawDocument with content type and raw data
2. **Model Extraction**: Structured generation via NVIDIA Nemotron-3-Ultra
3. **Confidence Check**: Model result confidence ≥ 0.7 threshold
4. **Validation**: JSON schema and business rule validation
5. **Normalization**: Map extracted fields to canonical opportunity format
6. **Fallback**: Deterministic extraction if model fails or confidence too low

---

## 2. Prompt Template Analysis (v1)

### 2.1 System Prompt
**Location**: `EXTRACTION_PROMPT_V1` in `prompt-v1.ts`

**Key Instructions:**
- Extract ONLY information explicitly present in document (no hallucination)
- Omit missing fields (no null/empty values)
- Normalize dates to ISO 8601 format
- Extract numeric salary values only
- Normalize skills to standard terminology
- Use predefined enums for remote status and opportunity type
- Assign 0.0-1.0 confidence scores per field

### 2.2 Output Format
```json
{
  "fields": {
    "fieldName": { "value": "...", "confidence": 0.0-1.0 }
  },
  "warnings": ["array of strings"]
}
```

### 2.3 Document Formatting
**Raw Document Preparation**:
1. Convert rawData to JSON string if object
2. Truncate to 15,000 characters with `[TRUNCATED]` marker
3. Add document metadata (source, document ID, content type)
4. Append extraction instruction

**Prompt Structure**:
- **System Prompt**: Extraction instructions and rules
- **User Prompt**: Document metadata + content + extraction instruction

---

## 3. JSON Schema Validation

### 3.1 Extraction JSON Schema
**Location**: `EXTRACTION_JSON_SCHEMA` in `prompt-v1.ts`

**Schema Structure**:
```typescript
{
  type: 'object',
  properties: {
    fields: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          value: {},  // Any type
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['value', 'confidence']
      }
    },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['fields', 'warnings'],
  additionalProperties: false
}
```

### 3.2 Field Validation Schema
**Location**: `FIELD_TYPE_SCHEMA` in `validator.ts`

**Validation Rules**:
- **Type Validation**: String, number, array, object checks
- **Enum Validation**: Remote status, opportunity type, salary period
- **Format Validation**: ISO dates, URIs, emails, currency patterns
- **Range Validation**: Salary minimums, experience years (0-50)
- **Cross-Field Validation**: 
  - Salary min ≤ salary max
  - Experience years min ≤ max
  - Date consistency (posted ≤ deadline ≤ start)
  - Remote status vs location consistency

### 3.3 Required Fields
Only `title` and `organization` are required; all other fields are optional.

---

## 4. Normalization Logic

### 4.1 RealPipeline.normalizeExtraction()
**Location**: `backend/src/intelligence/pipeline/real-pipeline.ts:210-229`

**Mapping Logic**:
```typescript
{
  id: rawDocument.externalId || 'temp',
  title: fields.title || 'Unknown',
  organization: fields.organization || 'Unknown',
  description: fields.description || '',
  url: fields.url || '',
  location: fields.location || '',
  remoteStatus: fields.remote || false,
  opportunityType: fields.opportunityType || 'WORK',
  skills: fields.skills || [],
  requirements: fields.requirements || [],
  education: fields.education || [],
  experience: fields.experience || [],
  compensation: fields.compensation || {},
  deadline: fields.deadline || null,
  publicationDate: fields.publicationDate || new Date().toISOString()
}
```

### 4.2 Normalization Issues Identified
1. **Field Name Mismatch**: `fields.remote` vs `remoteStatus` in extraction schema
2. **Missing Fields**: `compensation` not in extraction schema (should be `salaryMin`/`salaryMax`)
3. **Default Values**: `'WORK'` for `opportunityType` not in extraction enums
4. **Array Fields**: `skills`, `requirements`, `education`, `experience` not in extraction schema

### 4.3 Canonical Format Requirements
The normalization step needs alignment with extraction schema:
- `skills` → `requiredSkills`/`preferredSkills`
- `compensation` → `salaryMin`/`salaryMax`/`salaryCurrency`/`salaryPeriod`
- `requirements` → separate requirement extraction step
- `education` → `educationLevel`
- `experience` → `experienceLevel`/`experienceYearsMin`/`experienceYearsMax`

---

## 5. Fallback Behavior

### 5.1 Model Failure Fallback
**Trigger**: Model extraction throws error or returns empty result

**Fallback Flow**:
1. **Low Confidence Fallback**: Model confidence < 0.7 threshold
   - Use deterministic extraction as base
   - Merge with model results (higher confidence wins)
   - Mark fields as `fallbackUsed: true`

2. **Model Error Fallback**: Model extraction throws exception
   - Fall back to deterministic extraction
   - Create failed model result for merging
   - Track fallback event with reason

3. **Complete Failure**: Both model and deterministic fail
   - Return empty result with error codes
   - `primaryExtractor: 'none'`

### 5.2 Deterministic Extractor Capabilities
**Content Types Handled**:
- JSON objects (passthrough with safe pruning)
- HTML (title, meta description, links extraction)
- Text (first 5000 characters)

**Confidence Calculation**:
- Base: 0.85
- Penalty: -0.03 per warning
- Bonus: +0.005 per field (max +0.1)
- Error penalty: -0.1 per error (min 0.0)

### 5.3 Hybrid Extraction
When both model and deterministic results exist:
- **Primary**: Deterministic result (used as base)
- **Model Fields**: Added if higher confidence or missing from deterministic
- **Overall Confidence**: `max(detConf, modelConf * 0.8)` (penalized model)

---

## 6. Provenance Tracking

### 6.1 Field-Level Provenance
```typescript
{
  extractor: 'model' | 'deterministic' | 'hybrid',
  modelId?: string,
  modelVersion?: string,
  promptVersion: 'v1',
  promptHash?: string,
  extractionLatencyMs: number,
  tokenUsage?: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  },
  fallbackUsed: boolean,
  fallbackReason?: string
}
```

### 6.2 Result-Level Provenance
```typescript
{
  primaryExtractor: 'model' | 'deterministic' | 'hybrid' | 'none',
  modelId?: string,
  modelVersion?: string,
  promptVersion: 'v1',
  modelLatencyMs?: number,
  totalLatencyMs: number,
  tokenUsage?: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    estimatedCostUsd?: number
  },
  fallbackChain: FallbackEvent[],
  validationResults: ValidationResult[]
}
```

### 6.3 Fallback Event Tracking
```typescript
{
  fromExtractor: string,
  toExtractor: string,
  reason: string,
  timestamp: string,
  latencyMs: number
}
```

---

## 7. Missing Field Handling

### 7.1 Extraction Level
- **Model**: Omit missing fields (no null/empty)
- **Deterministic**: Missing required fields → error, optional → warning

### 7.2 Validation Level
- **Required Fields**: `title` and `organization` only
- **Missing Optional**: No error, may generate warning
- **Unknown Fields**: Warning for fields not in schema

### 7.3 Normalization Level
- **Defaults**: `'Unknown'` for title/organization, empty strings/arrays
- **Null Handling**: `deadline` and `publicationDate` can be null
- **External ID**: Falls back to `'temp'` if missing

---

## 8. Test Fixtures Analysis

### 8.1 Available Fixtures
**Location**: `tests/discovery/fixtures/`

| Fixture | Source | Content Type | Documents |
|---------|--------|--------------|-----------|
| `usajobs_sample.json` | USAJOBS | JSON | 2 (PositionID, PositionTitle) |
| `greenhouse_sample.json` | GREENHOUSE | JSON | 2 (id, title, department, location, employment_type) |
| `eventbrite_sample.json` | EVENTBRITE | JSON | 2 (id, name, start_date, location, capacity) |

### 8.2 Fixture Characteristics
- **Minimal Fields**: Only basic identifiers and titles
- **No Salary Data**: Missing compensation information
- **No Requirements**: No skills, experience, or education
- **No Dates**: Missing posted dates, deadlines
- **JSON Structure**: Clean JSON objects (no HTML/text)

### 8.3 Fixture Gaps
The fixtures are too minimal for comprehensive extraction testing. Need:
- Complete job postings with full metadata
- Mixed content types (HTML, PDF, text)
- Edge cases (missing fields, malformed data)
- Large documents (>15,000 chars)

---

## 9. NVIDIA Provider Configuration

### 9.1 Provider Setup
**Location**: `shared/src/config/model-loader.ts`

```typescript
{
  id: 'nvidia',
  type: 'openai-compatible',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
  rateLimit: { requestsPerMinute: 60 }
}
```

### 9.2 Model Configuration
| Model | ID | Capabilities | Use Case |
|-------|----|--------------|----------|
| nemotron-3-ultra | `nvidia/nemotron-3-ultra-550b-a55b` | text-generation, structured-generation | Extraction, classification, reasoning |
| nvidia-embed-qa-4 | `nvidia/nv-embedqa-mistral-7b-v2` | embeddings | Vector embeddings |

### 9.3 Current Status
**NVIDIA_API_KEY**: Not set in environment
**Fallback**: Deterministic extraction only
**Live Verification**: BLOCKED

---

## 10. Validation Status

### 10.1 Component Validation

| Component | Status | Evidence |
|-----------|--------|----------|
| **ExtractionEngine.extract()** | ✅ STRUCTURALLY VERIFIED | Main entry point with model + deterministic fallback |
| **Prompt Template v1** | ✅ STRUCTURALLY VERIFIED | `EXTRACTION_PROMPT_V1` with extraction rules |
| **JSON Schema** | ✅ STRUCTURALLY VERIFIED | `EXTRACTION_JSON_SCHEMA` for structured output |
| **Validation Logic** | ✅ STRUCTURALLY VERIFIED | `validateExtraction()` with field + cross-field rules |
| **Normalization** | ⚠️ STRUCTURALLY VERIFIED (Issues Found) | Field name mismatches with extraction schema |
| **Fallback Behavior** | ✅ STRUCTURALLY VERIFIED | Model → deterministic → complete failure chain |
| **Provenance Tracking** | ✅ STRUCTURALLY VERIFIED | Field + result level with fallback events |
| **NVIDIA Provider** | ✅ STRUCTURALLY VERIFIED | OpenAI-compatible adapter with rate limiting |
| **Live Extraction** | ❌ BLOCKED | NVIDIA_API_KEY not available |

### 10.2 Test Fixture Status

| Fixture | Status | Notes |
|---------|--------|-------|
| `usajobs_sample.json` | ✅ STRUCTURALLY VERIFIED | Minimal JSON, 2 documents |
| `greenhouse_sample.json` | ✅ STRUCTURALLY VERIFIED | Minimal JSON, 2 documents |
| `eventbrite_sample.json` | ✅ STRUCTURALLY VERIFIED | Minimal JSON, 2 documents |
| **Comprehensive Test Suite** | ❌ MISSING | Need complete job postings |

### 10.3 Normalization Issues

| Issue | Severity | Location | Fix Required |
|-------|----------|----------|--------------|
| `fields.remote` vs `remoteStatus` | HIGH | `real-pipeline.ts:219` | Align field names |
| `compensation` not in schema | HIGH | `real-pipeline.ts:225` | Map to salary fields |
| `'WORK'` not in enum | MEDIUM | `real-pipeline.ts:221` | Use valid enum value |
| Array field mismatches | MEDIUM | `real-pipeline.ts:222-224` | Map to extraction fields |

---

## 11. Recommendations

### 11.1 Immediate Fixes Required
1. **Normalize Field Names**: Update `normalizeExtraction()` to match extraction schema
2. **Fix Default Values**: Use valid enum values for `opportunityType`
3. **Map Compensation Fields**: Convert `compensation` object to individual salary fields

### 11.2 Testing Improvements
1. **Create Comprehensive Fixtures**: Add complete job postings with all fields
2. **Add Content Type Variants**: Include HTML, text, and mixed content
3. **Test Edge Cases**: Missing fields, malformed data, large documents

### 11.3 Live Validation
1. **Set NVIDIA_API_KEY**: Required for model extraction testing
2. **Run End-to-End Test**: Validate full pipeline with real API calls
3. **Measure Performance**: Latency, token usage, cost analysis

---

## 12. Conclusion

**Structural Validation**: ✅ COMPLETE
- All core components are properly implemented
- Extraction engine has proper model + deterministic fallback
- Validation logic covers schema and business rules
- Provenance tracking is comprehensive
- Fallback behavior is well-defined

**Normalization Issues**: ⚠️ NEEDS FIXES
- Field name mismatches between extraction and normalization
- Default values use invalid enum values
- Compensation field mapping incomplete

**Live Verification**: ❌ BLOCKED
- NVIDIA_API_KEY not available in environment
- Cannot verify model extraction with real API calls
- Deterministic fallback is functional

**Overall Status**: **STRUCTURALLY VERIFIED with NORMALIZATION ISSUES**

The extraction pipeline is architecturally sound and well-designed. The main issues are in the normalization step where field names don't align with the extraction schema. Once these alignment issues are fixed and the NVIDIA API key is provided, the pipeline should be ready for live validation.

---

**Validation Completed**: Agent D - Real Extraction + Normalization Validator
**Next Steps**: Fix normalization alignment issues, provide NVIDIA_API_KEY for live testing

# Phase 7 - NVIDIA Live API Validation Report

**Agent**: B - NVIDIA Model Provider & Live API Validator
**Date**: 2026-09-19
**Project**: AutomatedOpportunityWorkflow
**Status**: BLOCKED - NVIDIA_API_KEY unavailable in environment

---

## Executive Summary

The NVIDIA model provider is **structurally complete** and **architecturally sound**. All configuration scaffolding, provider adapters, model definitions, prompt templates, and error handling are fully implemented. However, **live API validation cannot proceed** because no `.env` file exists with a valid `NVIDIA_API_KEY`. No fabricated test results are included.

---

## 1. Provider Configuration Found

### NVIDIA Provider Definition

| Property | Value | Source |
|----------|-------|--------|
| **Provider ID** | `nvidia` | `shared/src/config/model-loader.ts:143` |
| **Provider Name** | `NVIDIA` | `shared/src/config/model-loader.ts:144` |
| **Provider Type** | `openai-compatible` | `shared/src/config/model-loader.ts:145` |
| **Base URL** | `https://integrate.api.nvidia.com/v1` | `shared/src/config/model-loader.ts:146` |
| **API Key Env Var** | `NVIDIA_API_KEY` | `shared/src/config/model-loader.ts:147` |
| **Enabled Condition** | `!!process.env.NVIDIA_API_KEY` | `shared/src/config/model-loader.ts:148` |
| **Priority** | `1` (primary) | `shared/src/config/model-loader.ts:149` |
| **Rate Limit (RPM)** | `60` | `shared/src/config/model-loader.ts:150` |
| **Rate Limit (TPM)** | `150,000` | `shared/src/config/model-loader.ts:150` |

### Fallback Providers

| Provider | Type | Base URL | Priority |
|----------|------|----------|----------|
| OpenAI | `openai-compatible` | `https://api.openai.com/v1` | 2 |
| Ollama | `ollama` | `http://localhost:11434` | 3 |

---

## 2. Model Identifiers Found

### Chat/Generation Models

| Internal ID | API Model Name | Provider | Capabilities | Context | Structured Output |
|-------------|---------------|----------|--------------|---------|-------------------|
| `nemotron-3-ultra` | `nvidia/nemotron-3-ultra-550b-a55b` | NVIDIA | `text-generation`, `structured-generation` | 128,000 | `true` |
| `gpt-4o-mini` | `gpt-4o-mini` | OpenAI | `text-generation`, `structured-generation` | 128,000 | `true` |

### Embedding Models

| Internal ID | API Model Name | Provider | Dimensions | Capabilities |
|-------------|---------------|----------|------------|--------------|
| `nvidia-embed-qa-4` | `nvidia/nv-embedqa-mistral-7b-v2` | NVIDIA | 1,024 | `embeddings` |
| `text-embedding-3-small` | `text-embedding-3-small` | OpenAI | 1,536 | `embeddings` |

### Default Model Assignments

| Operation | Default Model | Provider |
|-----------|--------------|----------|
| Extraction | `nemotron-3-ultra` | NVIDIA |
| Classification | `nemotron-3-ultra` | NVIDIA |
| Embedding | `text-embedding-3-small` | OpenAI |
| Reasoning | `nemotron-3-ultra` | NVIDIA |
| Matching | `text-embedding-3-small` | OpenAI |
| Reranking | *(not configured)* | -- |

---

## 3. Endpoint Configuration Found

### API Endpoints Used

| Endpoint | Method | Purpose | Source |
|----------|--------|---------|--------|
| `/chat/completions` | POST | Text generation and structured output | `openai-compatible.ts:158` |
| `/embeddings` | POST | Embedding generation | `openai-compatible.ts:243` |
| `/rerank` | POST | Reranking (if supported) | `openai-compatible.ts:279` |
| `/models` | GET | Health check | `openai-compatible.ts:315` |

### Full NVIDIA Endpoint URLs

```
Base:    https://integrate.api.nvidia.com/v1
Chat:    https://integrate.api.nvidia.com/v1/chat/completions
Embed:   https://integrate.api.nvidia.com/v1/embeddings
Models:  https://integrate.api.nvidia.com/v1/models
Rerank:  https://integrate.api.nvidia.com/v1/rerank
```

---

## 4. Structured Output Support Status

### Implementation

**Status**: STRUCTURALLY VERIFIED - Implemented in code, not live-tested

The `OpenAICompatibleAdapter` supports structured output via two mechanisms:

1. **`json_object` mode** (`response_format: { type: 'json_object' }`)
   - Used when `request.responseFormat === 'json'`
   - Source: `openai-compatible.ts:151-152`

2. **`json_schema` mode** (`response_format: { type: 'json_schema', json_schema: {...} }`)
   - Used when `request.responseFormat === 'json_schema'`
   - Source: `openai-compatible.ts:153-154`
   - Structured generation: `openai-compatible.ts:190`

### JSON Schemas Defined Per Prompt

| Prompt | Schema Location | Required Fields |
|--------|----------------|-----------------|
| Extraction | `extraction/prompt-v1.ts` (`EXTRACTION_JSON_SCHEMA`) | `fields`, `warnings` |
| Classification | `classification/prompt-v1.ts` (`CLASSIFICATION_JSON_SCHEMA`) | Array of `{categoryId, confidenceScore, reasoning}` |
| Requirements | `requirements/prompt-v1.ts` (`REQUIREMENT_EXTRACTION_JSON_SCHEMA`) | `requirements`, `warnings` |
| Candidate Intel | `candidate/prompt-v1.ts` (`CANDIDATE_INTELLIGENCE_JSON_SCHEMA`) | `signals`, `summary`, `warnings` |

### NVIDIA Structured Output Compatibility

Per NVIDIA API Catalog documentation (verified 2025-09-18), `response_format` with `json_object` is supported. `json_schema` mode support needs live verification -- this is a critical gap this phase was meant to address.

---

## 5. Authentication Method

**Method**: Bearer Token (HTTP Authorization header)

```typescript
// Source: openai-compatible.ts:119
headers: {
  'Authorization': `Bearer ${this.apiKey}`,
  'Content-Type': 'application/json',
  ...this.provider.defaultHeaders,
}
```

**Key Variable**: `NVIDIA_API_KEY` (expected prefix: `nvapi-...`)

**Initialization Guard** (line 96-98):
```typescript
if (!this.apiKey && this.provider.type !== 'ollama') {
  throw new Error(`API key required for provider ${this.provider.id}`);
}
```

---

## 6. Token Handling

### Token Usage Tracking

Token usage is extracted from every API response:

```typescript
// Source: openai-compatible.ts:162-166
const usage: TokenUsage = {
  promptTokens: response.data.usage?.prompt_tokens || 0,
  completionTokens: response.data.usage?.completion_tokens || 0,
  totalTokens: response.data.usage?.total_tokens || 0,
};
```

### Cost Estimation

Cost estimation rates are defined in `observability.ts:162-172`:

| Provider | Model | Input Cost (per 1K tokens) | Output Cost (per 1K tokens) |
|----------|-------|---------------------------|----------------------------|
| nvidia | `nemotron-3-ultra` | $0.0002 | $0.0008 |
| openai | `gpt-4o-mini` | $0.00015 | $0.0006 |
| openai | `text-embedding-3-small` | $0.00002 | $0 |
| openai | `text-embedding-3-large` | $0.00013 | $0 |

### Execution Records

Every model call generates a `ModelExecutionRecord` with:
- Execution ID, operation type, provider/model IDs
- Prompt version, input hash (for cache/dedup)
- Status (success/error/fallback/validation_failed)
- Latency, retry count, fallback flag
- Token usage, estimated cost
- Error category and message

---

## 7. Error Handling

### Error Categories

Defined in `types.ts:146-154`:

| Category | Trigger Conditions |
|----------|--------------------|
| `timeout` | Request exceeded timeout (default 30s) |
| `rate_limit` | HTTP 429 or "rate limit" in message |
| `auth_error` | HTTP 401/403 or "unauthorized" in message |
| `provider_unavailable` | HTTP 503 or "unavailable" in message |
| `malformed_output` | Response could not be parsed |
| `validation_error` | Output failed schema validation |
| `context_length_exceeded` | "context length" or "max tokens" in message |
| `unknown` | Catch-all |

### Error Enhancement

Every error from the adapter is enhanced with category, status, provider ID, and original error:

```typescript
// Source: openai-compatible.ts:341-350
private enhanceError(error: any, operation: string): Error {
  const category = mapErrorCategory(error);
  const enhanced = new Error(`[${this.provider.id}] ${operation} failed: ${message}`);
  (enhanced as any).category = category;
  (enhanced as any).status = error?.status || error?.response?.status;
  (enhanced as any).provider = this.provider.id;
  (enhanced as any).originalError = error;
  return enhanced;
}
```

---

## 8. Retry Logic

### Configuration

| Parameter | Default | Source |
|-----------|---------|--------|
| Max Retries | 2 | `execution.ts:40`, configurable per operation |
| Timeout | 30,000ms | `execution.ts:41`, configurable per operation |
| Backoff Algorithm | Exponential with jitter | `execution.ts:200-201` |

### Backoff Formula

```typescript
// Source: execution.ts:200-201
private calculateBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
}
```

Resulting delays: ~1-2s, ~2-3s, ~4-5s, ... capped at 30s.

### Retry Conditions

Retries are triggered for:
- `rate_limit` errors (with backoff)
- `timeout` errors (with backoff)
- Any other error (without backoff, immediate retry)

### Fallback Chain

```
NVIDIA Nemotron (primary)
  -> Retry (exponential backoff, max 2)
  -> OpenAI gpt-4o-mini (fallback model)
  -> Deterministic engine (DeterministicExtractor, DeterministicClassifier, etc.)
```

### Timeout Enforcement

```typescript
// Source: execution.ts:191-198
private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}
```

---

## 9. Rate Limiting

### Implementation

Token bucket rate limiter (per-provider adapter):

```typescript
// Source: openai-compatible.ts:18-50
function createTokenBucket(config: TokenBucketConfig): RateLimiter {
  // capacity = requestsPerMinute
  // refillRate = requestsPerMinute / 60 (per second)
}
```

### NVIDIA Rate Limits

| Limit | Value | Source |
|-------|-------|--------|
| Requests Per Minute | 60 | `model-loader.ts:150` |
| Tokens Per Minute | 150,000 | `model-loader.ts:150` |

### Rate Limit Behavior

- Blocking acquire: waits until tokens are available (polls every 100ms)
- For embeddings: acquires tokens proportional to batch size (`request.texts.length`)
- No per-request token estimation (requests always acquire 1 token by default)

---

## 10. Prompt Format Summary

All four intelligence prompts use the same pattern:

| Prompt | System Role | User Role | Response Format | JSON Schema |
|--------|-------------|-----------|-----------------|-------------|
| Extraction v1 | Expert extractor | Document content + metadata | `json` or `json_schema` | `EXTRACTION_JSON_SCHEMA` |
| Classification v1 | Taxonomy classifier | Opportunity text | `json` or `json_schema` | `CLASSIFICATION_JSON_SCHEMA` |
| Requirements v1 | Requirements expert | Document content + metadata | `json` or `json_schema` | `REQUIREMENT_EXTRACTION_JSON_SCHEMA` |
| Candidate Intel v1 | Profile analyst | Candidate profile JSON | `json` or `json_schema` | `CANDIDATE_INTELLIGENCE_JSON_SCHEMA` |

Prompt versioning uses `PROMPT_VERSION = 'v1'` with hash-based provenance tracking.

Document truncation limit: 15,000 characters per prompt.

---

## 11. Verification Item Status Matrix

| # | Verification Item | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | NVIDIA base URL configured | **STRUCTURALLY VERIFIED** | `https://integrate.api.nvidia.com/v1` in `model-loader.ts:146` |
| 2 | Chat/generation model IDs | **STRUCTURALLY VERIFIED** | `nvidia/nemotron-3-ultra-550b-a55b` in `model-loader.ts:175` |
| 3 | Embedding model IDs | **STRUCTURALLY VERIFIED** | `nvidia/nv-embedqa-mistral-7b-v2` in `model-loader.ts:204` |
| 4 | Structured output (JSON schema) | **STRUCTURALLY VERIFIED** | Implemented in `openai-compatible.ts:153-154,190`; NVIDIA live support unknown |
| 5 | Authentication method | **STRUCTURALLY VERIFIED** | Bearer token via `Authorization` header, `openai-compatible.ts:119` |
| 6 | Token counting/tracking | **STRUCTURALLY VERIFIED** | Extracted from `response.data.usage`, `openai-compatible.ts:162-166` |
| 7 | Error handling | **STRUCTURALLY VERIFIED** | 8 error categories, enhanced errors, `openai-compatible.ts:52-72,341-350` |
| 8 | Retry logic | **STRUCTURALLY VERIFIED** | Exponential backoff, max 2 retries, `execution.ts:200-201` |
| 9 | Rate limiting | **STRUCTURALLY VERIFIED** | Token bucket, 60 RPM / 150K TPM, `openai-compatible.ts:18-50` |
| 10 | Live chat completion | **BLOCKED** | No `NVIDIA_API_KEY` in environment |
| 11 | Live embedding call | **BLOCKED** | No `NVIDIA_API_KEY` in environment |
| 12 | Live structured output validation | **BLOCKED** | No `NVIDIA_API_KEY` in environment |
| 13 | Live health check | **BLOCKED** | No `NVIDIA_API_KEY` in environment |
| 14 | NVIDIA provider enabled at runtime | **BLOCKED** | Requires `NVIDIA_API_KEY` set (`!!process.env.NVIDIA_API_KEY`) |

---

## 12. Environment Gap Analysis

### What Exists

- `.env.example` with full NVIDIA configuration documentation (commented out)
- `shared/src/config/model-config.env.example` with NVIDIA provider examples
- `shared/src/config/model-loader.ts` with hardcoded NVIDIA defaults
- `scripts/test-nemotron.ts` and `scripts/test-pipeline.ts` for live testing

### What Is Missing

- `.env` file (does not exist)
- `NVIDIA_API_KEY` value (not set anywhere in environment)
- No `.env.local` or other override file found

### Required to Unblock

```bash
# Minimum .env additions needed:
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxx  # For fallback
```

---

## 13. Key Files Reference

| File | Purpose |
|------|---------|
| `shared/src/models/providers/openai-compatible.ts` | OpenAI-compatible adapter (used for NVIDIA) |
| `shared/src/models/provider.interface.ts` | Provider adapter interface and rate limiter |
| `shared/src/models/execution.ts` | Retry logic, timeout, fallback orchestration |
| `shared/src/models/observability.ts` | Execution records, cost estimation |
| `shared/src/models/cache.ts` | Model response caching |
| `shared/src/models/registry.ts` | Model/provider registry and health checks |
| `shared/src/models/unified-service.ts` | High-level unified model service |
| `shared/src/config/model-loader.ts` | Env-based model config loader + hardcoded defaults |
| `backend/src/intelligence/extraction/prompt-v1.ts` | Extraction prompt + JSON schema |
| `backend/src/intelligence/classification/prompt-v1.ts` | Classification prompt + JSON schema |
| `backend/src/intelligence/requirements/prompt-v1.ts` | Requirements prompt + JSON schema |
| `backend/src/intelligence/candidate/prompt-v1.ts` | Candidate intelligence prompt + JSON schema |
| `docs/intelligence/NVIDIA_NEMOTRON.md` | NVIDIA integration documentation |
| `docs/intelligence/MODEL_ROUTING.md` | Model routing table documentation |

---

*Report generated by Agent B. No live API calls were made. All findings are based on structural code analysis.*

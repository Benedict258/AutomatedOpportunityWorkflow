# Model Routing Table

## Overview

This document describes the actual model routing implemented in the repository. It maps each intelligence operation to its configured provider and model.

## Current Routing (After NVIDIA Integration)

| Operation | Provider | Model | Fallback | Configuration Source | Status |
|-----------|----------|-------|----------|---------------------|--------|
| **Extraction** | NVIDIA | `nvidia/nemotron-3-ultra-550b-a55b` | DeterministicExtractor | `MODEL_DEFAULT_EXTRACTION=nemotron-3-ultra` | ✅ Configured |
| **Classification** | NVIDIA | `nvidia/nemotron-3-ultra-550b-a55b` | DeterministicClassifier | `MODEL_DEFAULT_CLASSIFICATION=nemotron-3-ultra` | ✅ Configured |
| **Requirements** | NVIDIA | `nvidia/nemotron-3-ultra-550b-a55b` | DeterministicRequirementParser | `MODEL_DEFAULT_EXTRACTION` (shared) | ✅ Configured |
| **Embedding** | OpenAI | `text-embedding-3-small` | N/A | `MODEL_DEFAULT_EMBEDDING=text-embedding-3-small` | ✅ Configured |
| **Reasoning** | NVIDIA | `nvidia/nemotron-3-ultra-550b-a55b` | Deterministic template | `MODEL_DEFAULT_REASONING=nemotron-3-ultra` | ✅ Configured |
| **Matching** | Embedding + Deterministic | `text-embedding-3-small` + cosine | N/A | `MODEL_DEFAULT_MATCHING=text-embedding-3-small` | ✅ Configured |
| **Reranking** | — | — | — | `MODEL_DEFAULT_RERANKING=` | Not configured |

## Provider Configuration

| Provider | Type | Base URL | API Key | Priority | Status |
|----------|------|----------|---------|----------|--------|
| NVIDIA | openai-compatible | `https://integrate.api.nvidia.com/v1` | `NVIDIA_API_KEY` | 1 | ✅ Configured |
| OpenAI | openai-compatible | `https://api.openai.com/v1` | `OPENAI_API_KEY` | 2 | ✅ Configured |
| Ollama | ollama | `http://localhost:11434` | — | 3 | ✅ Configured |

## Model Definitions

| Model ID | Provider | Name | Capabilities | Enabled | Context | Dimensions |
|----------|----------|------|--------------|---------|---------|------------|
| nemotron-3-ultra | NVIDIA | nvidia/nemotron-3-ultra-550b-a55b | text-generation, structured-generation | `NVIDIA_API_KEY` | 128000 | — |
| gpt-4o-mini | OpenAI | gpt-4o-mini | text-generation, structured-generation | `OPENAI_API_KEY` | 128000 | — |
| text-embedding-3-small | OpenAI | text-embedding-3-small | embeddings | `OPENAI_API_KEY` | — | 1536 |
| nvidia-embed-qa-4 | NVIDIA | nvidia/nv-embedqa-mistral-7b-v2 | embeddings | `NVIDIA_API_KEY` | — | 1024 |

## Routing Logic

### Nemotron Used For:
1. **Extraction** - Structured field extraction from opportunity documents
2. **Classification** - Taxonomy category assignment (WORK, TECHNICAL EXPERIENCE, etc.)
3. **Requirements** - REQUIRE/PREFERRED/OPTIONAL/INFERRED/UNKNOWN extraction
4. **Reasoning** - Post-scoring explanations (grounded, no score mutation)

### OpenAI Used For:
1. **Embeddings** - `text-embedding-3-small` for candidate/opportunity vectors
2. **Fallback** - If NVIDIA unavailable, OpenAI models serve as fallback

### Deterministic (No Model):
1. **Hard Eligibility** - ELIGIBLE/UNCERTAIN/INELIGIBLE with evidence
2. **Scoring** - Fixed weights: career 25%, skill 20%, eligibility 15%, experience 10%, education 10%, value 10%, location 5%, timing 5%
2. **Ranking** - Deterministic sort by final score
3. **Value/Timing** - Structured factor assessment

## Fallback Chain

For each operation using Nemotron:

```
NVIDIA Nemotron (primary)
    ↓ [on error/timeout/validation fail]
Retry (exponential backoff, max 2)
    ↓
OpenAI gpt-4o-mini (fallback model)
    ↓ [if also fails]
Deterministic engine (DeterministicExtractor, DeterministicClassifier, etc.)
```

## Environment Variables

Required for NVIDIA Nemotron:
```bash
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx
```

Required for OpenAI fallback:
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

Optional model overrides:
```bash
MODEL_DEFAULT_EXTRACTION=nemotron-3-ultra
MODEL_DEFAULT_CLASSIFICATION=nemotron-3-ultra
MODEL_DEFAULT_REASONING=nemotron-3-ultra
MODEL_DEFAULT_EMBEDDING=text-embedding-3-small
MODEL_DEFAULT_MATCHING=text-embedding-3-small
```

## Verification Checklist

- [ ] NVIDIA provider registered with correct base URL
- [ ] Nemotron model registered under NVIDIA provider
- [ ] Default operations point to Nemotron
- [ ] Embeddings remain on OpenAI (not Nemotron)
- [ ] Fallback chain configured
- [ ] Health check works for NVIDIA provider
- [ ] Structured output validated against schemas
- [ ] Deterministic fallbacks functional

## Current Status

| Component | Status |
|-----------|--------|
| NVIDIA Provider | ✅ Configured |
| Nemotron Model | ✅ Registered |
| Default Routing | ✅ Updated |
| Embeddings Separated | ✅ OpenAI |
| Fallback Chain | ✅ Configured |
| Live API Test | ⚠️ Needs API key |
| Structured Output | ⚠️ Needs verification |
| Schema Validation | ✅ Implemented |
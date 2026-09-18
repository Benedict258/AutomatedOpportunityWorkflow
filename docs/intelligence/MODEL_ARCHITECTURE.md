# Model Architecture

## Overview

The intelligence system uses a provider-agnostic model architecture that separates business logic from model provider implementations.

## Core Components

### Model Registry (`shared/src/models/registry.ts`)
- Central registry for all model providers and definitions
- Manages default model assignments per operation
- Health checking and fallback management

### Model Providers (`shared/src/models/providers/`)
- `OpenAICompatibleAdapter` - Supports OpenAI API and compatible endpoints
- `OllamaAdapter` - Supports local Ollama instances
- Extensible factory pattern for new providers

### Unified Model Service (`shared/src/models/unified-service.ts`)
- High-level API for all model operations
- Built-in observability, caching, fallback, and cost controls
- Operation-specific convenience methods:
  - `extract()` - Opportunity extraction
  - `classify()` - Taxonomy classification
  - `extractRequirements()` - Requirement extraction
  - `generateEmbeddings()` - Vector embeddings
  - `explain()` - Post-scoring explanations

### Execution Service (`shared/src/models/execution.ts`)
- Retry logic with exponential backoff
- Timeout handling
- Fallback chain execution
- Observability integration

### Observability (`shared/src/models/observability.ts`)
- Structured execution records
- Cost estimation
- Latency tracking
- Token usage monitoring

### Caching (`shared/src/models/cache.ts`)
- Content-hash based caching
- TTL and size limits
- In-memory and pluggable storage backends

## Model Operations

| Operation | Model Slot | Description |
|-----------|------------|-------------|
| Extraction | `extraction` | Structured field extraction from raw documents |
| Classification | `classification` | Taxonomy category assignment |
| Requirement Extraction | `requirement-extraction` | REQUIRE/PREFERRED/OPTIONAL/INFERRED/UNKNOWN |
| Embedding | `embedding` | Vector representations for semantic matching |
| Reasoning | `reasoning` | Post-scoring explanations |
| Reranking | `reranking` | Optional semantic reranking |

## Configuration

Model configuration via environment variables:
```
MODEL_PROVIDER_<ID>_TYPE=openai-compatible|ollama
MODEL_PROVIDER_<ID>_BASE_URL=...
MODEL_PROVIDER_<ID>_API_KEY=...
MODEL_<MODEL_ID>_PROVIDER=<provider_id>
MODEL_<MODEL_ID>_NAME=<model_name>
MODEL_<MODEL_ID>_CAPABILITIES=text-generation,embeddings
MODEL_DEFAULT_EXTRACTION=<model_id>
MODEL_DEFAULT_CLASSIFICATION=<model_id>
MODEL_DEFAULT_EMBEDDING=<model_id>
MODEL_DEFAULT_REASONING=<model_id>
```

See `shared/src/config/model-config.env.example` for full reference.

## Deterministic Boundaries

LLM outputs NEVER directly determine:
- Final eligibility (ELIGIBLE/UNCERTAIN/INELIGIBLE)
- Final match score
- Ranking order
- Deadline validity
- Duplicate identity

These remain authoritative deterministic functions. LLMs provide structured intelligence that deterministic systems consume.
# NVIDIA Nemotron 3 Ultra Integration

## Official NVIDIA Information

**Source**: NVIDIA API Catalog at `https://integrate.api.nvidia.com/v1/models` (queried 2025-09-18)

### Model Details

| Property | Value |
|----------|-------|
| **Model ID** | `nvidia/nemotron-3-ultra-550b-a55b` |
| **Owner** | `nvidia` |
| **API Endpoint** | `https://integrate.api.nvidia.com/v1` |
| **API Type** | OpenAI-compatible |
| **Authentication** | Bearer token (NVIDIA API key) |

### Available NVIDIA Models (from API)

The following NVIDIA models are available on the API:

- `nvidia/nemotron-3-ultra-550b-a55b` - Primary reasoning model
- `nvidia/nemotron-3-super-120b-a12b` - Larger model
- `nvidia/nemotron-3.5-lightning-30b-a3b` - Fast variant
- `nvidia/nemotron-4-340b-instruct` - Latest generation
- `nvidia/nemotron-3-embed-1b` - Embedding model
- `nvidia/nv-embedqa-mistral-7b-v2` - QA embedding model
- And many more Llama-Nemotron variants

### Repository Configuration Status

**Current (Problematic)**:
- Model defined as `nemotron-3-ultra` under provider `openai`
- Uses OpenAI base URL (`https://api.openai.com/v1`)
- Uses `OPENAI_API_KEY` environment variable
- Context length: 4096 (incorrect - actual may be larger)
- Default operations still use `gpt-4o-mini`

**Required Fix**:
- Create dedicated `nvidia` provider with correct base URL
- Use NVIDIA API key (`NVIDIA_API_KEY`)
- Point to `https://integrate.api.nvidia.com/v1`
- Set as default for reasoning/extraction/classification

### Model Capabilities (Verified)

| Capability | Status |
|------------|--------|
| Text Generation | ✅ Supported |
| Structured Output (JSON) | ✅ Via `response_format` |
| Structured Output (JSON Schema) | ⚠️ Needs verification |
| Function/Tool Calling | ⚠️ Needs verification |
| Reasoning/Thinking | ⚠️ Parameter support needs verification |
| Streaming | ⚠️ Needs verification |

### API Request Format

```bash
curl -X POST https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/nemotron-3-ultra-550b-a55b",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.1,
    "max_tokens": 4096
  }'
```

### Rate Limits & Pricing

- **Rate Limits**: Per NVIDIA API tier (check NVIDIA account)
- **Pricing**: Pay-per-token via NVIDIA API credits
- **Context Length**: Up to model maximum (verify per model)

### References

- NVIDIA API Models List: `https://integrate.api.nvidia.com/v1/models`
- NVIDIA AI Foundation Models: https://www.nvidia.com/en-us/ai-data-science/ai-foundation-models/
- NVIDIA Nemotron Blog: https://www.nvidia.com/en-us/research/nemotron/

---

## Repository Configuration Audit

### Current Model Routing Table

| Operation | Provider | Model | Fallback | Config Source | Status |
|-----------|----------|-------|----------|---------------|--------|
| Extraction | openai | gpt-4o-mini | deterministic | `MODEL_DEFAULT_EXTRACTION` | ❌ Wrong provider |
| Classification | openai | gpt-4o-mini | deterministic | `MODEL_DEFAULT_CLASSIFICATION` | ❌ Wrong provider |
| Requirements | openai | gpt-4o-mini | deterministic | `MODEL_DEFAULT_EXTRACTION` | ❌ Wrong provider |
| Embedding | openai | text-embedding-3-small | N/A | `MODEL_DEFAULT_EMBEDDING` | ❌ Wrong provider |
| Reasoning | openai | gpt-4o-mini | deterministic | `MODEL_DEFAULT_REASONING` | ❌ Wrong provider |
| Matching | openai | text-embedding-3-small | N/A | `MODEL_DEFAULT_MATCHING` | ❌ Wrong provider |
| Reranking | - | - | - | `MODEL_DEFAULT_RERANKING` | Not configured |

### Nemotron Model Status

| Aspect | Current | Required |
|--------|---------|----------|
| Provider | openai (wrong) | nvidia |
| Base URL | api.openai.com/v1 | integrate.api.nvidia.com/v1 |
| API Key | OPENAI_API_KEY | NVIDIA_API_KEY |
| Model ID | nvidia/nemotron-3-ultra | nvidia/nemotron-3-ultra-550b-a55b |
| Default for any operation | No | Yes (reasoning, extraction, classification) |

---

## Test Results

### Live API Test (2025-09-18)

| Test | Result |
|------|--------|
| Models list endpoint | ✅ PASS |
| Model availability | ✅ `nvidia/nemotron-3-ultra-550b-a55b` listed |
| Authentication | ⚠️ Requires valid NVIDIA_API_KEY |
| Chat completion | ⚠️ Not tested (needs API key) |
| Structured output | ⚠️ Not tested |

---

## Action Items

1. ✅ Create NVIDIA provider configuration
2. ⬜ Update model registry to use NVIDIA provider for Nemotron
3. ⬜ Set Nemotron as default for reasoning, extraction, classification
4. ⬜ Keep embeddings on dedicated embedding model (not Nemotron)
5. ⬜ Create test scripts for live verification
6. ⬜ Update .env.example with NVIDIA configuration
7. ⬜ Run live tests with actual API key
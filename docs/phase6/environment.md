# Environment Configuration Reference

This document catalogs all environment variables required by the Automated Opportunity Workflow system, categorized by purpose and deployment environment.

---

## Variable Categories

| Category | Prefix | Description |
|----------|--------|-------------|
| **Infrastructure** | — | Core application and database settings |
| **Secrets** | — | API keys, passwords, tokens — **never commit** |
| **LLM Models** | `MODEL_*` / `*_MODEL` | Model provider configuration and default assignments |
| **Feature Flags** | `CONFIG_*` | Runtime business config overrides via env |
| **Observability** | `LOG_LEVEL` | Logging verbosity |

---

## 1. Infrastructure Variables (Required for All Environments)

| Variable | Required | Default | Dev Value | Prod Value | Description |
|----------|:--------:|:-------:|:---------:|:----------:|-------------|
| `NODE_ENV` | ✅ | `development` | `development` | `production` | Runtime environment |
| `APP_NAME` | ✅ | — | `AutomatedOpportunityWorkflow` | `AutomatedOpportunityWorkflow` | Application identifier |
| `PORT` | ✅ | `3001` | `3001` | `3001` / `8080` | HTTP server port |
| `FRONTEND_URL` | ✅ | — | `http://localhost:5173` | `https://app.example.com` | CORS origin for frontend |
| `API_URL` | ✅ | — | `http://localhost:3001` | `https://api.example.com` | Backend API base URL |
| `DATABASE_URL` | ✅ | — | `postgresql://...` | `postgresql://...` | PostgreSQL connection string |
| `POSTGRES_USER` | ✅ | `opp_user` | `opp_user` | `prod_user` | Database username |
| `POSTGRES_PASSWORD` | ✅ | *(empty)* | **set in .env** | **from secret manager** | Database password — **SECRET** |
| `POSTGRES_DB` | ✅ | `opportunity_intelligence` | `opportunity_intelligence` | `opportunity_intelligence` | Database name |
| `LOG_LEVEL` | ❌ | `info` | `debug` | `info` / `warn` | Log verbosity (debug, info, warn, error) |

> **Note:** `DATABASE_URL` supports variable substitution for `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

---

## 2. Secrets (Never Commit, Use Secret Manager in Production)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `NVIDIA_API_KEY` | ⚠️ | NVIDIA API key for Nemotron models |
| `OPENAI_API_KEY` | ⚠️ | OpenAI API key for GPT/embedding models |
| `AWS_ACCESS_KEY_ID` | ❌ | AWS credentials for S3/Secrets Manager |
| `AWS_SECRET_ACCESS_KEY` | ❌ | AWS secret access key |
| `MODEL_PROVIDER_*_API_KEY` | ⚠️ | Per-provider API keys (see Model Config) |

> **Security Requirements:**
> - All secrets MUST be loaded from environment variables only
> - NEVER place secrets in YAML config files (`default.yaml`, `production.yaml`, etc.)
> - NEVER log secrets — the config loader does not log configuration values
> - In production, inject secrets via Kubernetes secrets, AWS Secrets Manager, or equivalent

---

## 3. LLM Model Configuration

### Model Slots (Legacy / Simple)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `EXTRACTION_MODEL` | ❌ | Model ID for requirement extraction |
| `CLASSIFICATION_MODEL` | ❌ | Model ID for taxonomy classification |
| `MATCHING_MODEL` | ❌ | Model ID for semantic matching |
| `REASONING_MODEL` | ❌ | Model ID for reasoning/timing intelligence |
| `EMBEDDING_MODEL` | ❌ | Model ID for embeddings |
| `RERANKING_MODEL` | ❌ | Model ID for reranking (optional) |

### Model Provider Configuration (Recommended)

Configure providers via `MODEL_PROVIDER_<ID>_*` variables:

| Variable Pattern | Required | Example | Description |
|------------------|:--------:|---------|-------------|
| `MODEL_PROVIDER_<ID>_TYPE` | ✅ | `openai-compatible` | Provider type: `openai-compatible`, `ollama` |
| `MODEL_PROVIDER_<ID>_BASE_URL` | ✅ | `https://api.openai.com/v1` | API base URL |
| `MODEL_PROVIDER_<ID>_API_KEY` | ✅ | `sk-...` | **SECRET** — Provider API key |
| `MODEL_PROVIDER_<ID>_NAME` | ❌ | `OpenAI` | Display name |
| `MODEL_PROVIDER_<ID>_ENABLED` | ❌ | `true` | Enable/disable provider |
| `MODEL_PROVIDER_<ID>_PRIORITY` | ❌ | `1` | Fallback priority (lower = higher priority) |
| `MODEL_PROVIDER_<ID>_RATE_LIMIT_RPM` | ❌ | `60` | Requests per minute |
| `MODEL_PROVIDER_<ID>_RATE_LIMIT_TPM` | ❌ | `150000` | Tokens per minute |

**Example (NVIDIA):**
```bash
MODEL_PROVIDER_NVIDIA_TYPE=openai-compatible
MODEL_PROVIDER_NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MODEL_PROVIDER_NVIDIA_API_KEY=nvapi-...
MODEL_PROVIDER_NVIDIA_ENABLED=true
MODEL_PROVIDER_NVIDIA_PRIORITY=1
MODEL_PROVIDER_NVIDIA_RATE_LIMIT_RPM=60
```

### Model Definitions

Configure models via `MODEL_<MODEL_ID>_*` variables:

| Variable Pattern | Required | Example | Description |
|------------------|:--------:|---------|-------------|
| `MODEL_<ID>_PROVIDER` | ✅ | `nvidia` | Provider ID (must match a configured provider) |
| `MODEL_<ID>_NAME` | ✅ | `nvidia/nemotron-3-ultra-550b-a55b` | Full model identifier |
| `MODEL_<ID>_CAPABILITIES` | ❌ | `text-generation,structured-generation` | Comma-separated: `text-generation`, `structured-generation`, `embeddings` |
| `MODEL_<ID>_CONTEXT` | ❌ | `128000` | Context window size |
| `MODEL_<ID>_DIMENSIONS` | ❌ | `1536` | Embedding dimensions (for embedding models) |
| `MODEL_<ID>_ENABLED` | ❌ | `true` | Enable/disable model |
| `MODEL_<ID>_FALLBACK` | ❌ | `gpt-4o-mini` | Fallback model ID |
| `MODEL_<ID>_TEMPERATURE` | ❌ | `0.1` | Sampling temperature |
| `MODEL_<ID>_MAX_TOKENS` | ❌ | `4096` | Max output tokens |
| `MODEL_<ID>_TIMEOUT_MS` | ❌ | `30000` | Request timeout (ms) |
| `MODEL_<ID>_MAX_RETRIES` | ❌ | `2` | Max retry attempts |

### Default Model Assignments

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `MODEL_DEFAULT_EXTRACTION` | ❌ | `nemotron-3-ultra` | Default extraction model |
| `MODEL_DEFAULT_CLASSIFICATION` | ❌ | `nemotron-3-ultra` | Default classification model |
| `MODEL_DEFAULT_EMBEDDING` | ❌ | `text-embedding-3-small` | Default embedding model |
| `MODEL_DEFAULT_REASONING` | ❌ | `nemotron-3-ultra` | Default reasoning model |
| `MODEL_DEFAULT_MATCHING` | ❌ | `text-embedding-3-small` | Default matching model |
| `MODEL_DEFAULT_RERANKING` | ❌ | *(empty)* | Default reranking model (optional) |

---

## 4. Business Config Overrides (`CONFIG_*`)

Any business configuration from `default.yaml` can be overridden at runtime via `CONFIG_<PATH>` environment variables.

**Pattern:** `CONFIG_<SECTION>_<SUBSECTION>_<KEY>=value`

| Example | YAML Path | Type Coercion |
|---------|-----------|---------------|
| `CONFIG_MATCHING_THRESHOLDS_MIN_SCORE=0.7` | `matching.thresholds.min_score` | Number |
| `CONFIG_FEATURE_FLAGS_NOTIFICATION_ENABLED=false` | `feature_flags.notification_enabled` | Boolean |
| `CONFIG_SOURCES_MAX_ITEMS_PER_SOURCE=50` | `sources.max_items_per_source` | Number |
| `CONFIG_NOTIFICATIONS_SCHEDULE_TIMEZONE=America/New_York` | `notifications.schedule.timezone` | String |

**Rules:**
- Prefix must be `CONFIG_`
- Path parts separated by `_` (converted to `.` in config tree)
- Values auto-coerced: `true`/`false` → boolean, numeric strings → number, else string

---

## 5. Configuration Loading & Validation

### Load Order (Highest Priority Last)
1. `shared/config/default.yaml` — Base business config
2. `shared/config/{NODE_ENV}.yaml` — Environment overrides (development.yaml, production.yaml)
3. `CONFIG_*` environment variables — Runtime overrides

### Validation
- **Schema:** `shared/src/config/schema.ts` (Zod)
- **Validation Points:**
  - After merging YAML files (loader.ts:52-58)
  - After applying `CONFIG_*` overrides (loader.ts:88-94)
- **Failure Mode:** Throws `Error` with detailed path + message — **process exits on startup**

### Model Config Loading
- `shared/src/config/model-loader.ts` loads provider/model config from env
- Falls back to `createDefaultConfig()` if env vars not set
- Default config includes NVIDIA, OpenAI, Ollama providers (enabled only if API keys present)

---

## 6. Per-Environment Checklists

### Development (`.env`)
```bash
# Required
NODE_ENV=development
APP_NAME=AutomatedOpportunityWorkflow
PORT=3001
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3001
DATABASE_URL=postgresql://opp_user:dev_password@localhost:5432/opportunity_intelligence
POSTGRES_USER=opp_user
POSTGRES_PASSWORD=dev_password
POSTGRES_DB=opportunity_intelligence
LOG_LEVEL=debug

# LLM (at least one provider required for AI features)
NVIDIA_API_KEY=nvapi-...        # OR
OPENAI_API_KEY=sk-...
```

### Production (Injected via Secret Manager)
```bash
# Required
NODE_ENV=production
APP_NAME=AutomatedOpportunityWorkflow
PORT=8080
FRONTEND_URL=https://app.example.com
API_URL=https://api.example.com
DATABASE_URL=postgresql://prod_user:{{SECRET}}@db.example.com:5432/opportunity_intelligence
POSTGRES_USER=prod_user
POSTGRES_PASSWORD={{SECRET}}
POSTGRES_DB=opportunity_intelligence
LOG_LEVEL=info

# LLM Providers (configure at least one)
MODEL_PROVIDER_NVIDIA_TYPE=openai-compatible
MODEL_PROVIDER_NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
MODEL_PROVIDER_NVIDIA_API_KEY={{SECRET}}
MODEL_PROVIDER_NVIDIA_ENABLED=true
MODEL_PROVIDER_NVIDIA_PRIORITY=1

MODEL_PROVIDER_OPENAI_TYPE=openai-compatible
MODEL_PROVIDER_OPENAI_BASE_URL=https://api.openai.com/v1
MODEL_PROVIDER_OPENAI_API_KEY={{SECRET}}
MODEL_PROVIDER_OPENAI_ENABLED=true
MODEL_PROVIDER_OPENAI_PRIORITY=2

# Default model assignments
MODEL_DEFAULT_EXTRACTION=nemotron-3-ultra
MODEL_DEFAULT_CLASSIFICATION=nemotron-3-ultra
MODEL_DEFAULT_EMBEDDING=text-embedding-3-small
MODEL_DEFAULT_REASONING=nemotron-3-ultra
MODEL_DEFAULT_MATCHING=text-embedding-3-small
```

### CI/CD (GitHub Actions / GitLab CI)
```bash
# Minimal for tests
NODE_ENV=test
APP_NAME=AutomatedOpportunityWorkflow
PORT=3001
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=test_db
LOG_LEVEL=error

# Mock LLM or use test API keys
NVIDIA_API_KEY=test-key
# OR use Ollama local
MODEL_PROVIDER_OLLAMA_TYPE=ollama
MODEL_PROVIDER_OLLAMA_BASE_URL=http://localhost:11434
MODEL_PROVIDER_OLLAMA_ENABLED=true
```

---

## 7. Validation Checklist for Deployments

Before deploying to any environment, verify:

- [ ] All **Required** infrastructure variables are set
- [ ] All **Secrets** are injected via secret manager (not in repo, not in CI logs)
- [ ] At least one **LLM Provider** is configured with valid API key
- [ ] `MODEL_DEFAULT_*` assignments reference models that exist in provider config
- [ ] `FRONTEND_URL` and `API_URL` match deployed URLs (CORS)
- [ ] `DATABASE_URL` uses production database with SSL
- [ ] `LOG_LEVEL` appropriate for environment (`info`/`warn` for prod)
- [ ] `CONFIG_*` overrides tested in staging first
- [ ] Run config validation: `npm run typecheck` (validates schema imports)

---

## 8. Adding New Configuration

### For Business Config (YAML)
1. Add field to `shared/src/config/schema.ts` (Zod schema)
2. Add default value to `shared/config/default.yaml`
3. Add environment-specific override to `shared/config/development.yaml` or `production.yaml` if needed
4. Document in this file

### For Secrets/Infrastructure
1. Add to `.env.example` with description and category
2. Update this document
3. Ensure secret is never logged (config loader doesn't log)

### For Model Config
1. Add provider/model via `MODEL_PROVIDER_*` / `MODEL_*` env vars
2. Or extend `createDefaultConfig()` in `model-loader.ts` for new defaults
3. Document in this file and `shared/src/config/model-config.env.example`

---

## 9. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Configuration validation failed: matching.thresholds.min_score` | Invalid value in YAML or `CONFIG_*` | Check value is 0–1 number |
| `MODEL_PROVIDER_NVIDIA_API_KEY` not recognized | Wrong prefix or case | Must be `MODEL_PROVIDER_NVIDIA_API_KEY` (uppercase ID) |
| Model not found in registry | `MODEL_DEFAULT_*` references non-existent model ID | Ensure model ID matches `MODEL_<ID>_PROVIDER` definition |
| CORS errors in browser | `FRONTEND_URL` mismatch | Set exact origin including protocol/port |
| Database connection failed | `DATABASE_URL` or credentials wrong | Verify host, port, user, password, db name, SSL mode |

---

*Last updated: Phase 6 Configuration Audit*
*Config loader: `shared/src/config/loader.ts`*
*Schema: `shared/src/config/schema.ts`*
*Model loader: `shared/src/config/model-loader.ts`*
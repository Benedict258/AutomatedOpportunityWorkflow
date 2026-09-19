# Phase 6: Database & pgvector Audit Report

**Repository**: AutomatedOpportunityWorkflow  
**Date**: 2026-09-18  
**Auditor**: Subagent C - Database & pgvector Auditor

---

## Executive Summary

The database layer has a solid foundation with well-structured migrations, proper pgvector integration, and a comprehensive embedding storage system. However, there are **critical gaps** between the migration schema and the application's in-memory persistence patterns. Multiple services use in-memory Maps that should be backed by PostgreSQL for production readiness.

**Overall Grade**: B- (Good schema, significant persistence gaps)

---

## 1. Migration Inventory

### 1.1 Migration Files (backend/migrations/)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `001_create_extensions.sql` | Enable `vector` and `pgcrypto` extensions | 2 | ✅ Minimal but sufficient |
| `002_create_schema.sql` | Core schema: 26 tables for users, opportunities, candidates, skills, etc. | 333 | ✅ Comprehensive |
| `003_create_indexes.sql` | Performance indexes including IVFFlat for embeddings | 72 | ✅ Good coverage |
| `004_create_embeddings.sql` | Dedicated embedding tables + metadata + triggers + view | 152 | ✅ Well-designed |

### 1.2 Migration Application (from README.md)

```bash
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/001_create_extensions.sql
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/002_create_schema.sql
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/003_create_indexes.sql
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/004_create_embeddings.sql
```

**Verification Script**: `backend/scripts/verify-db.js` validates container, connectivity, pgvector, schema tables, embedding column, and indexes.

---

## 2. Phase 4 Embedding Migration Analysis (004_create_embeddings.sql)

### 2.1 Schema Created

```sql
-- Core embedding tables
embedding_metadata (id, entity_type, entity_id, model, model_version, provider, 
                    dimensions, version, source_text_hash, created_at, updated_at)
embeddings (id, metadata_id FK, embedding VECTOR(1536), created_at)
```

### 2.2 Key Features

| Feature | Implementation | Grade |
|---------|----------------|-------|
| **Entity Support** | opportunities, candidates, skills (extensible) | ✅ |
| **Metadata Tracking** | model, version, provider, dimensions, content hash | ✅ |
| **Versioning** | Incremental version per entity | ✅ |
| **Deduplication** | SHA256 content hash index | ✅ |
| **Vector Index** | IVFFlat with cosine_ops (lists=100) | ⚠️ Suboptimal |
| **HNSW Support** | Commented out (requires pgvector ≥ 0.5.0) | ⚠️ Not active |
| **Updated Trigger** | Auto-updates `updated_at` on metadata | ✅ |
| **Search View** | `embedding_search` joins metadata + vectors | ✅ |

### 2.3 Issues Found

| Issue | Severity | Description |
|-------|----------|-------------|
| **Hardcoded 1536 dimensions** | Medium | Migration hardcodes `VECTOR(1536)` but model may change; should be configurable |
| **IVFFlat over HNSW** | Medium | IVFFlat is older; HNSW provides better recall/performance for production |
| **No partition strategy** | Low | For large datasets, consider partitioning `embeddings` by `entity_type` or time |
| **Missing unique constraint** | Medium | `embedding_metadata` has unique on `(entity_type, entity_id, version)` but not on `(entity_type, entity_id, model, source_text_hash)` for true deduplication |
| **No retention policy** | Low | No automated cleanup of old embedding versions |

---

## 3. Schema Consistency with Domain Models

### 3.1 Mapping: Domain Models ↔ Database Tables

| Domain Model (shared/src/domain/) | Database Table | Consistency |
|-----------------------------------|----------------|-------------|
| `User` | `users` | ✅ Full match |
| `CandidateProfile` | `candidate_profiles` | ✅ Full match (JSONB for complex fields) |
| `Source` | `sources` | ✅ Full match |
| `Opportunity` | `opportunities` | ⚠️ **Missing `embedding` in domain model** |
| `OpportunityCategory` | `opportunity_categories` | ✅ Full match |
| `Skill` | `skills` | ⚠️ **Missing `embedding` in domain model** |
| `OpportunitySkill` | `opportunity_skills` | ✅ Full match |
| `EligibilityRequirement` | `eligibility_requirements` | ✅ Full match |
| `OpportunityEligibility` | `opportunity_eligibility` | ✅ Full match |
| `DuplicateGroup` | `duplicate_groups` | ✅ Full match |
| `DuplicateMember` | `duplicate_members` | ✅ Full match |
| `NewsItem` | `news_items` | ✅ Full match |
| `Event` | `events` | ✅ Full match |
| `Certification` | `certifications` | ✅ Full match |
| `Fellowship` | `fellowships` | ✅ Full match |
| `Notification` | `notifications` | ✅ Full match |
| `ApplicationReference` | `application_references` | ✅ Full match |
| `SystemConfiguration` | `system_configurations` | ✅ Full match |
| `BenchmarkSample` | `benchmark_samples` | ✅ Full match |
| `BenchmarkResult` | `benchmark_results` | ✅ Full match |

### 3.2 Critical Mismatches

| Domain | Database | Issue |
|--------|----------|-------|
| `Opportunity` interface | `opportunities` table | Domain lacks `embedding VECTOR(1536)` field |
| `Skill` interface | `skills` table | Domain lacks `embedding VECTOR(1536)` field |
| `CandidateProfile` interface | `candidate_profiles` table | Domain lacks `embedding VECTOR(1536)` field |

**Recommendation**: Add optional `embedding?: number[]` to domain models for type consistency, or document that embeddings are stored separately in `embeddings` table.

---

## 4. Indexes, Vector Dimensions, pgvector Extension

### 4.1 pgvector Extension

- **Migration 001**: `CREATE EXTENSION IF NOT EXISTS vector;`
- **Migration 004**: Repeats extension creation (idempotent)
- **Verification**: `verify-db.js` checks `pg_extension` for `vector`
- **Status**: ✅ Properly configured

### 4.2 Vector Dimensions

| Table/Column | Dimension | Configurable? |
|--------------|-----------|---------------|
| `opportunities.embedding` | 1536 | ❌ Hardcoded |
| `candidate_profiles.embedding` | 1536 | ❌ Hardcoded |
| `skills.embedding` | 1536 | ❌ Hardcoded |
| `embeddings.embedding` | 1536 | ❌ Hardcoded in DDL |

**Issue**: All vector columns hardcode 1536 (text-embedding-3-small). If switching models (e.g., text-embedding-3-large at 3072), migrations must be re-run with `ALTER TABLE ... ALTER COLUMN ... TYPE VECTOR(3072)`.

### 4.3 Index Analysis

| Index | Table | Type | Columns | Quality |
|-------|-------|------|---------|---------|
| `idx_opportunities_embedding` | opportunities | IVFFlat | embedding | ⚠️ lists=100 (tune for dataset size) |
| `idx_candidate_profiles_embedding` | candidate_profiles | IVFFlat | embedding | ⚠️ Same |
| `idx_skills_embedding` | skills | IVFFlat | embedding | ⚠️ Same |
| `idx_embeddings_vector_ivfflat` | embeddings | IVFFlat | embedding | ⚠️ Same |
| `idx_embeddings_vector_hnsw` | embeddings | HNSW | embedding | ❌ Commented out |

**Recommendation**: 
- Use HNSW for production (`m=16, ef_construction=64`)
- Tune `lists` parameter based on row count (rule: `lists = rows / 1000` for IVFFlat)
- Consider partial indexes for active opportunities only

### 4.4 Missing Indexes

| Table | Missing Index | Rationale |
|-------|---------------|-----------|
| `embedding_metadata` | `(entity_type, entity_id, model, source_text_hash)` | True deduplication key |
| `opportunities` | `(status, application_deadline)` WHERE status='OPEN' | Active opportunity queries |
| `candidate_profiles` | `(user_id, updated_at)` | Profile sync queries |

---

## 5. Connection Pooling & Transactions

### 5.1 Connection Pool Usage

**Files using `pg.Pool`**:
- `backend/src/intelligence/embeddings/embedding-store.ts` - Creates new client per operation
- `backend/src/intelligence/embeddings/real-embedding-service.ts` - Accepts pool in options
- `backend/src/intelligence/candidate/real-candidate-intelligence.ts` - Accepts pool
- `backend/src/intelligence/candidate/candidate-embedder.ts` - Accepts pool

### 5.2 Transaction Patterns

| File | Pattern | Quality |
|------|---------|---------|
| `embedding-store.ts:insert()` | `BEGIN` → metadata insert → vector insert → `COMMIT` / `ROLLBACK` | ✅ Correct |
| `embedding-store.ts:insertBatch()` | Single transaction for entire batch | ✅ Correct |
| `opportunity-persister.ts` | **No transactions** - uses in-memory Map | ❌ Not production-ready |
| `version-manager.ts` | In-memory only, no DB | ❌ Not production-ready |

### 5.3 Connection Pool Configuration

**Not Found**: No centralized pool configuration (max connections, idle timeout, etc.). Each service creates/receives pool independently.

**Recommendation**: Create a centralized database module:
```typescript
// backend/src/db/pool.ts
import { Pool } from 'pg';

export const createPool = () => new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## 6. Migration Reproducibility

### 6.1 Current State

| Aspect | Status |
|--------|--------|
| **Idempotent migrations** | ✅ All use `IF NOT EXISTS` |
| **Extension handling** | ✅ `IF NOT EXISTS` in 001 and 004 |
| **Column additions** | ✅ DO blocks with existence checks in 004 |
| **Rollback scripts** | ❌ Not provided |
| **Migration ordering** | ✅ Numeric prefix (001-004) |
| **Schema version tracking** | ❌ No migration history table |

### 6.2 Reproducibility Issues

1. **No migration tracking table** - Cannot determine applied migrations
2. **No rollback procedures** - Cannot safely revert
3. **Hardcoded dimensions** - Schema changes needed for model updates
4. **No seeding strategy** - Reference data (categories, sources) not managed

### 6.3 Recommendation

Add a migration tracking table:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64)
);
```

---

## 7. Persistence Paths: Discovery & Intelligence

### 7.1 Discovery Pipeline Persistence Flow

```
DiscoveryPipeline.run()
  → CollectionOrchestrator → RawDocuments (in-memory)
  → ExtractionEngine → ExtractionResults (in-memory)
  → NormalizationEngine → NormalizedOpportunity[] (in-memory)
  → ValidationEngine → ValidationResult[] (in-memory)
  → DeduplicationEngine → DuplicateCandidate[] (in-memory)
  → FreshnessEngine → ChangeDetectionResult[] (in-memory)
  → VersionManager.createVersion() → **In-memory Map only** ❌
  → OpportunityPersister.persist() → **In-memory Map only** ❌
```

### 7.2 Intelligence Pipeline Persistence Flow

```
RealEmbeddingService.generate()
  → EmbeddingStore.insert() → **PostgreSQL (pgvector)** ✅
  → EmbeddingStore.similaritySearch() → **PostgreSQL (pgvector)** ✅
```

### 7.3 Gap Analysis

| Component | Current Persistence | Required | Gap |
|-----------|---------------------|----------|-----|
| Raw Documents | In-memory (Map) | PostgreSQL | ❌ |
| Extraction Results | In-memory | PostgreSQL | ❌ |
| Normalized Opportunities | In-memory → PostgreSQL (via persister stub) | PostgreSQL | ⚠️ Stub only |
| Validation Results | In-memory | PostgreSQL | ❌ |
| Deduplication Results | In-memory | PostgreSQL | ❌ |
| Freshness Checks | In-memory | PostgreSQL | ❌ |
| Version History | In-memory (Map) | PostgreSQL (opportunity_versions) | ❌ |
| Embeddings | PostgreSQL (embeddings + embedding_metadata) | PostgreSQL | ✅ |

---

## 8. In-Memory Persistence That Should Be PostgreSQL

### 8.1 Critical (Production Blockers)

| Service | File | In-Memory Structure | Target Table |
|---------|------|---------------------|--------------|
| **OpportunityPersister** | `opportunity-persister.ts` | `sourceIdMap`, mock DB ops | `opportunities`, `opportunity_versions`, `sources` |
| **VersionManager** | `version-manager.ts` | `versions: Map<opportunityId, OpportunityVersion[]>`, `meta: Map<opportunityId, OpportunityLifecycleMeta>` | `opportunity_versions`, `opportunities` (lifecycle fields) |
| **RunPersistence** | `run-persistence.ts` | `InMemoryRunPersistence.store: Map<runId, DiscoveryRunRecord>` | New table: `discovery_runs` |
| **SourceRegistry** | `source-registry.service.ts` | `InMemorySourceRegistryService.store: Map<sourceId, SourceRegistryEntry>` | `sources` (already exists) |

### 8.2 High Priority

| Service | File | In-Memory Structure | Target Table |
|---------|------|---------------------|--------------|
| **EmbeddingService** | `embedding-service.ts` | `InMemoryMetadataStore.store: Map<key, EmbeddingMetadata[]>` | `embedding_metadata` |
| **DiscoveryEngine** | `discovery-engine.ts` | `jobs: Map<jobId, DiscoveryJob>`, `runs: Map<runId, DiscoveryRun>` | `discovery_jobs`, `discovery_runs` |
| **TaxonomyService** | `taxonomy-service.ts` | `cache: Map<fileName, TaxonomyFile>` | `system_configurations` or new `taxonomy_cache` |

### 8.3 Medium Priority (Caching - Acceptable with TTL)

| Service | File | In-Memory Structure | Notes |
|---------|------|---------------------|-------|
| **CircuitBreaker** | `circuit-breaker.ts` | `breakers: Map<key, CircuitBreaker>` | Runtime state, OK in memory with persistence for recovery |
| **RateLimiter** | `rate-limiter.ts` | `limiters: Map<key, TokenBucketRateLimiter>` | Runtime state |
| **Observability** | `observability.ts` | `InMemoryStore` | Metrics buffer, flush to DB periodically |

---

## 9. Embedding Cache Persistence

### 9.1 Current Implementation

**Cache Layer**: `RealEmbeddingService` uses `EmbeddingStore.findByContentHash()` for caching

```typescript
// real-embedding-service.ts:223-228
if (this.enableCache && !forceRegenerate) {
  const cached = await this.store.findByContentHash(sourceHash, this.modelId);
  if (cached) return cached;
}
```

**Storage**: `embedding_metadata.source_text_hash` + `embeddings.embedding`

### 9.2 Cache Effectiveness

| Metric | Status |
|--------|--------|
| **Cache Key** | SHA256(text) + model ID ✅ |
| **Cache Hit Path** | `findByContentHash()` → single query ✅ |
| **Cache Invalidation** | None (no TTL, no explicit invalidation) ⚠️ |
| **Cache Size Limit** | None (unbounded growth) ⚠️ |
| **Cross-process Sharing** | Yes (PostgreSQL-backed) ✅ |

### 9.3 Issues

1. **No TTL/Expiration**: Embeddings never expire; stale embeddings persist after model updates
2. **No Size Limits**: Unbounded growth in `embeddings` table
3. **No Cache Warming**: No pre-computation strategy
4. **Model Version Not in Cache Key**: If model version changes, old embeddings still returned (though `modelVersion` is in metadata)

### 9.4 Recommendations

```sql
-- Add TTL support
ALTER TABLE embedding_metadata ADD COLUMN expires_at TIMESTAMPTZ;

-- Add index for cleanup
CREATE INDEX idx_embedding_metadata_expires ON embedding_metadata (expires_at) WHERE expires_at IS NOT NULL;

-- Periodic cleanup job
DELETE FROM embedding_metadata WHERE expires_at < NOW();
```

---

## 10. Consolidated Findings & Recommendations

### 10.1 Critical (Must Fix Before Production)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Replace `OpportunityPersister` in-memory stub with real PostgreSQL implementation | High | Data loss on restart, no durability |
| 2 | Replace `VersionManager` in-memory Maps with `opportunity_versions` table | Medium | Version history lost |
| 3 | Replace `InMemoryRunPersistence` with PostgreSQL `discovery_runs` table | Medium | No run history, no audit trail |
| 4 | Replace `InMemorySourceRegistryService` with `sources` table | Low | Source config lost on restart |
| 5 | Add centralized connection pool with proper config | Medium | Connection exhaustion, no monitoring |

### 10.2 High Priority

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 6 | Replace `InMemoryMetadataStore` with `PgVectorMetadataStore` implementation | Medium | Embedding metadata not durable |
| 7 | Migrate `DiscoveryEngine` jobs/runs to PostgreSQL | Medium | No job scheduling persistence |
| 8 | Add migration tracking table (`schema_migrations`) | Low | Cannot track schema version |
| 9 | Switch vector indexes from IVFFlat to HNSW | Low | Better search performance/recall |
| 10 | Make vector dimensions configurable (not hardcoded 1536) | Medium | Model upgrade requires migration |

### 10.3 Medium Priority

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 11 | Add embedding cache TTL and cleanup job | Low | Storage growth, stale embeddings |
| 12 | Add composite unique index for true embedding deduplication | Low | Duplicate embeddings waste space |
| 13 | Add `embedding` field to domain models (optional) | Low | Type consistency |
| 14 | Add partition strategy for `embeddings` table | Medium | Scale beyond 10M vectors |
| 15 | Implement `PgVectorMetadataStore` fully (currently throws) | Medium | Metadata store interface incomplete |

### 10.4 Low Priority

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 16 | Add rollback migrations for each forward migration | Medium | Safe rollback capability |
| 17 | Add seeding migrations for reference data (categories, default sources) | Low | Consistent environments |
| 18 | Add database-level constraints for enums (status, deadline_type) | Low | Data integrity |
| 19 | Add advisory lock mechanism for migration execution | Low | Prevent concurrent migrations |
| 20 | Document connection pool sizing guidelines | Low | Operational knowledge |

---

## 11. Schema Evolution Strategy

### 11.1 For Model Dimension Changes

```sql
-- When upgrading from 1536 to 3072 dimensions:
-- 1. Add new column
ALTER TABLE opportunities ADD COLUMN embedding_new VECTOR(3072);
ALTER TABLE candidate_profiles ADD COLUMN embedding_new VECTOR(3072);
ALTER TABLE skills ADD COLUMN embedding_new VECTOR(3072);
ALTER TABLE embeddings ADD COLUMN embedding_new VECTOR(3072);

-- 2. Backfill (async, batched)
UPDATE opportunities SET embedding_new = generate_new_embedding(text) WHERE embedding IS NOT NULL;

-- 3. Swap (with brief lock)
BEGIN;
ALTER TABLE opportunities RENAME COLUMN embedding TO embedding_old;
ALTER TABLE opportunities RENAME COLUMN embedding_new TO embedding;
-- Recreate indexes
COMMIT;

-- 4. Drop old after verification
ALTER TABLE opportunities DROP COLUMN embedding_old;
```

### 11.2 For New Embedding Models

```sql
-- Add model_version to embedding_metadata (already exists)
-- Use partial indexes per model
CREATE INDEX idx_embeddings_model_v2 ON embeddings USING hnsw (embedding vector_cosine_ops)
WHERE metadata_id IN (SELECT id FROM embedding_metadata WHERE model = 'text-embedding-3-large');
```

---

## 12. Verification Checklist

Run these checks before production deployment:

- [ ] All migrations apply cleanly to empty database
- [ ] `verify-db.js` passes all checks
- [ ] `OpportunityPersister` uses real PostgreSQL (no in-memory Maps)
- [ ] `VersionManager` reads/writes `opportunity_versions` table
- [ ] `RunPersistence` uses PostgreSQL table
- [ ] `SourceRegistryService` uses `sources` table
- [ ] `EmbeddingService` uses `PgVectorMetadataStore` (not `InMemoryMetadataStore`)
- [ ] Connection pool configured with monitoring
- [ ] Vector indexes are HNSW (not IVFFlat) for production
- [ ] Embedding cache has TTL and cleanup job
- [ ] Migration tracking table exists and populated
- [ ] Rollback scripts tested for each migration
- [ ] Domain models updated with optional embedding fields

---

## Appendix: Table Inventory

### Core Tables (26 from migration 002)

| Table | Rows Est. | Purpose |
|-------|-----------|---------|
| users | ~100 | Authentication |
| candidate_profiles | ~100 | Candidate data |
| sources | ~20 | Data sources |
| opportunity_categories | ~50 | Taxonomy |
| **opportunities** | **~100K** | **Core entity** |
| opportunity_versions | ~500K | Version history |
| skills | ~1K | Skill taxonomy |
| opportunity_skills | ~500K | Many-to-many |
| eligibility_requirements | ~100 | Requirements |
| opportunity_eligibility | ~500K | Requirements per opp |
| duplicate_groups | ~10K | Deduplication |
| duplicate_members | ~50K | Deduplication |
| news_items | ~10K | News feed |
| events | ~1K | Events |
| certifications | ~500 | Certifications |
| fellowships | ~200 | Fellowships |
| notifications | ~10K | User notifications |
| notification_history | ~50K | Delivery tracking |
| application_references | ~1K | Applications |
| system_configurations | ~50 | Config |
| benchmark_samples | ~100 | Evaluation |
| benchmark_results | ~1K | Evaluation |

### Embedding Tables (2 from migration 004)

| Table | Rows Est. | Purpose |
|-------|-----------|---------|
| embedding_metadata | ~100K | Metadata per embedding |
| embeddings | ~100K | Vector storage |

---

*End of Report*
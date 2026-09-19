# Phase 6: API Contract Audit

**Repository:** AutomatedOpportunityWorkflow  
**Date:** 2026-09-18  
**Auditor:** Subagent A - API Contract Auditor  
**Status:** DRAFT

---

## Executive Summary

This audit compares the **required HTTP REST endpoints** for the n8n integration architecture (as specified in Phase 6 instructions) against the **existing TypeScript class APIs** and backend implementations.

### Key Findings

| Category | Required Endpoints | Existing Class APIs | HTTP Routes (Express) |
|----------|-------------------|---------------------|----------------------|
| Discovery | 6 | 4 (DiscoveryEngine, PipelineOrchestrator, RunCoordinator) | **0** (MISSING) |
| Opportunity | 8 | 1 (OpportunityPersister - partial) | **0** (MISSING) |
| Matches | 4 | 3 (MatchingEngine, ScoringEngine, RankingEngine interfaces) | **0** (MISSING) |
| Deadlines | 3 | 1 (VerificationEngine - partial) | **0** (MISSING) |
| Verification/Reprocessing | 4 | 1 (VerificationEngine) | **0** (MISSING) |
| News | 4 | 0 (NewsItem domain model only) | **0** (MISSING) |
| Applications | 5 | 0 (ApplicationReference domain model only) | **0** (MISSING) |
| Health/Ready | 2 | 0 | **0** (MISSING) |
| Webhooks (n8n callbacks) | 4 | 0 | **0** (MISSING) |
| **TOTAL** | **40** | **~12 partial** | **0** |

**Critical Gap:** The backend has **zero HTTP routes**. `backend/src/index.ts` exports only an empty object. All existing functionality is exposed as **TypeScript class APIs** (library-style), not as REST endpoints.

---

## 1. Required Endpoints (from Phase 6 Instructions)

The Phase 6 instructions specify the following endpoint groups for n8n integration:

### 1.1 Discovery Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/discovery/runs` | Create a discovery run |
| GET | `/api/v1/discovery/runs/:runId` | Get run status |
| GET | `/api/v1/discovery/runs/:runId/results` | Get run results (discovered opportunities) |
| POST | `/api/v1/discovery/jobs` | Create a discovery job (template) |
| GET | `/api/v1/discovery/jobs/:jobId` | Get job details |
| POST | `/api/v1/discovery/jobs/:jobId/execute` | Execute a job (create run) |

### 1.2 Opportunity Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/opportunities` | Create opportunity |
| GET | `/api/v1/opportunities` | List opportunities (with filters) |
| GET | `/api/v1/opportunities/:id` | Get opportunity by ID |
| PATCH | `/api/v1/opportunities/:id` | Update opportunity |
| DELETE | `/api/v1/opportunities/:id` | Delete opportunity |
| GET | `/api/v1/opportunities/:id/intelligence` | Get intelligence for opportunity |
| GET | `/api/v1/opportunities/:id/matches` | Get candidate matches for opportunity |
| GET | `/api/v1/opportunities/:id/versions` | Get opportunity version history |

### 1.3 Matches Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/matches` | Create match (run matching for candidate) |
| GET | `/api/v1/matches` | List matches (with filters) |
| GET | `/api/v1/matches/:id` | Get match details |
| GET | `/api/v1/candidates/:candidateId/matches` | Get matches for a candidate |

### 1.4 Deadlines Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/deadlines` | List upcoming deadlines |
| GET | `/api/v1/deadlines/:id` | Get deadline details |
| GET | `/api/v1/opportunities/:id/deadline` | Get deadline for specific opportunity |

### 1.5 Verification/Reprocessing Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/verification` | Trigger verification run |
| GET | `/api/v1/verification/:runId` | Get verification status |
| POST | `/api/v1/reprocessing` | Trigger reprocessing |
| GET | `/api/v1/reprocessing/:runId` | Get reprocessing status |

### 1.6 News Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/news` | Create news item |
| GET | `/api/v1/news` | List news (with filters) |
| GET | `/api/v1/news/:id` | Get news item |
| GET | `/api/v1/news/:id/opportunities` | Get related opportunities |

### 1.7 Applications Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/applications` | Create application tracking |
| GET | `/api/v1/applications` | List applications |
| GET | `/api/v1/applications/:id` | Get application |
| PATCH | `/api/v1/applications/:id` | Update application status |
| GET | `/api/v1/candidates/:candidateId/applications` | Get applications for candidate |

### 1.8 Health/Ready Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness probe |
| GET | `/ready` | Readiness probe |

### 1.9 Webhook Endpoints (n8n Callbacks)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/webhooks/discovery/complete` | n8n callback: discovery complete |
| POST | `/webhooks/intelligence/complete` | n8n callback: intelligence pipeline complete |
| POST | `/api/v1/webhooks/verification/complete` | n8n callback: verification complete |
| POST | `/api/v1/webhooks/reprocessing/complete` | n8n callback: reprocessing complete |

---

## 2. Existing TypeScript Class APIs

### 2.1 Discovery Module (`backend/src/discovery/`)

| Class | File | Methods | Maps to HTTP Endpoint |
|-------|------|---------|----------------------|
| **DiscoveryEngine** | `discovery-engine.ts` | `createJob()`, `executeJob()`, `getRunStatus()`, `getJob()` | POST `/jobs`, POST `/jobs/:id/execute`, GET `/runs/:id`, GET `/jobs/:id` |
| **PipelineOrchestrator** | `pipeline-orchestrator.ts` | `run()` | Internal (called by DiscoveryEngine) |
| **RunCoordinator** | `run-management/run-coordinator.ts` | `scheduleRun()`, `startRun()`, `cancelRun()`, `getRunStatus()`, `pollRunStatus()`, `pauseRun()`, `resumeRun()` | POST `/runs`, POST `/runs/:id/start`, POST `/runs/:id/cancel`, GET `/runs/:id`, GET `/runs/:id/poll` |
| **CollectionOrchestrator** | `collection/collection-orchestrator.ts` | `execute()` | Internal |
| **ExtractionEngine** | `extraction/extraction-engine.ts` | `extract()` | Internal |
| **NormalizationEngine** | `normalization/normalization-engine.ts` | `normalize()` | Internal |
| **ValidationEngine** | `validation/validation-engine.ts` | `validate()` | Internal |
| **DedupEngine** | `deduplication/dedup-engine.ts` | `deduplicate()` | Internal |
| **FreshnessEngine** | `freshness/freshness-engine.ts` | `check()`, `verify()` | GET `/opportunities/:id/freshness` (not required) |
| **VerificationEngine** | `freshness/verification-engine.ts` | `verify()`, `verifyBatch()`, `verifyDeadline()` | POST `/verification`, GET `/verification/:id` |
| **VersionManager** | `versioning/version-manager.ts` | `createVersion()`, `getLifecycle()` | GET `/opportunities/:id/versions` |
| **DiscoveryStrategyEngine** | `strategy/discovery-strategy-engine.ts` | `generateQueryPlan()`, `generateQueriesFromTaxonomy()` | Internal |

**Assessment:** The Discovery module has **rich class APIs** that map well to required endpoints. However, they are **not exposed via HTTP**.

### 2.2 Intelligence Module (`backend/src/intelligence/`)

| Interface/Class | File | Methods | Maps to HTTP Endpoint |
|-----------------|------|---------|----------------------|
| **Classifier** | `contracts.ts` | `classify()` | Internal (pipeline stage) |
| **EligibilityEngine** | `contracts.ts` | `assess()` | Internal |
| **MatchingEngine** | `contracts.ts` | `match()` | POST `/matches`, GET `/candidates/:id/matches` |
| **ScoringEngine** | `contracts.ts` | `score()` | Internal |
| **RankingEngine** | `contracts.ts` | `rank()` | Internal |
| **ExplanationEngine** | `contracts.ts` | `explain()` | GET `/opportunities/:id/intelligence` |
| **IntelligencePipeline** | `pipeline/real-pipeline.ts` | `run()`, `initialize()`, `shutdown()` | POST `/intelligence/runs` (not explicitly required) |
| **SemanticMatchingEngine** | `matching/semantic-matching-engine.ts` | `match()` | POST `/matches` |
| **ScoringEngine** | `scoring/scoring-engine.ts` | `score()` | Internal |
| **RankingEngine** | `ranking/ranking-engine.ts` | `rank()` | Internal |
| **ExplanationEngine** | `explanation/explanation-engine.ts` | `explain()` | GET `/opportunities/:id/intelligence` |
| **EligibilityEngine** | `eligibility/eligibility-engine.ts` | `assess()` | Internal |
| **RequirementIntelligenceEngine** | `requirements/requirement-intelligence-engine.ts` | `extract()` | Internal |
| **CandidateIntelligenceBuilder** | `candidate/candidate-intelligence-builder.ts` | `build()` | Internal |
| **ValueAssessmentEngine** | `value/value-assessment-engine.ts` | `assess()` | Internal |
| **TimingIntelligenceEngine** | `timing/timing-intelligence-engine.ts` | `analyze()` | GET `/opportunities/:id/deadline` |

**Assessment:** Intelligence module exposes **interfaces** (contracts) but concrete implementations are internal pipeline stages. No direct HTTP mapping exists.

### 2.3 Persistence Layer

| Class | File | Methods | Maps to HTTP Endpoint |
|-------|------|---------|----------------------|
| **OpportunityPersister** | `persistence/opportunity-persister.ts` | `persist()` | POST `/opportunities` (bulk), PUT `/opportunities/:id` |
| **SourceRegistryService** | `registry/source-registry.service.ts` | `register()`, `get()`, `list()` | Internal |

**Assessment:** Only `OpportunityPersister` provides write capability, but it's a **bulk persistence** method, not CRUD.

### 2.4 Domain Models (Shared)

| Model | File | Fields | Used By |
|-------|------|--------|---------|
| **Opportunity** | `shared/src/domain/opportunity.ts` | 25 fields | All modules |
| **OpportunityCategory** | `shared/src/domain/opportunity.ts` | 4 fields | Discovery, Intelligence |
| **CandidateProfile** | `shared/src/domain/candidate.ts` | 18 fields | Intelligence, Matching |
| **ApplicationReference** | `shared/src/domain/application.ts` | 11 fields | **No backend implementation** |
| **NewsItem** | `shared/src/domain/news.ts` | 16 fields | **No backend implementation** |
| **Education/Experience/Project** | `shared/src/domain/candidate.ts` | Nested types | CandidateProfile |

**Assessment:** Domain models exist for Applications and News, but **no backend services** implement CRUD for them.

---

## 3. Existing HTTP Server/Routes

### 3.1 Current State

**File:** `backend/src/index.ts`
```typescript
export {};
```

**Status:** **COMPLETELY EMPTY** - No Express app, no routes, no middleware, no server startup.

### 3.2 Dependencies Available

`backend/package.json` includes:
- `express: ^4.18.2`
- `@types/express: ^4.17.21`
- `tsx` for development
- `typescript` for compilation

**Express is available but unused.**

---

## 4. Detailed Gap Analysis

### 4.1 Discovery Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/api/v1/discovery/runs` | **MISSING** | `RunCoordinator.scheduleRun()` | Express route → RunCoordinator | RunCoordinator, RunPersistence | LOW - Direct mapping exists |
| GET `/api/v1/discovery/runs/:runId` | **MISSING** | `RunCoordinator.getRunStatus()` | Express route → RunCoordinator | RunCoordinator | LOW |
| GET `/api/v1/discovery/runs/:runId/results` | **MISSING** | `DiscoveryRunRecord.metrics.itemsDiscovered` (count only) | Express route → RunCoordinator + Opportunity query | RunCoordinator, DB query for opportunities | MEDIUM - Need to link run to discovered opportunities |
| POST `/api/v1/discovery/jobs` | **MISSING** | `DiscoveryEngine.createJob()` | Express route → DiscoveryEngine | DiscoveryEngine, SourceRegistry | LOW |
| GET `/api/v1/discovery/jobs/:jobId` | **MISSING** | `DiscoveryEngine.getJob()` | Express route → DiscoveryEngine | DiscoveryEngine | LOW |
| POST `/api/v1/discovery/jobs/:jobId/execute` | **MISSING** | `DiscoveryEngine.executeJob()` | Express route → DiscoveryEngine | DiscoveryEngine, PipelineOrchestrator | LOW |

**Discovery Notes:**
- `DiscoveryEngine` requires `sourceRegistryService` and `adapterFactory` at construction
- `RunCoordinator` uses in-memory persistence by default; needs DB persistence for production
- Run results need to be linked to persisted opportunities (currently only count in metrics)

### 4.2 Opportunity Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/api/v1/opportunities` | **MISSING** | `OpportunityPersister.persist()` (bulk only) | Express route → New OpportunityService with single create | OpportunityPersister, DB | HIGH - Need single-opportunity CRUD service |
| GET `/api/v1/opportunities` | **MISSING** | None | Express route → OpportunityService.list() with filters | DB, Query builder | HIGH - No query/list implementation |
| GET `/api/v1/opportunities/:id` | **MISSING** | None | Express route → OpportunityService.getById() | DB | HIGH |
| PATCH `/api/v1/opportunities/:id` | **MISSING** | None | Express route → OpportunityService.update() | DB, VersionManager | HIGH |
| DELETE `/api/v1/opportunities/:id` | **MISSING** | None | Express route → OpportunityService.delete() | DB | MEDIUM |
| GET `/api/v1/opportunities/:id/intelligence` | **MISSING** | IntelligencePipeline.run() (full pipeline) | Express route → IntelligenceService.getIntelligence() | IntelligencePipeline, EmbeddingStore | HIGH - Pipeline is heavy; need cached intelligence |
| GET `/api/v1/opportunities/:id/matches` | **MISSING** | MatchingEngine.match() (single) | Express route → MatchService.getMatchesForOpportunity() | MatchingEngine, Candidate DB | HIGH - Need candidate context |
| GET `/api/v1/opportunities/:id/versions` | **MISSING** | `VersionManager.getLifecycle()` | Express route → VersionManager | VersionManager | LOW |

**Opportunity Notes:**
- **Major Gap:** No `OpportunityService` exists for CRUD operations
- `OpportunityPersister` only does bulk upsert from normalized data
- Intelligence is computed on-demand via pipeline; no cached intelligence store
- Matches require candidate context; no candidate management API exists

### 4.3 Matches Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/api/v1/matches` | **MISSING** | `SemanticMatchingEngine.match()` + `ScoringEngine` + `RankingEngine` | Express route → MatchService.createMatchesForCandidate() | CandidateProfile, Opportunity embeddings, pgvector | HIGH - Requires candidate + embedding infrastructure |
| GET `/api/v1/matches` | **MISSING** | None | Express route → MatchService.list() | DB (match persistence needed) | HIGH - No match persistence layer |
| GET `/api/v1/matches/:id` | **MISSING** | None | Express route → MatchService.getById() | DB | HIGH |
| GET `/api/v1/candidates/:candidateId/matches` | **MISSING** | None | Express route → MatchService.getForCandidate() | DB, CandidateProfile | HIGH - No candidate API |

**Matches Notes:**
- Matching engine exists but requires **pgvector** for embeddings
- No persistence layer for matches (CandidateMatch type exists but no repository)
- No candidate management API (create/get candidate profiles)
- Intelligence pipeline produces matches but doesn't persist them

### 4.4 Deadlines Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| GET `/api/v1/deadlines` | **MISSING** | `TimingIntelligenceEngine.analyze()` (single) | Express route → DeadlineService.listUpcoming() | DB query with deadline filters | MEDIUM |
| GET `/api/v1/deadlines/:id` | **MISSING** | None | Express route → DeadlineService.getById() | DB | MEDIUM |
| GET `/api/v1/opportunities/:id/deadline` | **MISSING** | `TimingIntelligenceEngine.analyze()` | Express route → TimingIntelligenceEngine | OpportunityService, TimingIntelligenceEngine | LOW |

**Deadlines Notes:**
- `TimingIntelligenceEngine` exists and provides deadline analysis
- No deadline-specific persistence or query service
- Can be derived from opportunity data + timing intelligence

### 4.5 Verification/Reprocessing Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/api/v1/verification` | **MISSING** | `VerificationEngine.verifyBatch()` | Express route → VerificationService.trigger() | VerificationEngine, Opportunity query | LOW |
| GET `/api/v1/verification/:runId` | **MISSING** | None | Express route → VerificationService.getStatus() | RunCoordinator or new VerificationRun persistence | MEDIUM - Need run tracking |
| POST `/api/v1/reprocessing` | **MISSING** | None (would re-run IntelligencePipeline) | Express route → ReprocessingService.trigger() | IntelligencePipeline, Opportunity query | MEDIUM |
| GET `/api/v1/reprocessing/:runId` | **MISSING** | None | Express route → ReprocessingService.getStatus() | Run tracking | MEDIUM |

**Verification Notes:**
- `VerificationEngine` exists and works on `NormalizedOpportunity[]`
- No verification run persistence or tracking
- Reprocessing would re-run intelligence pipeline on existing opportunities

### 4.6 News Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/api/v1/news` | **MISSING** | None (NewsItem model only) | Express route → NewsService.create() | DB, NewsItem model | HIGH - No service at all |
| GET `/api/v1/news` | **MISSING** | None | Express route → NewsService.list() | DB | HIGH |
| GET `/api/v1/news/:id` | **MISSING** | None | Express route → NewsService.getById() | DB | HIGH |
| GET `/api/v1/news/:id/opportunities` | **MISSING** | None | Express route → NewsService.getRelatedOpportunities() | DB, NewsItem.relatedOpportunityIds | HIGH |

**News Notes:**
- Only domain model (`NewsItem`) exists in shared types
- **Zero backend implementation** for news management
- No news collection, ingestion, or persistence

### 4.7 Applications Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/api/v1/applications` | **MISSING** | None (ApplicationReference model only) | Express route → ApplicationService.create() | DB, ApplicationReference model | HIGH - No service at all |
| GET `/api/v1/applications` | **MISSING** | None | Express route → ApplicationService.list() | DB | HIGH |
| GET `/api/v1/applications/:id` | **MISSING** | None | Express route → ApplicationService.getById() | DB | HIGH |
| PATCH `/api/v1/applications/:id` | **MISSING** | None | Express route → ApplicationService.update() | DB | HIGH |
| GET `/api/v1/candidates/:candidateId/applications` | **MISSING** | None | Express route → ApplicationService.getForCandidate() | DB, Candidate API | HIGH - No candidate API |

**Applications Notes:**
- Only domain model (`ApplicationReference`) exists
- **Zero backend implementation** for application tracking
- Requires candidate management (which doesn't exist)

### 4.8 Health/Ready Endpoints

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| GET `/health` | **MISSING** | None | Express route → basic liveness check | None | LOW |
| GET `/ready` | **MISSING** | None | Express route → check DB, pgvector, model service | DB pool, pgvector, UnifiedModelService | MEDIUM |

**Health Notes:**
- Trivial to implement
- Readiness should verify critical dependencies

### 4.9 Webhook Endpoints (n8n Callbacks)

| Endpoint | Status | Existing Implementation | Required Implementation | Dependencies | Risk |
|----------|--------|------------------------|------------------------|--------------|------|
| POST `/webhooks/discovery/complete` | **MISSING** | None | Express route → DiscoveryWebhookHandler | RunCoordinator, signature verification | MEDIUM |
| POST `/webhooks/intelligence/complete` | **MISSING** | None | Express route → IntelligenceWebhookHandler | IntelligencePipeline, signature verification | MEDIUM |
| POST `/api/v1/webhooks/verification/complete` | **MISSING** | None | Express route → VerificationWebhookHandler | VerificationEngine, signature verification | MEDIUM |
| POST `/api/v1/webhooks/reprocessing/complete` | **MISSING** | None | Express route → ReprocessingWebhookHandler | IntelligencePipeline, signature verification | MEDIUM |

**Webhook Notes:**
- **Zero implementation**
- Need signature verification (HMAC) for security
- Need idempotency handling
- Should update run status and trigger downstream workflows

---

## 5. Architectural Dependencies

### 5.1 Required Infrastructure (Not Yet Implemented)

| Component | Status | Notes |
|-----------|--------|-------|
| **Express Application** | MISSING | Need `src/app.ts` with middleware, routing, error handling |
| **Database Layer** | PARTIAL | `OpportunityPersister` has mock DB; needs real pg/Drizzle setup |
| **pgvector** | MISSING | Required for embeddings/matching; no connection pool |
| **UnifiedModelService** | EXISTS | In `shared/src/models/unified-service.ts`; needs initialization |
| **Candidate Management** | MISSING | No API or service for candidate profiles |
| **Authentication/Authorization** | MISSING | Required for candidate-scoped endpoints |
| **Request Validation** | MISSING | Need Zod/Joi schemas for all endpoints |
| **OpenAPI/Swagger** | MISSING | Required for n8n integration documentation |

### 5.2 Service Layer Gap

The codebase follows a **library pattern** (TypeScript classes) rather than a **service pattern** (HTTP endpoints). To expose via REST, a **Service Layer** is needed:

```
HTTP Routes → Service Classes → Domain Classes (existing) → Persistence
```

**Missing Services:**
- `DiscoveryService` (wraps DiscoveryEngine, RunCoordinator)
- `OpportunityService` (CRUD + intelligence + matches)
- `MatchService` (matching orchestration + persistence)
- `DeadlineService` (deadline queries)
- `VerificationService` (verification run management)
- `ReprocessingService` (reprocessing run management)
- `NewsService` (CRUD)
- `ApplicationService` (CRUD)
- `CandidateService` (CRUD - prerequisite for matches/applications)
- `HealthService` (liveness/readiness)
- `WebhookService` (n8n callback handling)

---

## 6. Risk Assessment

### 6.1 HIGH Risk Items

| Item | Reason |
|------|--------|
| **Zero HTTP routes** | Entire API surface missing; blocker for n8n integration |
| **No OpportunityService** | Core domain entity has no CRUD API |
| **No Match persistence** | Matches computed but not stored; can't query history |
| **No CandidateService** | Prerequisite for matches, applications, personalized intelligence |
| **No News/Application services** | Domain models exist but zero backend implementation |
| **No authentication** | Required for candidate-scoped endpoints |

### 6.2 MEDIUM Risk Items

| Item | Reason |
|------|--------|
| **Run persistence** | `RunCoordinator` uses in-memory; needs DB for production |
| **Intelligence caching** | Pipeline runs on-demand; no cached intelligence for fast GET |
| **Verification run tracking** | Engine exists but no run persistence |
| **Webhook security** | Need HMAC verification, idempotency keys |
| **Database layer** | Mock implementations only; needs Drizzle/pg setup |

### 6.3 LOW Risk Items

| Item | Reason |
|------|--------|
| **Health endpoints** | Trivial to implement |
| **Discovery run status** | Direct mapping to `RunCoordinator` |
| **Job management** | Direct mapping to `DiscoveryEngine` |
| **Version history** | Direct mapping to `VersionManager` |

---

## 7. Recommended Implementation Order

### Phase 6A: Foundation (Week 1)
1. Create Express app (`src/app.ts`, `src/index.ts`)
2. Add middleware: CORS, JSON parsing, error handling, request ID
3. Implement `/health` and `/ready` endpoints
4. Set up real database connection (Drizzle + pg)
5. Create base `Service` class pattern

### Phase 6B: Discovery API (Week 1-2)
1. `DiscoveryService` wrapping `DiscoveryEngine` + `RunCoordinator`
2. Discovery routes: jobs, runs, run results
3. Add run persistence to database

### Phase 6C: Opportunity API (Week 2)
1. `OpportunityService` with full CRUD
2. Opportunity routes
3. Link discovery runs to persisted opportunities

### Phase 6D: Intelligence & Matches (Week 2-3)
1. `CandidateService` (prerequisite)
2. `MatchService` with persistence (pgvector)
3. Intelligence caching layer (materialized views or separate table)
4. Matches routes

### Phase 6E: Supporting Domains (Week 3)
1. `DeadlineService` + routes
2. `VerificationService` + routes
3. `ReprocessingService` + routes
4. `NewsService` + routes
5. `ApplicationService` + routes

### Phase 6F: Webhooks & Polish (Week 3-4)
1. Webhook endpoints with HMAC verification
2. Idempotency handling
3. OpenAPI spec generation
4. Integration testing with n8n

---

## 8. Appendix: TypeScript API → HTTP Mapping Reference

### DiscoveryEngine → Discovery Routes

| Class Method | HTTP Endpoint | Request Body | Response |
|--------------|---------------|--------------|----------|
| `createJob(options)` | POST `/api/v1/discovery/jobs` | `CreateJobOptions` | `DiscoveryJob` |
| `executeJob(jobId)` | POST `/api/v1/discovery/jobs/:jobId/execute` | - | `DiscoveryRun` |
| `getRunStatus(runId)` | GET `/api/v1/discovery/runs/:runId` | - | `DiscoveryRun` |
| `getJob(jobId)` | GET `/api/v1/discovery/jobs/:jobId` | - | `DiscoveryJob` |

### RunCoordinator → Run Routes

| Class Method | HTTP Endpoint | Request Body | Response |
|--------------|---------------|--------------|----------|
| `scheduleRun(request)` | POST `/api/v1/discovery/runs` | `RunScheduleRequest` | `DiscoveryRunRecord` |
| `getRunStatus(runId)` | GET `/api/v1/discovery/runs/:runId` | - | `DiscoveryRunRecord` |
| `cancelRun(request)` | POST `/api/v1/discovery/runs/:runId/cancel` | `RunCancelRequest` | `DiscoveryRunRecord` |
| `pollRunStatus(options)` | GET `/api/v1/discovery/runs/:runId/poll` | query: intervalMs, timeoutMs | `DiscoveryRunRecord` |
| `pauseRun(runId)` | POST `/api/v1/discovery/runs/:runId/pause` | - | `DiscoveryRunRecord` |
| `resumeRun(runId)` | POST `/api/v1/discovery/runs/:runId/resume` | - | `DiscoveryRunRecord` |

### OpportunityPersister → Opportunity Routes (Partial)

| Class Method | HTTP Endpoint | Notes |
|--------------|---------------|-------|
| `persist(normalized[])` | POST `/api/v1/opportunities/bulk` | Bulk only; need single CRUD |

### Intelligence Pipeline → Intelligence Routes

| Class Method | HTTP Endpoint | Notes |
|--------------|---------------|-------|
| `pipeline.run(input)` | POST `/api/v1/intelligence/runs` | Not in required list; may be needed |
| `ExplanationEngine.explain()` | GET `/api/v1/opportunities/:id/intelligence` | Needs cached intelligence |
| `TimingIntelligenceEngine.analyze()` | GET `/api/v1/opportunities/:id/deadline` | Direct mapping |

### VerificationEngine → Verification Routes

| Class Method | HTTP Endpoint | Notes |
|--------------|---------------|-------|
| `verifyBatch(opportunities[])` | POST `/api/v1/verification` | Need run tracking |
| `verify(opportunity)` | POST `/api/v1/verification/single` | Not in required list |

---

## 9. Conclusion

The backend has a **solid foundation of domain logic** (discovery pipeline, intelligence pipeline, domain models) but **completely lacks the HTTP API layer** required for n8n integration.

**Immediate Priority:** Create Express application with health endpoints and Discovery routes, as these have the most complete underlying implementations.

**Estimated Effort:** 3-4 weeks for full implementation with proper database layer, authentication, and webhook handling.

---

*End of Audit Report*
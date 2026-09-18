# Discovery Architecture

## Overview

The Discovery subsystem is responsible for automated discovery of opportunities across heterogeneous sources. It implements a modular pipeline from query strategy generation through collection, extraction, normalization, validation, deduplication, freshness checking, and versioning. The architecture emphasizes isolation, retry boundaries, observability, and deterministic processing.

## High-Level Flow

```
DiscoveryEngine
   │
   ├─> CreateJob → DiscoveryJob
   ├─> ExecuteJob → DiscoveryRun
   │       │
   │       └─> PipelineOrchestrator
   │               │
   │               ├─ SELECT_SOURCES
   │               ├─ PREPARE
   │               ├─ EXECUTE_SOURCES
   │               │      ├─ QueryStrategyEngine → QueryPlan
   │               │      ├─ Collection → RawDocument[]
   │               │      ├─ Extraction → ExtractedFields
   │               │      ├─ Normalization → NormalizedOpportunity
   │               │      ├─ Validation → ValidationResult
   │               │      ├─ Deduplication → DuplicateGroups
   │               │      ├─ Freshness → FreshnessCheck
   │               │      └─ Versioning → OpportunityVersion
   │               ├─ AGGREGATE
   │               └─ COMPLETE
   │
   └─> Run Management / Observability
```

## Modules

### Core Orchestration
- **DiscoveryEngine** `backend/src/discovery/discovery-engine.ts`
  - Public API for job creation, execution, status queries
  - Manages `DiscoveryJob` and `DiscoveryRun` lifecycle
  - Delegates to `PipelineOrchestrator`

- **PipelineOrchestrator** `backend/src/discovery/pipeline-orchestrator.ts`
  - Executes stages in order with failure isolation
  - Stages: SELECT_SOURCES, PREPARE, EXECUTE_SOURCES, AGGREGATE, COMPLETE
  - Recoverable vs non-recoverable failure handling

### Strategy
- **DiscoveryStrategyEngine** `backend/src/discovery/strategy/discovery-strategy-engine.ts`
  - Generates `QueryPlan` from taxonomy, profile, geographic, and template inputs
  - Respects source capabilities
  - Uses `QueryBuilder`, `TaxonomyService`, `QUERY_FAMILIES`, `QUERY_TEMPLATES`

- Types: `QueryDefinition`, `QueryPlan`, `QueryFilter`, `QueryFamily`, `StrategyConfig`
  `backend/src/discovery/strategy/types.ts`

### Collection
- **CollectionOrchestrator** `backend/src/discovery/collection/collection-orchestrator.ts`
  - Orchestrates per-source collection with concurrency control
  - Integrates `RateLimiter` and `AdapterRegistry`
  - Returns `CollectionResult` with `RawDocument[]`

- Adapters: `rss-adapter.ts`, `eventbrite-adapter.ts`, `greenhouse-adapter.ts`
  `backend/src/discovery/collection/adapters/`

- Types: `RawDocument`, `CollectionOptions`, `CollectionResult`, `CollectionMetrics`
  `backend/src/discovery/collection/types.ts`

### Extraction
- **ExtractionEngine** `backend/src/discovery/extraction/extraction-engine.ts`
  - Deterministic extractor first, LLM fallback optional
  - Produces `ExtractionResult` with confidence and warnings

- Interfaces: `Extractor.interface.ts`, `DeterministicExtractor`, `LlmExtractionAdapter`
  `backend/src/discovery/extraction/`

- Types: `RawResponse`, `ExtractionResult`, `ExtractionMetrics`
  `backend/src/discovery/extraction/types.ts`

### Normalization
- **NormalizationEngine** `backend/src/discovery/normalization/normalization-engine.ts`
  - Maps extracted fields to canonical `NormalizedOpportunity`
  - Enforces schema: title, organization, location, remoteStatus, opportunityType, deadline, etc.

- Types: `NormalizedOpportunity`, `NormalizationResult`, `NormalizationContext`
  `backend/src/discovery/normalization/types.ts`

### Validation
- **ValidationEngine** `backend/src/discovery/validation/validation-engine.ts`
  - Rule-based validation via `RuleEngine`
  - Outputs `ValidationResult` with errors, warnings, infos, score

- Types: `ValidationIssue`, `ValidationRule`, `ValidationResult`
  `backend/src/discovery/validation/types.ts`

### Deduplication
- **DedupEngine** `backend/src/discovery/deduplication/dedup-engine.ts`
  - Fingerprinting via `Fingerprint`
  - Matching rules with weighted scoring
  - Groups duplicates into `DuplicateGroup`

- Types: `DuplicateCandidate`, `MatchingRule`, `CandidatePair`, `DeduplicationResult`
  `backend/src/discovery/deduplication/types.ts`

### Freshness
- **FreshnessEngine** `backend/src/discovery/freshness/freshness-engine.ts`
  - Tracks `FreshnessStatus`: FRESH, STALE, EXPIRED, UNKNOWN
  - Change detection via `ChangeDetector`
  - Verification via `VerificationEngine`

- Types: `FreshnessCheck`, `VerificationResult`, `ChangeDetectionResult`
  `backend/src/discovery/freshness/types.ts`

### Versioning
- **VersionManager** `backend/src/discovery/versioning/version-manager.ts`
  - Manages `OpportunityVersion` history
  - Lifecycle states: NEW, ACTIVE, STALE, EXPIRED, CLOSED
  - Events: CREATED, UPDATED, STATE_CHANGED, CLOSED

- Types: `LifecycleState`, `OpportunityVersion`, `VersionEvent`, `OpportunityLifecycleMeta`
  `backend/src/discovery/versioning/types.ts`

### Run Management & Reliability
- **RunCoordinator** `backend/src/discovery/run-management/run-coordinator.ts`
- **RunPersistence** `backend/src/discovery/run-management/run-persistence.ts`
- **RunReporter** `backend/src/discovery/run-management/run-reporter.ts`
- Types: `DiscoveryRunRecord`, `RunMetrics`, `RunStatus`
  `backend/src/discovery/run-management/types.ts`

- Reliability modules:
  - `CircuitBreaker` `backend/src/discovery/reliability/circuit-breaker.ts`
  - `RetryManager` `backend/src/discovery/reliability/retry-manager.ts`
  - `ErrorClassification` `backend/src/discovery/reliability/error-classification.ts`
  - `Observability` `backend/src/discovery/reliability/observability.ts`

## Data Flow Details

1. **Job Creation**
   - `DiscoveryEngine.createJob` validates options, stores `DiscoveryJob` in memory
   - Options: sourceIds | runAllEnabled, category, priorityMin

2. **Execution**
   - `DiscoveryEngine.executeJob` resolves sources, builds `DiscoveryExecutionContext`
   - Starts `DiscoveryRun` with status RUNNING
   - Invokes `PipelineOrchestrator.run`

3. **Stage Execution**
   - SELECT_SOURCES: resolves source IDs
   - PREPARE: health checks, rate limit warmup
   - EXECUTE_SOURCES: per source
     - StrategyEngine generates QueryPlan
     - Collection fetches raw documents
     - Extraction extracts fields
     - Normalization creates canonical opportunity
     - Validation checks quality
     - Deduplication groups similar items
     - Freshness updates status
     - Versioning persists version
   - AGGREGATE: combine metrics, deduplication summary
   - COMPLETE: finalize run, update job status

4. **Observability**
   - Stage results captured with duration, errors, sourceResults
   - Run metrics: sourcesSucceeded/Failed/Skipped, itemsDiscovered
   - Reliability events logged via Observability module

## Design Principles

- **Isolation**: Per-source execution failures do not abort entire run
- **Retry Boundaries**: Stage-level retry with backoff via RetryManager
- **Determinism First**: Extraction and normalization prefer deterministic rules
- **Versioned Docs**: All docs versioned with software releases
- **One concept per section**: Architecture, API, operations separated

## Dependencies

- `backend/src/registry` - SourceRegistryService
- `backend/src/adapters` - AdapterFactory
- `shared/src/enums` - OpportunityStatus, DeadlineType
- Taxonomy files under `taxonomy/`

## Future Extensions

- Persistent run storage via `RunPersistence`
- Distributed execution with queue backend
- Real-time freshness webhooks
- ML-based deduplication models

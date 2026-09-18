# Discovery Engine

Automated opportunity discovery pipeline with orchestration, strategy, collection, extraction, normalization, validation, deduplication, freshness, and versioning.

## Architecture

- **DiscoveryEngine**: Public API for job creation, execution, and status queries
- **DiscoveryJob**: Intent to run discovery with source selection criteria
- **DiscoveryRun**: Executed instance with status and stage results
- **PipelineOrchestrator**: Executes stages with failure isolation and retry boundaries
- **DiscoveryStrategyEngine**: Generates query plans from taxonomy, profile, and templates
- **CollectionOrchestrator**: Fetches raw documents via adapters with rate limiting
- **ExtractionEngine**: Deterministic first, LLM fallback extraction
- **NormalizationEngine**: Maps to canonical `NormalizedOpportunity`
- **ValidationEngine**: Rule-based quality checks
- **DedupEngine**: Fingerprinting and weighted matching
- **FreshnessEngine**: Stale/expired detection and verification
- **VersionManager**: Lifecycle and version history
- **RunCoordinator**: Scheduling, persistence, reporting
- **Reliability**: Circuit breaker, retry manager, error classification, observability

## Stages

1. SELECT_SOURCES - Resolve sources from registry
2. PREPARE - Prepare adapters, health checks
3. EXECUTE_SOURCES - Per-source discovery with isolation
   - Strategy → Collection → Extraction → Normalization → Validation → Deduplication → Freshness → Versioning
4. AGGREGATE - Combine results and metrics
5. COMPLETE - Finalize run

## Usage

```ts
import { DiscoveryEngine } from './discovery';
import { SourceRegistryService } from '../registry';

const engine = new DiscoveryEngine({
  sourceRegistryService: new SourceRegistryService(),
  maxConcurrency: 5,
});

const job = await engine.createJob({
  runAllEnabled: true,
  category: 'EMPLOYMENT',
});

const run = await engine.executeJob(job.jobId);
const status = await engine.getRunStatus(run.runId);
```

## Modules

```
discovery/
  discovery-engine.ts
  pipeline-orchestrator.ts
  types.ts
  strategy/
  collection/
  extraction/
  normalization/
  validation/
  deduplication/
  freshness/
  versioning/
  run-management/
  reliability/
  pipeline/
```

## Documentation

See `docs/discovery/` for architecture, API reference, and operations guides.

- `docs/DISCOVERY_ENGINE.md`
- `docs/discovery/DISCOVERY_ARCHITECTURE.md`
- `docs/discovery/DISCOVERY_API.md`
- `docs/discovery/DISCOVERY_OPERATIONS.md`


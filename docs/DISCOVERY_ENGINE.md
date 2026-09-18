# Discovery Engine Overview

## Summary

The Discovery Engine automates the end-to-end discovery of opportunities from multiple heterogeneous sources. It provides job/run orchestration, query strategy generation, collection, extraction, normalization, validation, deduplication, freshness tracking, and versioning as a cohesive pipeline.

## Key Components

- **DiscoveryEngine** — Public API for creating jobs, executing runs, and querying status
- **PipelineOrchestrator** — Executes stages with isolation and retry boundaries
- **DiscoveryStrategyEngine** — Generates query plans from taxonomy, profile, and templates
- **Collection** — Fetches raw documents via adapters with rate limiting
- **Extraction** — Deterministic + LLM fallback extraction to structured fields
- **Normalization** — Maps to canonical `NormalizedOpportunity`
- **Validation** — Rule-based quality checks
- **Deduplication** — Fingerprinting and weighted matching
- **Freshness** — Stale/expired detection and verification
- **Versioning** — Lifecycle and version history
- **Run Management** — Scheduling, persistence, reporting
- **Reliability** — Circuit breaker, retry manager, error classification, observability

## Architecture

See [DISCOVERY_ARCHITECTURE.md](./discovery/DISCOVERY_ARCHITECTURE.md) for detailed module interactions and data flow.

Pipeline stages:
1. SELECT_SOURCES
2. PREPARE
3. EXECUTE_SOURCES
4. AGGREGATE
5. COMPLETE

## Quick Start

```ts
import { DiscoveryEngine } from './backend/src/discovery';
import { SourceRegistryService } from './backend/src/registry';

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

## Documentation

- Architecture: `docs/discovery/DISCOVERY_ARCHITECTURE.md`
- API Reference: `docs/discovery/DISCOVERY_API.md`
- Operations: `docs/discovery/DISCOVERY_OPERATIONS.md`
- README: `backend/src/discovery/README.md`

## Design Principles

- Isolation per source
- Deterministic first, LLM fallback
- Observable by default
- Versioned data and docs
- One concept per section

## Success Metrics

- Time to first success < 15 min for new developers
- Run success rate ≥ 90%
- Zero broken code examples in docs
- 100% public APIs documented with examples

# Multi-Source Collection Framework

## Overview
Reusable collection framework built around existing adapter architecture. Collects raw documents from heterogeneous sources without extraction/normalization.

## Key Components

- **CollectionOrchestrator**: Executes adapters per source with concurrency, rate limiting, pagination handling
- **RawDocument**: Common internal representation for collected data
- **CollectionResult / CollectionMetrics**: Per-source collection metadata
- **RateLimiterRegistry**: Token bucket per source respecting `SourceRegistryEntry.rate_limit`
- **Adapter Registry**: Factories for USAJOBS, Greenhouse, Eventbrite, RSS

## Source Types Supported
- Government APIs
- Career APIs (Greenhouse, Lever, Ashby)
- Company Career Pages
- Event Sources (Eventbrite)
- News Sources (RSS)
- Research / Fellowship / Certification sources via generic adapter pattern

## Usage

```ts
import { CollectionOrchestrator } from './collection-orchestrator';
import { createDefaultAdapterFactories } from './adapter-registry';

const orchestrator = new CollectionOrchestrator({
  adapterFactory: createDefaultAdapterFactories(),
  maxConcurrency: 5,
  respectRateLimits: true,
});

const result = await orchestrator.collect(sourceEntry, {
  sourceId: sourceEntry.source_id,
  limit: 100,
});
```

## Files
- types.ts
- collection-orchestrator.ts
- rate-limiter.ts
- adapter-registry.ts
- adapters/greenhouse-adapter.ts
- adapters/eventbrite-adapter.ts
- adapters/rss-adapter.ts

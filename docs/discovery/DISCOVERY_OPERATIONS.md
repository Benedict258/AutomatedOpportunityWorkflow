# Discovery Operations Guide

## Purpose

Operational guidance for running, monitoring, and maintaining the Discovery subsystem in production and development environments.

## Run Management

### Creating and Executing Runs

Discovery runs are created via `DiscoveryEngine.createJob` and executed with `executeJob`.

**Job Creation**
```ts
const job = await engine.createJob({
  runAllEnabled: true,
  category: 'EMPLOYMENT',
  priorityMin: 1,
  triggeredBy: 'scheduler'
});
```

**Execution**
```ts
const run = await engine.executeJob(job.jobId);
const status = await engine.getRunStatus(run.runId);
```

Run lifecycle:
- `PENDING` → `RUNNING` → `SUCCEEDED | FAILED | PARTIAL | CANCELLED`
- Job status: `DRAFT` → `PROCESSING` → `COMPLETED`

### Scheduling

Use `RunCoordinator` for scheduled runs:
```ts
await runCoordinator.schedule({
  jobId,
  sources: ['source-1','source-2'],
  cronExpression: '0 */6 * * *',
  triggeredBy: 'ops'
});
```

Cancel:
```ts
await runCoordinator.cancel({ runId, reason: 'manual abort', requestedBy: 'operator' });
```

Metrics tracked per run:
- `sourcesRequested`, `sourcesSucceeded`, `sourcesFailed`, `sourcesSkipped`
- `itemsDiscovered`, `itemsDeduplicated`
- `durationMs`, `apiCallsMade`, `errorsCount`, `warningsCount`

## Monitoring

### Observability Module

`backend/src/discovery/reliability/observability.ts` provides structured logging and metrics emission.

Key events:
- Stage start/completed with duration
- Source success/failure with error classification
- Retry attempts and circuit breaker state changes
- Freshness checks and change detections

Log fields: `runId`, `jobId`, `stageName`, `sourceId`, `status`, `durationMs`, `errorCode`

### Health Checks

Pre-flight checks in `PREPARE` stage:
- Adapter health
- Rate limit availability
- Source registry connectivity
- Taxonomy service availability

Monitor:
- `sourcesSkipped` spikes → source disabled or rate limited
- `sourcesFailed` increase → adapter error or circuit open
- Stage duration growth → upstream latency

### Metrics Dashboard

Recommended metrics:
- Runs per day, success rate
- Items discovered per source per run
- Deduplication ratio
- Freshness distribution: FRESH / STALE / EXPIRED
- Validation pass rate
- Extraction confidence distribution
- Retry rate and circuit breaker trips

## Reliability

### Error Handling Guidelines

**Per-source isolation**
- Failures in one source do not abort run
- Each source result captured in `StageResult.sourceResults`

**Retry Policy**
Configured via `DiscoveryEngineOptions.retryPolicy`:
- Default maxAttempts: 3
- Backoff: exponential with jitter
- Retryable errors: 5xx, network timeouts, rate limit 429

Non-retryable: 4xx client errors, validation failures

**Circuit Breaker**
`backend/src/discovery/reliability/circuit-breaker.ts`
- Opens after N failures in window
- Half-open probe after cooldown
- Prevents cascade failures to external APIs

**Error Classification**
`backend/src/discovery/reliability/error-classification.ts`
Categories:
- `TRANSIENT` → retry
- `RATE_LIMIT` → backoff + retry
- `PERMANENT` → skip source
- `VALIDATION` → log warning, continue

### Failure Recovery

Run failure modes:
1. **Stage FAILED non-recoverable**: run stops at stage, job marked COMPLETED, run status FAILED
2. **Source FAILED**: source marked failed, other sources continue
3. **Partial success**: run status PARTIAL, metrics reflect succeeded/failed split

Recovery steps:
- Inspect `run.stageResults[*].errors`
- Check `Observability` logs for error codes
- Verify source adapter health
- Review circuit breaker state
- Re-run job with `sourceIds` filtered to failed sources

## Operational Best Practices

### Configuration

- Set `maxConcurrency` based on source rate limits
- Enable deterministic extraction first, LLM fallback only for low confidence
- Tune freshness thresholds per source via `FreshnessEngineOptions`
- Version query templates; never edit in place

### Run Hygiene

- Do not run `runAllEnabled` during peak hours without rate limiting
- Use `priorityMin` filter to limit low-value sources
- Tag jobs with `triggeredBy` for audit

### Data Quality

- Monitor validation error codes; add rules for recurring issues
- Review deduplication groups with low similarity scores
- Audit normalization warnings for schema drift

### Maintenance

- Rotate API keys via secret manager; adapters read at startup
- Prune old runs via `RunPersistence` retention policy
- Review taxonomy changes before updating `QUERY_FAMILIES`
- Run discovery health check job daily with minimal sources

## Alerting

Alert thresholds:
- Run success rate < 90% over 1 hour
- Source failure rate > 20% over 3 runs
- Circuit breaker open > 10 minutes
- Extraction confidence < 0.7 for > 30% of items
- Freshness check latency > 5 minutes

## Troubleshooting

**No items discovered**
- Check `SELECT_SOURCES` stage metadata for resolved sources
- Verify source enabled in registry
- Confirm adapter health in PREPARE stage
- Inspect CollectionResult for rate limit hits

**High duplication**
- Review `MatchingRule` weights in `MatchingRules`
- Check fingerprint stability in `Fingerprint`
- Ensure normalization normalizes titles consistently

**Stale data**
- Verify `FreshnessEngine` staleThresholdHours
- Check verification engine reachability
- Review `VersionManager` lifecycle transitions

**Run stuck RUNNING**
- Check for deadlock in `PipelineOrchestrator` stage loop
- Review `RunCoordinator` pause state
- Inspect logs for unhandled promise rejection

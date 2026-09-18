# Discovery Public API Reference

This document describes the public APIs for the Discovery subsystem. All APIs are TypeScript classes/interfaces located under `backend/src/discovery/`.

## DiscoveryEngine

**File:** `backend/src/discovery/discovery-engine.ts`

Orchestrates discovery jobs and runs.

### Types

```ts
enum DiscoveryRunStatus { PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED, PARTIAL }

enum PipelineStageName { SELECT_SOURCES, PREPARE, EXECUTE_SOURCES, AGGREGATE, COMPLETE }

interface CreateJobOptions {
  sourceIds?: string[];
  runAllEnabled?: boolean;
  category?: string;
  priorityMin?: number;
  metadata?: Record<string, unknown>;
  triggeredBy?: string;
}

interface DiscoveryJob {
  jobId: string;
  createdAt: string;
  updatedAt: string;
  sourceIds?: string[];
  runAllEnabled: boolean;
  category?: string;
  priorityMin?: number;
  metadata?: Record<string, unknown>;
  triggeredBy?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED';
}

interface DiscoveryRun {
  runId: string;
  jobId: string;
  status: DiscoveryRunStatus;
  startedAt?: string;
  completedAt?: string;
  sourcesRequested: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesSkipped: number;
  stageResults: StageResult[];
  error?: string;
  executionContext: DiscoveryExecutionContext;
}

interface DiscoveryEngineOptions {
  sourceRegistryService: unknown;
  adapterFactory?: unknown;
  maxConcurrency?: number;
  retryPolicy?: { maxAttempts: number; backoffMs: number };
}
```

### Methods

```ts
class DiscoveryEngine {
  constructor(options: DiscoveryEngineOptions)

  async createJob(options: CreateJobOptions): Promise<DiscoveryJob>

  async executeJob(jobId: string): Promise<DiscoveryRun>

  async getRunStatus(runId: string): Promise<DiscoveryRun | null>

  async getJob(jobId: string): Promise<DiscoveryJob | null>
}
```

**Notes**
- `createJob` requires `sourceIds` or `runAllEnabled`.
- `executeJob` transitions job to PROCESSING, creates a run, runs pipeline via `PipelineOrchestrator`, updates metrics.

## PipelineOrchestrator

**File:** `backend/src/discovery/pipeline-orchestrator.ts`

Executes pipeline stages with failure isolation.

```ts
class PipelineOrchestrator {
  constructor()
  async run(context: DiscoveryExecutionContext): Promise<StageResult[]>
}
```

StageResult:
```ts
interface StageResult {
  stageName: PipelineStageName;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  errors?: string[];
  sourceResults?: Record<string, SourceStageResult>;
}
```

## QueryStrategy

**File:** `backend/src/discovery/strategy/discovery-strategy-engine.ts`

### Types

```ts
interface QueryFilter {
  taxonomyNodes?: TaxonomyNodeRef[];
  keywords?: string[];
  excludeKeywords?: string[];
  opportunityTypes?: string[];
  geographic?: GeographicFilter;
  remote?: boolean | null;
  profileSkills?: string[];
  profileInterests?: string[];
  dateRange?: { from?: string; to?: string };
  sourceSpecific?: Record<string, unknown>;
}

interface QueryDefinition {
  id: string;
  name: string;
  family: string;
  sourceId?: string;
  sourceType?: SourceType;
  filters: QueryFilter;
  priority?: number;
  active: boolean;
}

interface QueryPlan {
  runId: string;
  jobId: string;
  generatedAt: string;
  items: QueryPlanItem[];
}
```

### Methods

```ts
class DiscoveryStrategyEngine {
  constructor(options: DiscoveryStrategyOptions)
  generateQueryPlan(params: {
    runId: string;
    jobId: string;
    families?: string[];
    sourceIds?: string[];
    profile?: {...};
    geographic?: {...};
    opportunityTypes?: string[];
    maxQueriesPerSource?: number;
  }): QueryPlan

  generateQueriesFromTaxonomy(nodeIds: {...}[], options?: {...}): QueryDefinition[]
  getAvailableFamilies(): string[]
}
```

## Collection

**File:** `backend/src/discovery/collection/`

### Types

```ts
interface RawDocument {
  sourceId: string;
  externalId?: string | string[];
  collectedAt: string;
  rawData: unknown;
  metadata?: {...};
}

interface CollectionOptions {
  sourceId: string;
  since?: string;
  limit?: number;
  cursor?: string;
  maxPages?: number;
  filters?: Record<string, unknown>;
  respectRateLimit?: boolean;
}

interface CollectionResult {
  sourceId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL' | 'SKIPPED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  documents: RawDocument[];
  metrics: CollectionMetrics;
  error?: string;
  nextCursor?: string;
  hasMore?: boolean;
}
```

### Classes

```ts
class CollectionOrchestrator {
  constructor(options?: CollectionOrchestratorOptions)
  async execute(context: SourceCollectionContext): Promise<CollectionResult>
}
```

Adapters implement collection for specific sources: `RssAdapter`, `EventbriteAdapter`, `GreenhouseAdapter`.

## Extraction

**File:** `backend/src/discovery/extraction/`

### Types

```ts
interface ExtractionResult {
  documentId: string;
  sourceId: string;
  extractedAt: string;
  fields: ExtractedFields;
  confidence: number;
  warnings: ExtractionWarning[];
  errors: ExtractionError[];
  provenance: { extractor: string; contentType: ContentType; ... };
}

interface ExtractionPipelineOptions {
  enableDeterministicFirst?: boolean;
  enableLLMFallback?: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
  timeoutMs?: number;
}
```

### Classes

```ts
class ExtractionEngine {
  constructor(options?: ExtractionPipelineOptions)
  async extract(document: RawDocument): Promise<ExtractionResult>
}
```

Interface `Extractor`:
```ts
interface Extractor {
  name: string;
  supportedContentTypes: ContentType[];
  extract(context: ExtractionContext, rawData: unknown): Promise<ExtractionResult>
}
```

## Normalization

**File:** `backend/src/discovery/normalization/`

### Types

```ts
interface NormalizedOpportunity {
  source: string;
  externalId?: string;
  stableId?: string;
  title: string;
  organization?: string;
  description?: string;
  url?: string;
  location?: string;
  remoteStatus: RemoteStatus;
  opportunityType: OpportunityType;
  category?: string[];
  skills?: SkillReference[];
  compensation?: CompensationInfo;
  publicationDate?: string;
  deadline?: string | null;
  deadlineType: DeadlineType;
  status?: OpportunityStatus;
  firstSeenAt?: string;
  lastSeenAt?: string;
  provenance?: {...};
}

interface NormalizationResult {
  normalizedOpportunity: NormalizedOpportunity;
  warnings: NormalizationWarning[];
  errors: NormalizationError[];
}
```

### Classes

```ts
class NormalizationEngine {
  async normalize(context: NormalizationContext): Promise<NormalizationResult>
}
```

## Validation

**File:** `backend/src/discovery/validation/`

### Types

```ts
type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  severity: ValidationSeverity;
  remediation?: string;
}

interface ValidationResult {
  opportunityId: string;
  sourceId: string;
  valid: boolean;
  passed: boolean;
  score?: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  remediationSuggestions: string[];
  checkedAt: string;
  rulesExecuted: number;
}
```

### Classes

```ts
class ValidationEngine {
  constructor(rules?: ValidationRule[])
  async validate(ctx: ValidationContext): Promise<ValidationResult>
}
```

## Deduplication

**File:** `backend/src/discovery/deduplication/`

### Types

```ts
interface DuplicateCandidate {
  opportunity: NormalizedOpportunity;
  fingerprint: string;
  source: string;
  externalId?: string;
}

interface DuplicateGroup {
  groupId: string;
  canonicalCandidate?: DuplicateCandidate;
  candidates: DuplicateCandidate[];
  similarityScore: number;
  matchingRulesTriggered: string[];
}

interface DeduplicationResult {
  groups: DuplicateGroup[];
  uniqueCandidates: DuplicateCandidate[];
  duplicateCandidates: DuplicateCandidate[];
  stats: {...};
}
```

### Classes

```ts
class DedupEngine {
  async deduplicate(candidates: DuplicateCandidate[]): Promise<DeduplicationResult>
}
```

## Freshness

**File:** `backend/src/discovery/freshness/`

### Types

```ts
type FreshnessStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'UNKNOWN';
type ChangeType = 'NONE' | 'TITLE' | 'DESCRIPTION' | 'DEADLINE' | 'STATUS' | 'COMPENSATION' | 'LOCATION' | 'MULTIPLE';

interface FreshnessCheck {
  opportunityId: string;
  source: string;
  freshnessStatus: FreshnessStatus;
  staleSince?: string;
  nextCheckDueAt?: string;
  changeType?: ChangeType;
}

interface FreshnessEngineOptions {
  staleThresholdHours?: number;
  expiryThresholdHours?: number;
  checkIntervalHours?: number;
  maxAgeDays?: number;
}
```

### Classes

```ts
class FreshnessEngine {
  constructor(options?: FreshnessEngineOptions)
  async check(opportunity: NormalizedOpportunity): Promise<FreshnessCheck>
  async verify(opportunityId: string): Promise<VerificationResult>
}
```

## Versioning

**File:** `backend/src/discovery/versioning/`

### Types

```ts
enum LifecycleState { NEW, ACTIVE, STALE, EXPIRED, CLOSED }
enum VersionEventType { CREATED, UPDATED, STATE_CHANGED, CLOSED }

interface OpportunityVersion {
  id: string;
  opportunityId: string;
  versionNumber: number;
  capturedAt: string;
  title?: string;
  ...
}

interface VersioningResult {
  success: boolean;
  opportunityId: string;
  version?: OpportunityVersion;
  meta?: OpportunityLifecycleMeta;
}
```

### Classes

```ts
class VersionManager {
  async createVersion(input: CreateVersionInput): Promise<VersioningResult>
  async getLifecycle(opportunityId: string): Promise<OpportunityLifecycleMeta | null>
}
```

## Pipeline Types

**File:** `backend/src/discovery/pipeline/types.ts`

Defines `PipelineContext`, `PipelineStage`, `PipelineResult` for custom pipeline composition.

## Run Management

**File:** `backend/src/discovery/run-management/`

```ts
enum RunStatus { SCHEDULED, RUNNING, PAUSED, SUCCEEDED, FAILED, CANCELLED, PARTIAL }

class RunCoordinator {
  async schedule(req: RunScheduleRequest): Promise<DiscoveryRunRecord>
  async cancel(req: RunCancelRequest): Promise<void>
  async getRun(runId: string): Promise<DiscoveryRunRecord | null>
}
```

## Reliability

**File:** `backend/src/discovery/reliability/`

```ts
class CircuitBreaker { ... }
class RetryManager { ... }
class Observability { ... }
```

All public APIs return structured results with errors, warnings, metrics, and provenance for observability.

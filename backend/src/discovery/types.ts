export enum DiscoveryRunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PARTIAL = 'PARTIAL',
}

export enum PipelineStageName {
  SELECT_SOURCES = 'SELECT_SOURCES',
  PREPARE = 'PREPARE',
  EXECUTE_SOURCES = 'EXECUTE_SOURCES',
  AGGREGATE = 'AGGREGATE',
  COMPLETE = 'COMPLETE',
}

export interface CreateJobOptions {
  sourceIds?: string[];
  runAllEnabled?: boolean;
  category?: string;
  priorityMin?: number;
  metadata?: Record<string, unknown>;
  triggeredBy?: string;
}

export interface DiscoveryJob {
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

export interface DiscoveryRun {
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
  metadata?: Record<string, unknown>;
  executionContext: DiscoveryExecutionContext;
}

export interface DiscoveryExecutionContext {
  runId: string;
  jobId: string;
  startedAt: string;
  sources: string[];
  options: {
    runAllEnabled: boolean;
    category?: string;
    priorityMin?: number;
  };
  // Dependencies will be injected at runtime
  sourceRegistryService?: unknown;
  adapterFactory?: unknown;
}

export interface PipelineStage {
  name: PipelineStageName;
  execute(context: DiscoveryExecutionContext): Promise<StageResult>;
}

export interface StageResult {
  stageName: PipelineStageName;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  errors?: string[];
  sourceResults?: Record<string, SourceStageResult>;
}

export interface SourceStageResult {
  sourceId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  itemsDiscovered?: number;
  retryCount?: number;
}

export interface DiscoveryEngineOptions {
  sourceRegistryService: unknown;
  adapterFactory?: unknown;
  maxConcurrency?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

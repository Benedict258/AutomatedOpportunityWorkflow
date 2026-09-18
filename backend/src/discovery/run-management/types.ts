export enum RunStatus {
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PARTIAL = 'PARTIAL',
}

export interface RunMetrics {
  totalSources: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesSkipped: number;
  itemsDiscovered: number;
  itemsDeduplicated: number;
  durationMs: number;
  bytesProcessed?: number;
  apiCallsMade?: number;
  errorsCount: number;
  warningsCount: number;
}

export interface DiscoveryRunRecord {
  runId: string;
  jobId?: string;
  status: RunStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  pausedAt?: string;
  sourcesRequested: string[];
  sourcesCompleted: string[];
  metrics: RunMetrics;
  metadata?: Record<string, unknown>;
  error?: string;
  triggeredBy?: string;
  schedule?: {
    cronExpression?: string;
    nextRunAt?: string;
    repeatCount?: number;
  };
  executionContext?: Record<string, unknown>;
}

export interface RunScheduleRequest {
  runId?: string;
  jobId?: string;
  sources: string[];
  scheduleAt?: string;
  cronExpression?: string;
  metadata?: Record<string, unknown>;
  triggeredBy?: string;
}

export interface RunCancelRequest {
  runId: string;
  reason?: string;
  requestedBy?: string;
}

export interface RunPollOptions {
  runId: string;
  intervalMs?: number;
  timeoutMs?: number;
}

export interface RunSummary {
  runId: string;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  metrics: RunMetrics;
  summary: string;
}

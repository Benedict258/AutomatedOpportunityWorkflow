import {
  ModelExecutionRecord,
  ModelOperation,
  TokenUsage,
  ModelErrorCategory,
} from './types';

export interface ModelObservabilityConfig {
  enabled: boolean;
  storage?: ModelExecutionStorage;
  samplingRate?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ModelExecutionStorage {
  save(record: ModelExecutionRecord): Promise<void>;
  query(filter: ModelExecutionQuery): Promise<ModelExecutionRecord[]>;
  aggregate(aggregation: ModelExecutionAggregation): Promise<any>;
}

export interface ModelExecutionQuery {
  operation?: ModelOperation;
  providerId?: string;
  modelId?: string;
  status?: ModelExecutionRecord['status'];
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface ModelExecutionAggregation {
  groupBy: 'operation' | 'provider' | 'model' | 'status' | 'date';
  metrics: ('count' | 'avg_latency' | 'avg_tokens' | 'error_rate' | 'fallback_rate' | 'cost')[];
  filter?: ModelExecutionQuery;
  interval?: 'hour' | 'day' | 'week' | 'month';
}

export class ModelObservability {
  private config: ModelObservabilityConfig;
  private buffer: ModelExecutionRecord[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: ModelObservabilityConfig) {
    this.config = {
      samplingRate: 1.0,
      logLevel: 'info',
      ...config,
    };

    if (this.config.enabled && this.config.storage) {
      this.flushInterval = setInterval(() => this.flush(), 10000);
    }
  }

  record(record: ModelExecutionRecord): void {
    if (!this.config.enabled) return;

    if (this.config.samplingRate && this.config.samplingRate < 1.0) {
      if (Math.random() > this.config.samplingRate) return;
    }

    this.buffer.push(record);

    if (this.shouldLog(record)) {
      this.logRecord(record);
    }
  }

  private shouldLog(record: ModelExecutionRecord): boolean {
    const level = this.config.logLevel || 'info';
    if (level === 'debug') return true;
    if (level === 'info' && (record.status === 'error' || record.status === 'fallback')) return true;
    if (level === 'warn' && record.status === 'error') return true;
    if (level === 'error' && record.status === 'error') return true;
    return false;
  }

  private logRecord(record: ModelExecutionRecord): void {
    const logData = {
      executionId: record.id,
      operation: record.operation,
      provider: record.providerId,
      model: record.modelId,
      modelVersion: record.modelVersion,
      promptVersion: record.promptVersion,
      inputHash: record.inputHash,
      status: record.status,
      latencyMs: record.latencyMs,
      retryCount: record.retryCount,
      fallbackUsed: record.fallbackUsed,
      tokenUsage: record.tokenUsage,
      estimatedCost: record.estimatedCost,
      errorCategory: record.errorCategory,
      errorMessage: record.errorMessage,
      validationErrors: record.validationErrors,
    };

    if (record.status === 'error') {
      console.error('[ModelObservability] Model execution failed:', logData);
    } else if (record.status === 'fallback') {
      console.warn('[ModelObservability] Model fallback used:', logData);
    } else if (record.status === 'validation_failed') {
      console.warn('[ModelObservability] Model output validation failed:', logData);
    } else {
      console.log('[ModelObservability] Model execution completed:', logData);
    }
  }

  async flush(): Promise<void> {
    if (!this.config.storage || this.buffer.length === 0) return;

    const records = [...this.buffer];
    this.buffer = [];

    try {
      await Promise.all(records.map(r => this.config.storage!.save(r)));
    } catch (error) {
      console.error('[ModelObservability] Failed to persist execution records:', error);
      this.buffer.unshift(...records);
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }

  getBufferSize(): number {
    return this.buffer.length;
  }
}

export function createModelObservability(config?: Partial<ModelObservabilityConfig>): ModelObservability {
  return new ModelObservability({
    enabled: true,
    samplingRate: 1.0,
    logLevel: 'info',
    ...config,
  });
}

export function generateExecutionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

export function hashInput(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function estimateCost(usage: TokenUsage, provider: string, model: string): number {
  const rates: Record<string, Record<string, { input: number; output: number }>> = {
    openai: {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'text-embedding-3-small': { input: 0.00002, output: 0 },
      'text-embedding-3-large': { input: 0.00013, output: 0 },
    },
    nvidia: {
      'nemotron-3-ultra': { input: 0.0002, output: 0.0008 },
    },
  };

  const providerRates = rates[provider];
  if (!providerRates) return 0;

  const modelRates = providerRates[model];
  if (!modelRates) return 0;

  return (usage.promptTokens / 1000) * modelRates.input + (usage.completionTokens / 1000) * modelRates.output;
}
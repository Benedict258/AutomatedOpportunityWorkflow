import type { SourceRegistryEntry } from '../../../shared/src/registry/types';

export interface RawDocument {
  sourceId: string;
  externalId?: string | string[];
  collectedAt: string;
  rawData: unknown;
  metadata?: {
    page?: number;
    cursor?: string;
    totalItems?: number;
    sourceType?: string;
    adapterId?: string;
    [key: string]: unknown;
  };
}

export interface CollectionOptions {
  sourceId: string;
  since?: string;
  limit?: number;
  cursor?: string;
  maxPages?: number;
  filters?: Record<string, unknown>;
  respectRateLimit?: boolean;
}

export interface CollectionResult {
  sourceId: string;
  sourceName?: string;
  status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL' | 'SKIPPED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  documents: RawDocument[];
  metrics: CollectionMetrics;
  error?: string;
  warnings?: string[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface CollectionMetrics {
  documentsCollected: number;
  pagesFetched: number;
  itemsPerPage?: number;
  totalItemsReported?: number;
  durationMs: number;
  rateLimitHits: number;
  retries: number;
  bytesReceived?: number;
  errors: number;
}

export interface CollectionOrchestratorOptions {
  maxConcurrency?: number;
  defaultMaxPages?: number;
  defaultLimit?: number;
  respectRateLimits?: boolean;
}

export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burst?: number;
}

export interface SourceCollectionContext {
  source: SourceRegistryEntry;
  options: CollectionOptions;
  adapterId?: string;
  rateLimitConfig?: RateLimitConfig;
}

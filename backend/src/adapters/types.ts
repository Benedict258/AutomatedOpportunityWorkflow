import type { Opportunity } from 'shared/domain/opportunity';
import type { SourceRegistryEntry } from 'shared/registry/types';

export interface FetchOptions {
  sourceId: string;
  since?: string;
  limit?: number;
  cursor?: string;
  filters?: Record<string, unknown>;
  raw?: boolean;
}

export interface DiscoverOptions {
  sourceId: string;
  maxItems?: number;
}

export interface NormalizedOpportunity {
  sourceId: string;
  externalId?: string;
  title: string;
  organization?: string;
  description?: string;
  url?: string;
  location?: string;
  remoteInfo?: Record<string, unknown>;
  opportunityType?: string;
  categoryIds?: string[];
  status?: string;
  publicationDate?: string;
  applicationDeadline?: string | null;
  deadlineType?: string;
  firstSeenAt: string;
  lastSeenAt?: string;
  rawData?: unknown;
}

export interface AdapterMetadata {
  adapterId: string;
  version: string;
  sourceType: string;
  capabilities: {
    discovery: boolean;
    search: boolean;
    pagination: boolean;
    realTime: boolean;
  };
  lastHealthCheck?: string;
  healthStatus?: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'UNKNOWN';
}

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'UNKNOWN';
  checkedAt: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SearchQuery {
  sourceId: string;
  query?: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

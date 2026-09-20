import type { SourceRegistryEntry, SourceCategory, SourceType, AccessMethod } from 'shared/registry/types';
import { HealthStatus } from 'shared/registry/types';

/**
 * Maps SourceRegistryEntry to the existing `sources` table schema:
 * sources(id UUID, name VARCHAR, url TEXT, source_type VARCHAR, metadata JSONB)
 *
 * Domain model Source fields remain unchanged.
 * Registry-specific fields are stored inside metadata JSONB to avoid schema migration.
 */

export interface SourceRow {
  id: string;
  name: string;
  url?: string | null;
  source_type?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export function mapEntryToRow(entry: SourceRegistryEntry): SourceRow {
  const {
    source_id,
    name,
    url,
    source_type,
    sourceType,
    ...metadataFields
  } = entry;

  return {
    id: source_id,
    name,
    url: url ?? null,
    source_type: source_type ?? sourceType ?? null,
    metadata: metadataFields as Record<string, unknown>,
  };
}

export function mapRowToEntry(row: SourceRow): SourceRegistryEntry {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  
  return {
    source_id: row.id,
    name: row.name,
    url: row.url ?? undefined,
    source_type: (metadata.source_type as SourceType) ?? row.source_type ?? ('API' as SourceType),
    sourceType: row.source_type ?? undefined,
    organization: metadata.organization as string | undefined,
    category: metadata.category as SourceCategory,
    geography: metadata.geography as string | undefined,
    access_method: metadata.access_method as AccessMethod,
    api_endpoint: metadata.api_endpoint as string | undefined,
    authentication: metadata.authentication as any,
    rate_limit: metadata.rate_limit as any,
    cost: metadata.cost as any,
    reliability: typeof metadata.reliability === 'number' ? metadata.reliability : undefined,
    priority: typeof metadata.priority === 'number' ? metadata.priority : 50,
    enabled: typeof metadata.enabled === 'boolean' ? metadata.enabled : true,
    last_success: metadata.last_success as string | undefined,
    last_failure: metadata.last_failure as string | undefined,
    last_checked: metadata.last_checked as string | undefined,
    metadata: {
      refreshFrequencyMinutes: metadata.refreshFrequencyMinutes as number | undefined,
      pagination: metadata.pagination as any,
      termsRestrictions: metadata.termsRestrictions as string | undefined,
      healthStatus: (metadata.healthStatus as HealthStatus) ?? HealthStatus.UNKNOWN,
      sourceCapabilities: metadata.sourceCapabilities as any,
      tags: metadata.tags as string[] | undefined,
      notes: metadata.notes as string | undefined,
    },
  };
}

/**
 * SQL helper snippets for sources table queries using metadata JSONB
 */
export const SourceQueries = {
  findById: (id: string) => `SELECT * FROM sources WHERE id = $1`,
  
  findByCategory: (category: SourceCategory) => `
    SELECT * FROM sources 
    WHERE metadata->>'category' = $1
  `,
  
  findEnabled: () => `
    SELECT * FROM sources 
    WHERE (metadata->>'enabled' = 'true' OR metadata->>'enabled' IS NULL)
    ORDER BY (metadata->>'priority')::int DESC
  `,
  
  insert: () => `
    INSERT INTO sources (id, name, url, source_type, metadata)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      url = EXCLUDED.url,
      source_type = EXCLUDED.source_type,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `,
  
  updateEnabled: () => `
    UPDATE sources SET metadata = jsonb_set(metadata, '{enabled}', to_jsonb($2::boolean)), updated_at = NOW()
    WHERE id = $1
  `,
  
  updatePriority: () => `
    UPDATE sources SET metadata = jsonb_set(metadata, '{priority}', to_jsonb($2::int)), updated_at = NOW()
    WHERE id = $1
  `,
  
  updateHealthCheck: () => `
    UPDATE sources SET metadata = jsonb_set(
      jsonb_set(metadata, '{last_checked}', to_jsonb($2::timestamptz)),
      '{healthStatus}', to_jsonb($3)
    ), updated_at = NOW()
    WHERE id = $1
  `,
};

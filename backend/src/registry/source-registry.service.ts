import type { SourceRegistryEntry, SourceCategory } from '../../shared/src/registry/types';
import { HealthStatus } from '../../shared/src/registry/types';

export interface SourceRegistryService {
  register(entry: Omit<SourceRegistryEntry, 'source_id' | 'last_checked'>): Promise<SourceRegistryEntry>;
  update(entry: Partial<SourceRegistryEntry> & Pick<SourceRegistryEntry, 'source_id'>): Promise<SourceRegistryEntry>;
  enable(sourceId: string): Promise<void>;
  disable(sourceId: string): Promise<void>;
  updatePriority(sourceId: string, priority: number): Promise<void>;
  healthCheck(sourceId: string): Promise<{ status: HealthStatus; checkedAt: string }>;
  getById(sourceId: string): Promise<SourceRegistryEntry | null>;
  listByCategory(category: SourceCategory): Promise<SourceRegistryEntry[]>;
  listEnabled(): Promise<SourceRegistryEntry[]>;
  getAll(): Promise<SourceRegistryEntry[]>;
}

export class InMemorySourceRegistryService implements SourceRegistryService {
  private store = new Map<string, SourceRegistryEntry>();

  async register(entry: Omit<SourceRegistryEntry, 'source_id' | 'last_checked'>): Promise<SourceRegistryEntry> {
    const source_id = entry.source_id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const record: SourceRegistryEntry = {
      ...entry,
      source_id,
      last_checked: now,
    };
    this.store.set(source_id, record);
    return record;
  }

  async update(entry: Partial<SourceRegistryEntry> & Pick<SourceRegistryEntry, 'source_id'>): Promise<SourceRegistryEntry> {
    const existing = this.store.get(entry.source_id);
    if (!existing) throw new Error(`Source ${entry.source_id} not found`);
    const updated = { ...existing, ...entry };
    this.store.set(entry.source_id, updated);
    return updated;
  }

  async enable(sourceId: string): Promise<void> {
    await this.update({ source_id: sourceId, enabled: true });
  }

  async disable(sourceId: string): Promise<void> {
    await this.update({ source_id: sourceId, enabled: false });
  }

  async updatePriority(sourceId: string, priority: number): Promise<void> {
    if (priority < 1 || priority > 100) throw new Error('Priority must be between 1 and 100');
    await this.update({ source_id: sourceId, priority });
  }

  async healthCheck(sourceId: string): Promise<{ status: HealthStatus; checkedAt: string }> {
    const source = this.store.get(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    const checkedAt = new Date().toISOString();
    // Placeholder health check logic - does not perform scraping
    const status = source.enabled ? HealthStatus.HEALTHY : HealthStatus.DISABLED;
    await this.update({ 
      source_id: sourceId, 
      last_checked: checkedAt,
      metadata: { ...source.metadata, healthStatus: status }
    });
    return { status, checkedAt };
  }

  async getById(sourceId: string): Promise<SourceRegistryEntry | null> {
    return this.store.get(sourceId) ?? null;
  }

  async listByCategory(category: SourceCategory): Promise<SourceRegistryEntry[]> {
    return Array.from(this.store.values()).filter(s => s.category === category);
  }

  async listEnabled(): Promise<SourceRegistryEntry[]> {
    return Array.from(this.store.values()).filter(s => s.enabled);
  }

  async getAll(): Promise<SourceRegistryEntry[]> {
    return Array.from(this.store.values());
  }
}

// Database-backed implementation sketch
// In production, replace InMemorySourceRegistryService with PostgresSourceRegistryService
// that maps SourceRegistryEntry fields to `sources` table:
// - source_id -> id
// - name -> name
// - url -> url
// - source_type -> source_type
// - Remaining fields stored in metadata JSONB column
export class PostgresSourceRegistryService implements SourceRegistryService {
  // TODO: Inject pg client / Drizzle repository
  // CRUD operations map SourceRegistryEntry to sources table with metadata JSONB
  constructor(private dbClient?: unknown) {}

  private toDbRow(entry: SourceRegistryEntry) {
    const { source_id, name, url, sourceType, ...metadataFields } = entry;
    return {
      id: source_id,
      name,
      url: url ?? null,
      source_type: entry.source_type ?? sourceType ?? null,
      metadata: metadataFields,
      updated_at: new Date().toISOString(),
    };
  }

  async register(entry: Omit<SourceRegistryEntry, 'source_id' | 'last_checked'>): Promise<SourceRegistryEntry> {
    // INSERT INTO sources (id, name, url, source_type, metadata) VALUES (...)
    throw new Error('Postgres implementation not wired');
  }

  async update(entry: Partial<SourceRegistryEntry> & Pick<SourceRegistryEntry, 'source_id'>): Promise<SourceRegistryEntry> {
    // UPDATE sources SET ... WHERE id = $1
    throw new Error('Postgres implementation not wired');
  }

  async enable(sourceId: string): Promise<void> {
    await this.update({ source_id: sourceId, enabled: true });
  }

  async disable(sourceId: string): Promise<void> {
    await this.update({ source_id: sourceId, enabled: false });
  }

  async updatePriority(sourceId: string, priority: number): Promise<void> {
    await this.update({ source_id: sourceId, priority });
  }

  async healthCheck(sourceId: string): Promise<{ status: HealthStatus; checkedAt: string }> {
    const checkedAt = new Date().toISOString();
    // Perform lightweight endpoint health check without scraping content
    // Update metadata.last_checked and metadata.healthStatus
    throw new Error('Postgres implementation not wired');
  }

  async getById(sourceId: string): Promise<SourceRegistryEntry | null> {
    // SELECT * FROM sources WHERE id = $1
    throw new Error('Postgres implementation not wired');
  }

  async listByCategory(category: SourceCategory): Promise<SourceRegistryEntry[]> {
    // SELECT * FROM sources WHERE metadata->>'category' = $1
    throw new Error('Postgres implementation not wired');
  }

  async listEnabled(): Promise<SourceRegistryEntry[]> {
    // SELECT * FROM sources WHERE metadata->>'enabled' = 'true'
    throw new Error('Postgres implementation not wired');
  }

  async getAll(): Promise<SourceRegistryEntry[]> {
    // SELECT * FROM sources
    throw new Error('Postgres implementation not wired');
  }
}

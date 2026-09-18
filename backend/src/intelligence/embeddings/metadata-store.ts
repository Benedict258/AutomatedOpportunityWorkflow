import { EmbeddingMetadata } from './types';

export interface MetadataStore {
  create(metadata: Omit<EmbeddingMetadata, 'createdAt' | 'version'> & { version?: number }): Promise<EmbeddingMetadata>;
  update(entityType: string, entityId: string, updates: Partial<EmbeddingMetadata>): Promise<EmbeddingMetadata>;
  get(entityType: string, entityId: string): Promise<EmbeddingMetadata | null>;
  listByEntity(entityType: string, entityId: string): Promise<EmbeddingMetadata[]>;
  listByModel(model: string): Promise<EmbeddingMetadata[]>;
  pruneOldVersions(entityType: string, entityId: string, keepLatest: number): Promise<void>;
}

export class InMemoryMetadataStore implements MetadataStore {
  private store = new Map<string, EmbeddingMetadata[]>();

  private key(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  async create(metadata: Omit<EmbeddingMetadata, 'createdAt' | 'version'> & { version?: number }): Promise<EmbeddingMetadata> {
    const key = this.key(metadata.entityType, metadata.entityId);
    const list = this.store.get(key) ?? [];
    const version = metadata.version ?? list.length + 1;
    const now = new Date().toISOString();

    const record: EmbeddingMetadata = {
      ...metadata,
      version,
      createdAt: now,
    };

    list.push(record);
    this.store.set(key, list);
    return record;
  }

  async update(entityType: string, entityId: string, updates: Partial<EmbeddingMetadata>): Promise<EmbeddingMetadata> {
    const key = this.key(entityType, entityId);
    const list = this.store.get(key) ?? [];
    const latest = list[list.length - 1];
    if (!latest) throw new Error('Metadata not found');

    const updated: EmbeddingMetadata = {
      ...latest,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    list[list.length - 1] = updated;
    this.store.set(key, list);
    return updated;
  }

  async get(entityType: string, entityId: string): Promise<EmbeddingMetadata | null> {
    const list = this.store.get(this.key(entityType, entityId));
    return list?.[list.length - 1] ?? null;
  }

  async listByEntity(entityType: string, entityId: string): Promise<EmbeddingMetadata[]> {
    return this.store.get(this.key(entityType, entityId)) ?? [];
  }

  async listByModel(model: string): Promise<EmbeddingMetadata[]> {
    const results: EmbeddingMetadata[] = [];
    for (const list of this.store.values()) {
      for (const meta of list) {
        if (meta.model === model) results.push(meta);
      }
    }
    return results;
  }

  async pruneOldVersions(entityType: string, entityId: string, keepLatest: number): Promise<void> {
    const key = this.key(entityType, entityId);
    const list = this.store.get(key) ?? [];
    if (list.length <= keepLatest) return;
    const pruned = list.slice(-keepLatest);
    this.store.set(key, pruned);
  }
}

/**
 * PostgreSQL / pgvector metadata store stub.
 * Implement with actual queries to embedding_metadata table.
 */
export class PgVectorMetadataStore implements MetadataStore {
  constructor(private db: any) {}

  async create(metadata: Omit<EmbeddingMetadata, 'createdAt' | 'version'> & { version?: number }): Promise<EmbeddingMetadata> {
    // TODO: INSERT INTO embedding_metadata ...
    throw new Error('PgVectorMetadataStore.create not implemented');
  }

  async update(entityType: string, entityId: string, updates: Partial<EmbeddingMetadata>): Promise<EmbeddingMetadata> {
    throw new Error('PgVectorMetadataStore.update not implemented');
  }

  async get(entityType: string, entityId: string): Promise<EmbeddingMetadata | null> {
    throw new Error('PgVectorMetadataStore.get not implemented');
  }

  async listByEntity(entityType: string, entityId: string): Promise<EmbeddingMetadata[]> {
    throw new Error('PgVectorMetadataStore.listByEntity not implemented');
  }

  async listByModel(model: string): Promise<EmbeddingMetadata[]> {
    throw new Error('PgVectorMetadataStore.listByModel not implemented');
  }

  async pruneOldVersions(entityType: string, entityId: string, keepLatest: number): Promise<void> {
    throw new Error('PgVectorMetadataStore.pruneOldVersions not implemented');
  }
}

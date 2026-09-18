import { Embedder } from './embedder.interface';
import { Embedding, EmbeddingMetadata, EmbeddingStoreOptions } from './types';
import { MetadataStore, InMemoryMetadataStore } from './metadata-store';
import crypto from 'crypto';

export interface EmbeddingServiceOptions {
  embedder: Embedder;
  metadataStore?: MetadataStore;
  storeOptions?: EmbeddingStoreOptions;
  defaultEntityType?: string;
}

export class EmbeddingService {
  private metadataStore: MetadataStore;
  private embedder: Embedder;

  constructor(private options: EmbeddingServiceOptions) {
    this.embedder = options.embedder;
    this.metadataStore = options.metadataStore ?? new InMemoryMetadataStore();
  }

  get modelInfo() {
    return this.embedder.modelInfo;
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  async generate(
    text: string,
    entityType: string,
    entityId: string,
    opts?: { version?: string; forceRegenerate?: boolean }
  ): Promise<Embedding> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    const sourceHash = this.hashText(text);
    const existing = await this.metadataStore.get(entityType, entityId);

    if (existing && !opts?.forceRegenerate) {
      // In a real implementation, compare sourceHash to avoid re-embedding unchanged text
    }

    const vector = await this.embedder.embed(text);

    if (!this.embedder.validateVector(vector)) {
      throw new Error(`Vector dimensions mismatch for model ${this.embedder.modelInfo.name}`);
    }

    const metadata: Omit<EmbeddingMetadata, 'createdAt'> = {
      entityType,
      entityId,
      model: this.embedder.modelInfo.name,
      modelVersion: opts?.version ?? this.embedder.modelInfo.version ?? '1',
      provider: this.embedder.modelInfo.provider,
      dimensions: this.embedder.modelInfo.dimensions,
      version: existing ? existing.version + 1 : 1,
      sourceTextHash: sourceHash,
    };

    const created = await this.metadataStore.create(metadata);

    return {
      vector,
      metadata: created,
    };
  }

  async generateBatch(
    items: { text: string; entityType: string; entityId: string }[],
    opts?: { version?: string; forceRegenerate?: boolean }
  ): Promise<Embedding[]> {
    const texts = items.map(i => i.text);
    const vectors = await this.embedder.embedBatch(texts);

    const results: Embedding[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const vector = vectors[i];
      const sourceHash = this.hashText(item.text);
      const metadata: Omit<EmbeddingMetadata, 'createdAt'> = {
        entityType: item.entityType,
        entityId: item.entityId,
        model: this.embedder.modelInfo.name,
        modelVersion: opts?.version ?? this.embedder.modelInfo.version ?? '1',
        provider: this.embedder.modelInfo.provider,
        dimensions: this.embedder.modelInfo.dimensions,
        version: 1,
        sourceTextHash: sourceHash,
      };
      const created = await this.metadataStore.create(metadata);
      results.push({ vector, metadata: created });
    }
    return results;
  }

  async getMetadata(entityType: string, entityId: string): Promise<EmbeddingMetadata | null> {
    return this.metadataStore.get(entityType, entityId);
  }

  async getVersionHistory(entityType: string, entityId: string): Promise<EmbeddingMetadata[]> {
    return this.metadataStore.listByEntity(entityType, entityId);
  }

  async delete(entityType: string, entityId: string): Promise<void> {
    // TODO: delete vector from pgvector store if used
  }

  async pruneOldVersions(entityType: string, entityId: string, keepLatest = 3): Promise<void> {
    await this.metadataStore.pruneOldVersions(entityType, entityId, keepLatest);
  }
}

/**
 * Factory to create EmbeddingService using EMBEDDING_MODEL config slot.
 * Provider is resolved externally - this service does NOT hardcode providers.
 */
export async function createEmbeddingService(
  embedderFactory?: (model: string) => Promise<Embedder> | Embedder,
  metadataStore?: MetadataStore
): Promise<EmbeddingService> {
  const model = process.env.EMBEDDING_MODEL;
  if (!model) {
    throw new Error('EMBEDDING_MODEL config slot is not set');
  }

  if (!embedderFactory) {
    throw new Error('Embedder factory is required. Do not hardcode provider in this service.');
  }

  const embedder = await embedderFactory(model);
  return new EmbeddingService({ embedder, metadataStore });
}

import { Pool } from 'pg';
import crypto from 'crypto';
import {
  Embedding,
  EmbeddingMetadata,
  EmbeddingModelInfo,
  Embedder,
} from './types';
import { EmbeddingStore } from './embedding-store';
import { unifiedModelService, ModelExecutionOptions } from 'shared/models';

/**
 * Real embedder implementation using the unified model service.
 * Generates embeddings via the configured embedding model slot.
 */
export class UnifiedModelEmbedder implements Embedder {
  private _modelInfo: EmbeddingModelInfo;

  constructor(
    private unifiedService: typeof unifiedModelService,
    private modelId: string,
    private defaultDimensions: number = 1536
  ) {
    this._modelInfo = {
      name: modelId,
      provider: 'unified',
      dimensions: defaultDimensions,
      version: '1',
    };
  }

  get modelInfo(): EmbeddingModelInfo {
    return this._modelInfo;
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.unifiedService.embed('embedding', {
      texts: [text],
    });

    if (!result.data || result.data.embeddings.length === 0) {
      throw new Error('No embedding returned from model');
    }

    return result.data.embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const result = await this.unifiedService.embed('embedding', {
      texts,
    });

    if (!result.data) {
      throw new Error('No data returned from model');
    }

    return result.data.embeddings;
  }

  validateVector(vector: number[]): boolean {
    return vector.length === this.modelInfo.dimensions;
  }
}

export interface RealEmbeddingServiceOptions {
  pool: Pool;
  unifiedService?: typeof unifiedModelService;
  modelId?: string; // Model ID from registry (uses 'embedding' slot if not provided)
  tableName?: string;
  metadataTableName?: string;
  defaultDimensions?: number;
  enableCache?: boolean;
  batchSize?: number;
}

export interface EmbeddingGenerationOptions {
  entityType: 'opportunity' | 'candidate' | 'skill';
  entityId: string;
  text: string;
  forceRegenerate?: boolean;
  version?: string;
}

export interface BatchEmbeddingOptions {
  items: Array<{
    entityType: 'opportunity' | 'candidate' | 'skill';
    entityId: string;
    text: string;
  }>;
  forceRegenerate?: boolean;
  version?: string;
}

/**
 * Real Embedding Service - generates embeddings via unified model service
 * and stores them in PostgreSQL with pgvector.
 * 
 * Features:
 * - Uses MODEL_DEFAULT_EMBEDDING slot via unified model service
 * - Stores in pgvector with full metadata tracking
 * - Caches by content hash (SHA256)
 * - Supports batch processing
 * - Supports similarity search (cosine)
 * - Tracks model, version, dimensions, content hash, created_at
 */
export class RealEmbeddingService {
  private store: EmbeddingStore;
  private embedder: UnifiedModelEmbedder;
  private defaultDimensions: number;
  private enableCache: boolean;
  private batchSize: number;
  private modelId: string;

  constructor(private options: RealEmbeddingServiceOptions) {
    this.store = new EmbeddingStore({
      pool: options.pool,
      tableName: options.tableName,
      metadataTableName: options.metadataTableName,
    });

    this.defaultDimensions = options.defaultDimensions || 1536;
    this.enableCache = options.enableCache !== false;
    this.batchSize = options.batchSize || 100;
    this.modelId = options.modelId || 'embedding'; // Uses 'embedding' slot from registry

    // Initialize embedder with unified model service
    this.embedder = new UnifiedModelEmbedder(
      options.unifiedService || unifiedModelService,
      this.modelId,
      this.defaultDimensions
    );
  }

  /**
   * Initialize the service (creates tables if needed)
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
    
    // Ensure unified model service is initialized
    if (!this.options.unifiedService?.isInitialized() && !unifiedModelService.isInitialized()) {
      await unifiedModelService.initialize();
    }
  }

  /**
   * Generate SHA256 hash of text for caching/deduplication
   */
  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Build text representation for an opportunity
   */
  static buildOpportunityText(opportunity: {
    title: string;
    organization?: string;
    description?: string;
    location?: string;
    opportunityType?: string;
    skills?: string[];
  }): string {
    const parts = [
      opportunity.title,
      opportunity.organization,
      opportunity.description,
      opportunity.location,
      opportunity.opportunityType,
      opportunity.skills?.join(', '),
    ].filter(Boolean);

    return parts.join(' | ');
  }

  /**
   * Build text representation for a candidate
   */
  static buildCandidateText(candidate: {
    skills?: string[];
    experience?: Array<{ title: string; organization: string; description?: string }>;
    education?: Array<{ degree: string; field: string }>;
    locationPreferences?: string[];
    careerTargets?: string[];
  }): string {
    const parts = [
      candidate.skills?.join(', '),
      candidate.experience?.map(e => `${e.title} at ${e.organization}`).join('; '),
      candidate.education?.map(e => `${e.degree} in ${e.field}`).join('; '),
      candidate.locationPreferences?.join(', '),
      candidate.careerTargets?.join(', '),
    ].filter(Boolean);

    return parts.join(' | ');
  }

  /**
   * Build text representation for a skill
   */
  static buildSkillText(skill: {
    name: string;
    description?: string;
    category?: string;
  }): string {
    const parts = [
      skill.name,
      skill.description,
      skill.category,
    ].filter(Boolean);

    return parts.join(' | ');
  }

  /**
   * Generate and store embedding for a single entity
   */
  async generate(options: EmbeddingGenerationOptions): Promise<Embedding> {
    const { entityType, entityId, text, forceRegenerate, version } = options;

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    const sourceHash = this.hashText(text);

    // Check cache if enabled
    if (this.enableCache && !forceRegenerate) {
      const cached = await this.store.findByContentHash(sourceHash, this.modelId);
      if (cached) {
        return cached;
      }
    }

    // Check for existing embedding for this entity
    const existing = await this.store.getLatest(entityType, entityId);
    const nextVersion = existing ? existing.metadata.version + 1 : 1;

    // Generate embedding
    const vector = await this.embedder.embed(text);

    if (!this.embedder.validateVector(vector)) {
      throw new Error(`Vector dimensions mismatch: expected ${this.embedder.modelInfo.dimensions}, got ${vector.length}`);
    }

    // Create metadata
    const now = new Date().toISOString();
    const metadata: Omit<EmbeddingMetadata, 'createdAt'> = {
      entityType,
      entityId,
      model: this.embedder.modelInfo.name,
      modelVersion: version || this.embedder.modelInfo.version || '1',
      provider: this.embedder.modelInfo.provider,
      dimensions: this.embedder.modelInfo.dimensions,
      version: nextVersion,
      sourceTextHash: sourceHash,
    };

    // Store embedding
    const embedding: Embedding = {
      vector,
      metadata: { ...metadata, createdAt: now },
    };

    return this.store.insert(embedding);
  }

  /**
   * Generate and store embeddings for multiple entities in batch
   */
  async generateBatch(options: BatchEmbeddingOptions): Promise<Embedding[]> {
    const { items, forceRegenerate, version } = options;

    if (items.length === 0) return [];

    // Filter items that need regeneration (check cache)
    const itemsToProcess: Array<{ entityType: 'opportunity' | 'candidate' | 'skill'; entityId: string; text: string }> = [];
    const results: Embedding[] = [];

    if (this.enableCache && !forceRegenerate) {
      // Check cache for each item
      for (const item of items) {
        const sourceHash = this.hashText(item.text);
        const cached = await this.store.findByContentHash(sourceHash, this.modelId);
        if (cached) {
          results.push(cached);
        } else {
          itemsToProcess.push(item);
        }
      }
    } else {
      itemsToProcess.push(...items);
    }

    // Process remaining items in batches
    const embeddingsToStore: Embedding[] = [];

    for (let i = 0; i < itemsToProcess.length; i += this.batchSize) {
      const batch = itemsToProcess.slice(i, i + this.batchSize);
      const texts = batch.map(item => item.text);

      // Generate embeddings
      const vectors = await this.embedder.embedBatch(texts);

      // Build embeddings with metadata
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const vector = vectors[j];
        const sourceHash = this.hashText(item.text);

        const existing = await this.store.getLatest(item.entityType, item.entityId);
        const nextVersion = existing ? existing.metadata.version + 1 : 1;

        const now = new Date().toISOString();
        const metadata: Omit<EmbeddingMetadata, 'createdAt'> = {
          entityType: item.entityType,
          entityId: item.entityId,
          model: this.embedder.modelInfo.name,
          modelVersion: version || this.embedder.modelInfo.version || '1',
          provider: this.embedder.modelInfo.provider,
          dimensions: this.embedder.modelInfo.dimensions,
          version: nextVersion,
          sourceTextHash: sourceHash,
        };

        embeddingsToStore.push({
          vector,
          metadata: { ...metadata, createdAt: now },
        });
      }
    }

    // Batch insert
    if (embeddingsToStore.length > 0) {
      const stored = await this.store.insertBatch(embeddingsToStore);
      results.push(...stored);
    }

    return results;
  }

  /**
   * Generate embedding for an opportunity
   */
  async generateForOpportunity(
    opportunityId: string,
    opportunity: {
      title: string;
      organization?: string;
      description?: string;
      location?: string;
      opportunityType?: string;
      skills?: string[];
    },
    options?: { forceRegenerate?: boolean; version?: string }
  ): Promise<Embedding> {
    const text = RealEmbeddingService.buildOpportunityText(opportunity);
    return this.generate({
      entityType: 'opportunity',
      entityId: opportunityId,
      text,
      ...options,
    });
  }

  /**
   * Generate embedding for a candidate
   */
  async generateForCandidate(
    candidateId: string,
    candidate: {
      skills?: string[];
      experience?: Array<{ title: string; organization: string; description?: string }>;
      education?: Array<{ degree: string; field: string }>;
      locationPreferences?: string[];
      careerTargets?: string[];
    },
    options?: { forceRegenerate?: boolean; version?: string }
  ): Promise<Embedding> {
    const text = RealEmbeddingService.buildCandidateText(candidate);
    return this.generate({
      entityType: 'candidate',
      entityId: candidateId,
      text,
      ...options,
    });
  }

  /**
   * Generate embedding for a skill
   */
  async generateForSkill(
    skillId: string,
    skill: {
      name: string;
      description?: string;
      category?: string;
    },
    options?: { forceRegenerate?: boolean; version?: string }
  ): Promise<Embedding> {
    const text = RealEmbeddingService.buildSkillText(skill);
    return this.generate({
      entityType: 'skill',
      entityId: skillId,
      text,
      ...options,
    });
  }

  /**
   * Similarity search using cosine distance
   */
  async similaritySearch(
    queryVector: number[],
    options: {
      entityType?: 'opportunity' | 'candidate' | 'skill';
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<Array<{ embedding: Embedding; similarity: number }>> {
    return this.store.similaritySearch(queryVector, {
      entityType: options.entityType,
      limit: options.limit || 10,
      threshold: options.threshold || 0.7,
      model: this.modelId,
    });
  }

  /**
   * Find similar opportunities to a query text
   */
  async findSimilarOpportunities(
    queryText: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<Array<{ embedding: Embedding; similarity: number }>> {
    const queryVector = await this.embedder.embed(queryText);
    return this.similaritySearch(queryVector, {
      entityType: 'opportunity',
      ...options,
    });
  }

  /**
   * Find similar candidates to a query text
   */
  async findSimilarCandidates(
    queryText: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<Array<{ embedding: Embedding; similarity: number }>> {
    const queryVector = await this.embedder.embed(queryText);
    return this.similaritySearch(queryVector, {
      entityType: 'candidate',
      ...options,
    });
  }

  /**
   * Get embedding by entity
   */
  async getEmbedding(entityType: 'opportunity' | 'candidate' | 'skill', entityId: string): Promise<Embedding | null> {
    return this.store.getLatest(entityType, entityId);
  }

  /**
   * Get embedding metadata by entity
   */
  async getMetadata(entityType: 'opportunity' | 'candidate' | 'skill', entityId: string): Promise<EmbeddingMetadata | null> {
    return this.store.getMetadata(entityType, entityId);
  }

  /**
   * Get version history for an entity
   */
  async getVersionHistory(entityType: 'opportunity' | 'candidate' | 'skill', entityId: string): Promise<EmbeddingMetadata[]> {
    return this.store.getVersionHistory(entityType, entityId);
  }

  /**
   * Delete embedding for an entity
   */
  async delete(entityType: 'opportunity' | 'candidate' | 'skill', entityId: string): Promise<void> {
    return this.store.delete(entityType, entityId);
  }

  /**
   * Prune old versions
   */
  async pruneOldVersions(entityType: 'opportunity' | 'candidate' | 'skill', entityId: string, keepLatest = 3): Promise<void> {
    return this.store.pruneOldVersions(entityType, entityId, keepLatest);
  }

  /**
   * Get the underlying store for advanced operations
   */
  getStore(): EmbeddingStore {
    return this.store;
  }

  /**
   * Get the embedder for direct access
   */
  getEmbedder(): UnifiedModelEmbedder {
    return this.embedder;
  }

  /**
   * Get model info
   */
  getModelInfo(): EmbeddingModelInfo {
    return this.embedder.modelInfo;
  }
}

/**
 * Factory function to create RealEmbeddingService
 */
export async function createRealEmbeddingService(
  pool: Pool,
  options?: Partial<RealEmbeddingServiceOptions>
): Promise<RealEmbeddingService> {
  const service = new RealEmbeddingService({
    pool,
    ...options,
  });

  await service.initialize();
  return service;
}
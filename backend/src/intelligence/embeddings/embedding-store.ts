import { Pool, PoolClient, QueryResult } from 'pg';
import { Embedding, EmbeddingMetadata } from './types';

export interface EmbeddingStoreConfig {
  pool: Pool;
  tableName?: string;
  metadataTableName?: string;
}

export interface SimilaritySearchOptions {
  entityType?: 'opportunity' | 'candidate' | 'skill';
  limit?: number;
  threshold?: number;
  model?: string;
}

export interface SimilarityResult {
  embedding: Embedding;
  similarity: number;
}

/**
 * PostgreSQL / pgvector embedding store implementation.
 * Handles vector storage, similarity search, and metadata management.
 */
export class EmbeddingStore {
  private tableName: string;
  private metadataTableName: string;

  constructor(private config: EmbeddingStoreConfig) {
    this.tableName = config.tableName || 'embeddings';
    this.metadataTableName = config.metadataTableName || 'embedding_metadata';
  }

  /**
   * Initialize the store - create tables if they don't exist
   */
  async initialize(): Promise<void> {
    const client = await this.config.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.metadataTableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type VARCHAR(100) NOT NULL,
          entity_id UUID NOT NULL,
          model VARCHAR(255) NOT NULL,
          model_version VARCHAR(100),
          provider VARCHAR(100),
          dimensions INTEGER NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          source_text_hash VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS idx_embedding_metadata_entity 
          ON ${this.metadataTableName} (entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_embedding_metadata_model 
          ON ${this.metadataTableName} (model);
        CREATE INDEX IF NOT EXISTS idx_embedding_metadata_hash 
          ON ${this.metadataTableName} (source_text_hash);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          metadata_id UUID NOT NULL REFERENCES ${this.metadataTableName}(id) ON DELETE CASCADE,
          embedding VECTOR(1536) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_id 
          ON ${this.tableName} (metadata_id);
        CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
          ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Insert an embedding with its metadata
   */
  async insert(embedding: Embedding): Promise<Embedding> {
    const client = await this.config.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert metadata first
      const metaResult = await client.query(
        `INSERT INTO ${this.metadataTableName} 
         (entity_type, entity_id, model, model_version, provider, dimensions, version, source_text_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, created_at, updated_at`,
        [
          embedding.metadata.entityType,
          embedding.metadata.entityId,
          embedding.metadata.model,
          embedding.metadata.modelVersion || null,
          embedding.metadata.provider,
          embedding.metadata.dimensions,
          embedding.metadata.version,
          embedding.metadata.sourceTextHash,
          embedding.metadata.createdAt,
          embedding.metadata.updatedAt || null,
        ]
      );

      const metadataId = metaResult.rows[0].id;
      const createdAt = metaResult.rows[0].created_at;
      const updatedAt = metaResult.rows[0].updated_at;

      // Insert vector
      const vectorStr = `[${embedding.vector.join(',')}]`;
      await client.query(
        `INSERT INTO ${this.tableName} (metadata_id, embedding, created_at)
         VALUES ($1, $2::vector, $3)`,
        [metadataId, vectorStr, createdAt]
      );

      await client.query('COMMIT');

      return {
        ...embedding,
        id: metadataId,
        metadata: {
          ...embedding.metadata,
          createdAt,
          updatedAt,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Insert multiple embeddings in a batch
   */
  async insertBatch(embeddings: Embedding[]): Promise<Embedding[]> {
    if (embeddings.length === 0) return [];

    const client = await this.config.pool.connect();
    try {
      await client.query('BEGIN');

      const results: Embedding[] = [];

      for (const embedding of embeddings) {
        const metaResult = await client.query(
          `INSERT INTO ${this.metadataTableName} 
           (entity_type, entity_id, model, model_version, provider, dimensions, version, source_text_hash, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, created_at, updated_at`,
          [
            embedding.metadata.entityType,
            embedding.metadata.entityId,
            embedding.metadata.model,
            embedding.metadata.modelVersion || null,
            embedding.metadata.provider,
            embedding.metadata.dimensions,
            embedding.metadata.version,
            embedding.metadata.sourceTextHash,
            embedding.metadata.createdAt,
            embedding.metadata.updatedAt || null,
          ]
        );

        const metadataId = metaResult.rows[0].id;
        const createdAt = metaResult.rows[0].created_at;
        const updatedAt = metaResult.rows[0].updated_at;

        const vectorStr = `[${embedding.vector.join(',')}]`;
        await client.query(
          `INSERT INTO ${this.tableName} (metadata_id, embedding, created_at)
           VALUES ($1, $2::vector, $3)`,
          [metadataId, vectorStr, createdAt]
        );

        results.push({
          ...embedding,
          id: metadataId,
          metadata: {
            ...embedding.metadata,
            createdAt,
            updatedAt,
          },
        });
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get embedding by metadata ID
   */
  async getById(id: string): Promise<Embedding | null> {
    const client = await this.config.pool.connect();
    try {
      const result = await client.query(
        `SELECT m.*, e.embedding
         FROM ${this.metadataTableName} m
         JOIN ${this.tableName} e ON e.metadata_id = m.id
         WHERE m.id = $1`,
        [id]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToEmbedding(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get latest embedding for an entity
   */
  async getLatest(entityType: string, entityId: string): Promise<Embedding | null> {
    const client = await this.config.pool.connect();
    try {
      const result = await client.query(
        `SELECT m.*, e.embedding
         FROM ${this.metadataTableName} m
         JOIN ${this.tableName} e ON e.metadata_id = m.id
         WHERE m.entity_type = $1 AND m.entity_id = $2
         ORDER BY m.version DESC
         LIMIT 1`,
        [entityType, entityId]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToEmbedding(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Find embedding by content hash (for caching)
   */
  async findByContentHash(contentHash: string, model: string): Promise<Embedding | null> {
    const client = await this.config.pool.connect();
    try {
      const result = await client.query(
        `SELECT m.*, e.embedding
         FROM ${this.metadataTableName} m
         JOIN ${this.tableName} e ON e.metadata_id = m.id
         WHERE m.source_text_hash = $1 AND m.model = $2
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [contentHash, model]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToEmbedding(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Similarity search using cosine distance
   */
  async similaritySearch(
    queryVector: number[],
    options: SimilaritySearchOptions = {}
  ): Promise<SimilarityResult[]> {
    const {
      entityType,
      limit = 10,
      threshold = 0.7,
      model,
    } = options;

    const client = await this.config.pool.connect();
    try {
      const vectorStr = `[${queryVector.join(',')}]`;
      
      let query = `
        SELECT m.*, e.embedding,
               1 - (e.embedding <=> $1::vector) AS similarity
        FROM ${this.metadataTableName} m
        JOIN ${this.tableName} e ON e.metadata_id = m.id
        WHERE 1 - (e.embedding <=> $1::vector) >= $2
      `;
      const params: (string | number)[] = [vectorStr, threshold];
      let paramIndex = 3;

      if (entityType) {
        query += ` AND m.entity_type = $${paramIndex}`;
        params.push(entityType);
        paramIndex++;
      }

      if (model) {
        query += ` AND m.model = $${paramIndex}`;
        params.push(model);
        paramIndex++;
      }

      query += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        embedding: this.mapRowToEmbedding(row),
        similarity: parseFloat(row.similarity),
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get embedding metadata by entity
   */
  async getMetadata(entityType: string, entityId: string): Promise<EmbeddingMetadata | null> {
    const client = await this.config.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM ${this.metadataTableName}
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY version DESC
         LIMIT 1`,
        [entityType, entityId]
      );

      if (result.rows.length === 0) return null;

      return this.mapRowToMetadata(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get all versions for an entity
   */
  async getVersionHistory(entityType: string, entityId: string): Promise<EmbeddingMetadata[]> {
    const client = await this.config.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM ${this.metadataTableName}
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY version ASC`,
        [entityType, entityId]
      );

      return result.rows.map(row => this.mapRowToMetadata(row));
    } finally {
      client.release();
    }
  }

  /**
   * Delete embedding by entity
   */
  async delete(entityType: string, entityId: string): Promise<void> {
    const client = await this.config.pool.connect();
    try {
      await client.query(
        `DELETE FROM ${this.metadataTableName}
         WHERE entity_type = $1 AND entity_id = $2`,
        [entityType, entityId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Prune old versions, keeping only the latest N
   */
  async pruneOldVersions(entityType: string, entityId: string, keepLatest: number): Promise<void> {
    const client = await this.config.pool.connect();
    try {
      // Get IDs to keep
      const keepResult = await client.query(
        `SELECT id FROM ${this.metadataTableName}
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY version DESC
         LIMIT $3`,
        [entityType, entityId, keepLatest]
      );

      const keepIds = keepResult.rows.map(r => r.id);
      if (keepIds.length === 0) return;

      // Delete old versions (cascade will delete vectors)
      await client.query(
        `DELETE FROM ${this.metadataTableName}
         WHERE entity_type = $1 AND entity_id = $2
         AND id NOT IN (${keepIds.map((_, i) => `$${i + 3}`).join(',')})`,
        [entityType, entityId, ...keepIds]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get embeddings by model
   */
  async getByModel(model: string): Promise<Embedding[]> {
    const client = await this.config.pool.connect();
    try {
      const result = await client.query(
        `SELECT m.*, e.embedding
         FROM ${this.metadataTableName} m
         JOIN ${this.tableName} e ON e.metadata_id = m.id
         WHERE m.model = $1
         ORDER BY m.created_at DESC`,
        [model]
      );

      return result.rows.map(row => this.mapRowToEmbedding(row));
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Embedding
   */
  private mapRowToEmbedding(row: any): Embedding {
    return {
      id: row.id,
      vector: Array.isArray(row.embedding) ? row.embedding : row.embedding.slice(1, -1).split(',').map(Number),
      metadata: this.mapRowToMetadata(row),
    };
  }

  /**
   * Map database row to EmbeddingMetadata
   */
  private mapRowToMetadata(row: any): EmbeddingMetadata {
    return {
      entityType: row.entity_type,
      entityId: row.entity_id,
      model: row.model,
      modelVersion: row.model_version,
      provider: row.provider,
      dimensions: row.dimensions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      sourceTextHash: row.source_text_hash,
    };
  }
}

/**
 * Factory function to create EmbeddingStore from pool
 */
export function createEmbeddingStore(pool: Pool, tableName?: string): EmbeddingStore {
  return new EmbeddingStore({ pool, tableName });
}
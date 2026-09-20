import { PoolClient } from 'pg';
import { getPool, executeTransaction } from '../db/connection.js';

export interface EmbeddingMetadataRow {
  id: string;
  entity_type: string;
  entity_id: string;
  model: string;
  model_version: string | null;
  provider: string | null;
  dimensions: number;
  version: number;
  source_text_hash: string;
  created_at: string;
  updated_at: string | null;
}

export interface EmbeddingRow {
  id: string;
  metadata_id: string;
  embedding: number[];
  created_at: string;
}

export class PgEmbeddingRepository {
  async insertMetadata(meta: Omit<EmbeddingMetadataRow, 'id' | 'created_at' | 'updated_at'>): Promise<EmbeddingMetadataRow> {
    const query = `
      INSERT INTO embedding_metadata (entity_type, entity_id, model, model_version, provider, dimensions, version, source_text_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (entity_type, entity_id, version) DO UPDATE SET
        model = EXCLUDED.model,
        model_version = EXCLUDED.model_version,
        provider = EXCLUDED.provider,
        dimensions = EXCLUDED.dimensions,
        source_text_hash = EXCLUDED.source_text_hash,
        updated_at = NOW()
      RETURNING *;
    `;
    const params = [
      meta.entity_type,
      meta.entity_id,
      meta.model,
      meta.model_version ?? null,
      meta.provider ?? null,
      meta.dimensions,
      meta.version,
      meta.source_text_hash
    ];
    const res = await executeTransaction(async (client: PoolClient) => client.query(query, params));
    return res.rows[0];
  }

  async insertEmbedding(metadataId: string, vector: number[]): Promise<EmbeddingRow> {
    const query = `
      INSERT INTO embeddings (metadata_id, embedding)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const res = await executeTransaction(async (client: PoolClient) => client.query(query, [metadataId, `[${vector.join(',')}]`]));
    return res.rows[0];
  }

  async getByEntity(entityType: string, entityId: string): Promise<{ metadata: EmbeddingMetadataRow; embedding: EmbeddingRow } | null> {
    const query = `
      SELECT em.*, e.embedding, e.id as embedding_id, e.created_at as embedding_created_at
      FROM embedding_metadata em
      JOIN embeddings e ON e.metadata_id = em.id
      WHERE em.entity_type = $1 AND em.entity_id = $2
      ORDER BY em.version DESC
      LIMIT 1;
    `;
    const res = await getPool().query(query, [entityType, entityId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      metadata: {
        id: row.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        model: row.model,
        model_version: row.model_version,
        provider: row.provider,
        dimensions: row.dimensions,
        version: row.version,
        source_text_hash: row.source_text_hash,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      embedding: {
        id: row.embedding_id,
        metadata_id: row.metadata_id,
        embedding: row.embedding,
        created_at: row.embedding_created_at
      }
    };
  }

  async upsert(entityType: string, entityId: string, vector: number[], model = 'nvidia', modelVersion = '1', provider = 'nvidia', dimensions = 2048, version = 1, sourceTextHash = ''): Promise<{ metadata: EmbeddingMetadataRow; embedding: EmbeddingRow }> {
    // Insert or update metadata
    const meta = await this.insertMetadata({
      entity_type: entityType,
      entity_id: entityId,
      model,
      model_version: modelVersion,
      provider,
      dimensions,
      version,
      source_text_hash: sourceTextHash
    });
    // Insert embedding (replace if exists)
    const emb = await this.insertEmbedding(meta.id, vector);
    return { metadata: meta, embedding: emb };
  }

  async cosineSimilaritySearch(queryVector: number[], limit = 10, entityType?: string): Promise<Array<{ metadata: EmbeddingMetadataRow; embedding: EmbeddingRow; similarity: number }>> {
    const vectorLiteral = `[${queryVector.join(',')}]`;
    let sql = `
      SELECT em.*, e.embedding, e.id as embedding_id, e.created_at as embedding_created_at,
             1 - (e.embedding <=> $1) as similarity
      FROM embeddings e
      JOIN embedding_metadata em ON em.id = e.metadata_id
    `;
    const params: any[] = [vectorLiteral];
    if (entityType) {
      params.push(entityType);
      sql += ` WHERE em.entity_type = $${params.length}`;
    }
    sql += ` ORDER BY similarity DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await getPool().query(sql, params);
    return res.rows.map(row => ({
      metadata: {
        id: row.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        model: row.model,
        model_version: row.model_version,
        provider: row.provider,
        dimensions: row.dimensions,
        version: row.version,
        source_text_hash: row.source_text_hash,
        created_at: row.created_at,
        updated_at: row.updated_at
      },
      embedding: {
        id: row.embedding_id,
        metadata_id: row.metadata_id,
        embedding: row.embedding,
        created_at: row.embedding_created_at
      },
      similarity: parseFloat(row.similarity)
    }));
  }
}
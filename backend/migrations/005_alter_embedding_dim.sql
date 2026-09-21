-- Migration 005: Alter embedding dimension from 1536 to 2048
-- Aligns schema with NVIDIA Nemotron-3-Embed-1B (2048 dimensions)

-- Drop the view that depends on the embedding column
DROP VIEW IF EXISTS embedding_search;

-- Drop existing IVFFlat indexes that reference the old dimension
DROP INDEX IF EXISTS idx_opportunities_embedding;
DROP INDEX IF EXISTS idx_candidate_profiles_embedding;
DROP INDEX IF EXISTS idx_skills_embedding;
DROP INDEX IF EXISTS idx_embeddings_vector_ivfflat;

-- Alter embedding columns in core tables
ALTER TABLE opportunities ALTER COLUMN embedding TYPE VECTOR(2048) USING embedding::vector(2048);
ALTER TABLE candidate_profiles ALTER COLUMN embedding TYPE VECTOR(2048) USING embedding::vector(2048);
ALTER TABLE skills ALTER COLUMN embedding TYPE VECTOR(2048) USING embedding::vector(2048);

-- Alter embeddings table column
ALTER TABLE embeddings ALTER COLUMN embedding TYPE VECTOR(2048) USING embedding::vector(2048);

-- Recreate IVFFlat indexes with new dimension
CREATE INDEX idx_opportunities_embedding
    ON opportunities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_candidate_profiles_embedding
    ON candidate_profiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_skills_embedding
    ON skills USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_embeddings_vector_ivfflat
    ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Recreate the view with updated column references
CREATE OR REPLACE VIEW embedding_search AS
SELECT 
    e.id as embedding_id,
    em.id as metadata_id,
    em.entity_type,
    em.entity_id,
    em.model,
    em.model_version,
    em.provider,
    em.dimensions,
    em.version,
    em.source_text_hash,
    em.created_at,
    em.updated_at,
    e.embedding
FROM embeddings e
JOIN embedding_metadata em ON em.id = e.metadata_id;

-- Update comment on embeddings.embedding column
COMMENT ON COLUMN embeddings.embedding IS 'Vector embedding (2048 dimensions for nvidia/nemotron-3-embed-1b)';
-- Migration 004: Create embedding tables for pgvector storage
-- Supports embeddings for opportunities, candidates, and skills
-- Tracks model, version, dimensions, content hash, and timestamps

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding metadata table
-- Stores metadata about each embedding without the vector itself
CREATE TABLE IF NOT EXISTS embedding_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL,           -- 'opportunity', 'candidate', 'skill', etc.
    entity_id UUID NOT NULL,                     -- Reference to the entity
    model VARCHAR(255) NOT NULL,                 -- Model name (e.g., 'text-embedding-3-small')
    model_version VARCHAR(100),                  -- Model version if applicable
    provider VARCHAR(100),                       -- Provider name (e.g., 'openai', 'ollama')
    dimensions INTEGER NOT NULL,                 -- Vector dimensions (e.g., 1536)
    version INTEGER NOT NULL DEFAULT 1,          -- Version for this entity (incremental)
    source_text_hash VARCHAR(64) NOT NULL,       -- SHA256 hash of source text for caching
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT embedding_metadata_unique_entity_version 
        UNIQUE (entity_type, entity_id, version)
);

-- Indexes for embedding_metadata
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_entity 
    ON embedding_metadata (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_model 
    ON embedding_metadata (model);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_hash 
    ON embedding_metadata (source_text_hash);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_created 
    ON embedding_metadata (created_at);

-- Embeddings table with pgvector
-- Stores the actual vector embeddings with reference to metadata
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metadata_id UUID NOT NULL REFERENCES embedding_metadata(id) ON DELETE CASCADE,
    embedding VECTOR(1536) NOT NULL,             -- 1536 dimensions for text-embedding-3-small
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_id 
    ON embeddings (metadata_id);

-- HNSW index for fast similarity search (requires pgvector >= 0.5.0)
-- Using ivfflat as fallback for broader compatibility
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ivfflat 
    ON embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Optional: HNSW index for even better performance (uncomment if pgvector >= 0.5.0)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw 
--     ON embeddings USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 16, ef_construction = 64);

-- Add embedding column to opportunities table if not already present
-- (Already exists in 002_create_schema.sql but ensuring proper index)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunities' AND column_name = 'embedding'
    ) THEN
        ALTER TABLE opportunities ADD COLUMN embedding VECTOR(1536);
    END IF;
END $$;

-- Add embedding column to candidate_profiles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'candidate_profiles' AND column_name = 'embedding'
    ) THEN
        ALTER TABLE candidate_profiles ADD COLUMN embedding VECTOR(1536);
    END IF;
END $$;

-- Add embedding column to skills table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'skills' AND column_name = 'embedding'
    ) THEN
        ALTER TABLE skills ADD COLUMN embedding VECTOR(1536);
    END IF;
END $$;

-- Create vector indexes on entity tables for direct similarity search
CREATE INDEX IF NOT EXISTS idx_opportunities_embedding 
    ON opportunities USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_embedding 
    ON candidate_profiles USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_skills_embedding 
    ON skills USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Function to update updated_at timestamp on embedding_metadata
CREATE OR REPLACE FUNCTION update_embedding_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_embedding_metadata_updated_at ON embedding_metadata;
CREATE TRIGGER trigger_embedding_metadata_updated_at
    BEFORE UPDATE ON embedding_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_embedding_metadata_updated_at();

-- View for easy querying of embeddings with metadata
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

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON embedding_metadata TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON embeddings TO app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Comments
COMMENT ON TABLE embedding_metadata IS 'Metadata for embeddings - tracks model, version, content hash';
COMMENT ON TABLE embeddings IS 'Vector embeddings stored with pgvector';
COMMENT ON COLUMN embeddings.embedding IS 'Vector embedding (1536 dimensions for text-embedding-3-small)';
COMMENT ON COLUMN embedding_metadata.source_text_hash IS 'SHA256 hash of source text for deduplication/caching';
COMMENT ON INDEX idx_embeddings_vector_ivfflat IS 'IVFFlat index for cosine similarity search on embeddings';
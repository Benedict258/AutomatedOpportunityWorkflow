-- Migration 005: Alter embedding dimension from 1536 to 2048
-- Aligns schema with NVIDIA Nemotron-3-Embed-1B (2048 dimensions)

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

-- Optional: Uncomment to create HNSW indexes for better performance (requires pgvector >= 0.5.0)
-- CREATE INDEX idx_opportunities_embedding_hnsw ON opportunities USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- CREATE INDEX idx_candidate_profiles_embedding_hnsw ON candidate_profiles USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- CREATE INDEX idx_skills_embedding_hnsw ON skills USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
-- CREATE INDEX idx_embeddings_vector_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Update comment on embeddings.embedding column
COMMENT ON COLUMN embeddings.embedding IS 'Vector embedding (2048 dimensions for nvidia/nemotron-3-embed-1b)';
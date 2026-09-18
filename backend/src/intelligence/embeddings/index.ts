export * from './types';
export * from './embedder.interface';
export * from './embedding-service';
export * from './opportunity-embedder';
export * from './candidate-embedder';
export * from './skill-embedder';
export * from './metadata-store';
export * from './embedding-store';
export * from './real-embedding-service';

// Re-export core classes for barrel import
export { EmbeddingService, createEmbeddingService } from './embedding-service';
export { OpportunityEmbedder } from './opportunity-embedder';
export { CandidateEmbedder } from './candidate-embedder';
export { SkillEmbedder } from './skill-embedder';
export { InMemoryMetadataStore, PgVectorMetadataStore } from './metadata-store';
export { EmbeddingStore, createEmbeddingStore } from './embedding-store';
export { RealEmbeddingService, createRealEmbeddingService, UnifiedModelEmbedder } from './real-embedding-service';

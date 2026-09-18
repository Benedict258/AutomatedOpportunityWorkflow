export interface EmbeddingModelInfo {
  name: string;
  provider: string;
  dimensions: number;
  version?: string;
  description?: string;
}

export interface EmbeddingMetadata {
  entityType: 'opportunity' | 'candidate' | 'skill' | string;
  entityId: string;
  model: string;
  modelVersion?: string;
  provider: string;
  dimensions: number;
  createdAt: string; // ISO timestamp
  updatedAt?: string;
  version: number;
  sourceTextHash?: string;
}

export interface Embedding {
  id?: string;
  vector: number[];
  metadata: EmbeddingMetadata;
}

export interface EmbeddingWithText extends Embedding {
  text: string;
}

export interface EmbeddingStoreOptions {
  tableName?: string;
  usePgVector?: boolean;
}

export type EmbedderFactory = (model: string) => Promise<Embedder> | Embedder;

import { EmbeddingModelInfo } from './types';

export interface Embedder {
  modelInfo: EmbeddingModelInfo;

  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Validate that generated vector matches model dimensions
   */
  validateVector(vector: number[]): boolean;
}

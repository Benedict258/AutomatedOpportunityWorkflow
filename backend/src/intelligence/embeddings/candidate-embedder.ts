import { Embedder } from './embedder.interface';
import { EmbeddingModelInfo } from './types';

export interface Candidate {
  id: string;
  name?: string;
  resumeText?: string;
  skills?: string[];
  summary?: string;
}

/**
 * Stub embedder for candidates.
 */
export class CandidateEmbedder implements Embedder {
  public modelInfo: EmbeddingModelInfo;

  constructor(modelInfo: EmbeddingModelInfo) {
    this.modelInfo = modelInfo;
  }

  private buildText(candidate: Candidate): string {
    const parts = [
      candidate.summary,
      candidate.resumeText,
      candidate.skills?.join(' '),
    ].filter(Boolean);
    return parts.join('\n');
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('CandidateEmbedder.embed not implemented - inject provider');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    throw new Error('CandidateEmbedder.embedBatch not implemented - inject provider');
  }

  validateVector(vector: number[]): boolean {
    return vector.length === this.modelInfo.dimensions;
  }

  async embedCandidate(candidate: Candidate): Promise<number[]> {
    const text = this.buildText(candidate);
    return this.embed(text);
  }
}

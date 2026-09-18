import { Embedder } from './embedder.interface';
import { EmbeddingModelInfo } from './types';

export interface Opportunity {
  id: string;
  title: string;
  description?: string;
  requirements?: string[];
  location?: string;
  tags?: string[];
}

/**
 * Stub embedder for opportunities.
 * Replace with real provider implementation via factory.
 */
export class OpportunityEmbedder implements Embedder {
  public modelInfo: EmbeddingModelInfo;

  constructor(modelInfo: EmbeddingModelInfo) {
    this.modelInfo = modelInfo;
  }

  private buildText(opportunity: Opportunity): string {
    const parts = [
      opportunity.title,
      opportunity.description,
      opportunity.requirements?.join(' '),
      opportunity.tags?.join(' '),
    ].filter(Boolean);
    return parts.join('\n');
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('OpportunityEmbedder.embed not implemented - inject provider');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    throw new Error('OpportunityEmbedder.embedBatch not implemented - inject provider');
  }

  validateVector(vector: number[]): boolean {
    return vector.length === this.modelInfo.dimensions;
  }

  async embedOpportunity(opportunity: Opportunity): Promise<number[]> {
    const text = this.buildText(opportunity);
    return this.embed(text);
  }
}

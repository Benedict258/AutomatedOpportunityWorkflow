import { Embedder } from './embedder.interface';
import { EmbeddingModelInfo } from './types';

export interface Skill {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

/**
 * Stub embedder for skills.
 */
export class SkillEmbedder implements Embedder {
  public modelInfo: EmbeddingModelInfo;

  constructor(modelInfo: EmbeddingModelInfo) {
    this.modelInfo = modelInfo;
  }

  private buildText(skill: Skill): string {
    return [skill.name, skill.description, skill.category].filter(Boolean).join(' ');
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('SkillEmbedder.embed not implemented - inject provider');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    throw new Error('SkillEmbedder.embedBatch not implemented - inject provider');
  }

  validateVector(vector: number[]): boolean {
    return vector.length === this.modelInfo.dimensions;
  }

  async embedSkill(skill: Skill): Promise<number[]> {
    const text = this.buildText(skill);
    return this.embed(text);
  }
}

export type ClassificationConfidenceLevel = 'high' | 'medium' | 'low';

export interface ClassificationConfidence {
  score: number; // 0 - 1
  level: ClassificationConfidenceLevel;
  reasoning?: string;
}

export interface ClassificationResult {
  categoryId: string;
  categoryName: string;
  confidence: ClassificationConfidence;
  source: 'deterministic' | 'llm' | 'hybrid';
  path: string[];
  matchedTerms?: string[];
  metadata?: Record<string, unknown>;
}

export interface CategoryNode {
  id: string;
  name: string;
  parent: string | null;
  description?: string;
  active?: boolean;
  aliases?: string[];
  keywords?: string[];
  relatedTo?: string[];
  children?: CategoryNode[];
}

export interface ClassificationContext {
  title?: string;
  description?: string;
  sourceUrl?: string;
  tags?: string[];
  rawText?: string;
}

export interface ClassifyOptions {
  topK?: number;
  minConfidence?: number;
  includeChildren?: boolean;
}

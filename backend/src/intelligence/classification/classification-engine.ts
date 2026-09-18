import { Classifier } from './classifier.interface';
import { DeterministicClassifier } from './deterministic-classifier';
import { ClassificationResult, ClassificationContext, ClassifyOptions } from './types';

export interface ClassificationEngineOptions {
  deterministicClassifier?: Classifier;
  llmClassifier?: Classifier;
  deterministicThreshold?: number;
  fallbackOnEmpty?: boolean;
}

export class ClassificationEngine {
  private deterministic: Classifier;
  private llm?: Classifier;
  private deterministicThreshold: number;
  private fallbackOnEmpty: boolean;

  constructor(options: ClassificationEngineOptions = {}) {
    this.deterministic = options.deterministicClassifier ?? new DeterministicClassifier();
    this.llm = options.llmClassifier;
    this.deterministicThreshold = options.deterministicThreshold ?? 0.7;
    this.fallbackOnEmpty = options.fallbackOnEmpty ?? true;
  }

  async isAvailable(): Promise<boolean> {
    const detAvailable = await this.deterministic.isAvailable();
    const llmAvailable = this.llm ? await this.llm.isAvailable() : false;
    return detAvailable || llmAvailable;
  }

  async classify(text: string, context?: ClassificationContext, options?: ClassifyOptions): Promise<ClassificationResult[]> {
    // Step 1: Deterministic classification
    const deterministicResults = await this.deterministic.classify(text, context, {
      ...options,
      minConfidence: options?.minConfidence ?? 0.3,
      topK: options?.topK ?? 5
    });

    const highConfidence = deterministicResults.filter(r => r.confidence.score >= this.deterministicThreshold);

    if (highConfidence.length > 0) {
      return this.mergeResults(highConfidence, []);
    }

    // Step 2: Fallback to LLM if needed
    if (this.llm && (this.fallbackOnEmpty || deterministicResults.length === 0)) {
      const llmAvailable = await this.llm.isAvailable();
      if (llmAvailable) {
        const llmResults = await this.llm.classify(text, context, options);
        // Merge deterministic and LLM, prefer deterministic scores
        return this.mergeResults(deterministicResults, llmResults);
      }
    }

    // Return best deterministic results even if below threshold
    return deterministicResults;
  }

  private mergeResults(deterministic: ClassificationResult[], llm: ClassificationResult[]): ClassificationResult[] {
    const map = new Map<string, ClassificationResult>();

    for (const r of deterministic) {
      map.set(r.categoryId, { ...r, source: 'deterministic' });
    }

    for (const r of llm) {
      const existing = map.get(r.categoryId);
      if (existing) {
        // Hybrid: weighted average
        const combinedScore = (existing.confidence.score * 0.6) + (r.confidence.score * 0.4);
        map.set(r.categoryId, {
          ...existing,
          confidence: {
            ...existing.confidence,
            score: Number(combinedScore.toFixed(3)),
            reasoning: `${existing.confidence.reasoning} | LLM: ${r.confidence.reasoning}`
          },
          source: 'hybrid',
          metadata: { ...existing.metadata, llm: r.metadata }
        });
      } else {
        map.set(r.categoryId, { ...r, source: 'llm' });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.confidence.score - a.confidence.score);
  }

  async classifyBatch(items: Array<{ text: string; context?: ClassificationContext }>, options?: ClassifyOptions): Promise<ClassificationResult[][]> {
    const results: ClassificationResult[][] = [];
    for (const item of items) {
      const res = await this.classify(item.text, item.context, options);
      results.push(res);
    }
    return results;
  }
}

import { Classifier } from './classifier.interface';
import { ClassificationResult, ClassificationContext, ClassifyOptions, ClassificationConfidence, ClassificationConfidenceLevel } from './types';

interface LLMClient {
  complete(prompt: string, options?: Record<string, unknown>): Promise<string>;
}

export abstract class LLMClassifierAdapter implements Classifier {
  public readonly name = 'llm';

  protected abstract createClient(): LLMClient;

  protected getModelConfig(): { model: string; temperature?: number; maxTokens?: number } {
    const model = process.env.CLASSIFICATION_MODEL || process.env.LLM_MODEL || 'default';
    const temperature = Number(process.env.CLASSIFICATION_TEMPERATURE || '0');
    const maxTokens = Number(process.env.CLASSIFICATION_MAX_TOKENS || '512');
    return { model, temperature, maxTokens };
  }

  async isAvailable(): Promise<boolean> {
    const config = this.getModelConfig();
    // Provider-specific availability check can be implemented in subclasses
    return Boolean(config.model && config.model !== 'default');
  }

  async classify(text: string, context?: ClassificationContext, options?: ClassifyOptions): Promise<ClassificationResult[]> {
    const client = this.createClient();
    const config = this.getModelConfig();

    const prompt = this.buildPrompt(text, context);
    const response = await client.complete(prompt, {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    return this.parseResponse(response, options);
  }

  protected buildPrompt(text: string, context?: ClassificationContext): string {
    const title = context?.title ? `Title: ${context.title}\n` : '';
    const description = context?.description ? `Description: ${context.description}\n` : '';
    const tags = context?.tags?.length ? `Tags: ${context.tags.join(', ')}\n` : '';
    return `You are a taxonomy classifier for opportunities.
Classify the following text into one or more categories from the supported taxonomy:
WORK, TECHNICAL EXPERIENCE, CYBERSECURITY, GOVERNMENT, POLICY, INTERNATIONAL AFFAIRS, FELLOWSHIP, EDUCATION, EVENTS, NEWS
and their subcategories.

Return a JSON array of objects with categoryId, categoryName, confidenceScore (0-1), reasoning.

${title}${description}${tags}Text: ${text}

Output JSON only.`;
  }

  protected parseResponse(response: string, options?: ClassifyOptions): ClassificationResult[] {
    try {
      const cleaned = response.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleaned);
      const results: ClassificationResult[] = Array.isArray(data) ? data : [data];
      const topK = options?.topK ?? 5;
      const minConfidence = options?.minConfidence ?? 0.3;

      return results
        .map(item => {
          const score = Number(item.confidenceScore ?? item.confidence ?? 0);
          const level: ClassificationConfidenceLevel = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
          return {
            categoryId: String(item.categoryId || item.id || ''),
            categoryName: String(item.categoryName || item.name || ''),
            confidence: {
              score: Math.min(1, Math.max(0, score)),
              level,
              reasoning: String(item.reasoning || '')
            },
            source: 'llm' as const,
            path: [],
            matchedTerms: [],
            metadata: { raw: item }
          };
        })
        .filter(r => r.confidence.score >= minConfidence)
        .sort((a, b) => b.confidence.score - a.confidence.score)
        .slice(0, topK);
    } catch (err) {
      // Fallback safe parsing
      return [];
    }
  }
}

import { Classifier } from './classifier.interface';
import { ClassificationResult, ClassificationContext, ClassifyOptions, ClassificationConfidenceLevel } from './types';
import { DeterministicClassifier } from './deterministic-classifier';
import { unifiedModelService } from 'shared/models/unified-service';
import { buildClassificationPrompt, PROMPT_VERSION, getPromptHash } from './prompt-v1';
import { getTaxonomyMapper } from './taxonomy-mapper';
import { NormalizedOpportunity } from '../../discovery/normalization/types';

interface ModelClassificationOutput {
  categoryId: string;
  confidenceScore: number;
  reasoning: string;
}

/**
 * Real Classifier - Uses unified model service for classification with deterministic fallback
 * 
 * Input: NormalizedOpportunity
 * Output: ClassificationResult with categoryId, confidence, path in taxonomy
 * Model slot: classification (via MODEL_DEFAULT_CLASSIFICATION)
 * Deterministic fallback: existing deterministic-classifier.ts
 * Taxonomy conformance: only allow categories from taxonomy
 * Prompt versioning: v1
 */
export class RealClassifier implements Classifier {
  public readonly name = 'real';
  private deterministicClassifier: DeterministicClassifier;
  private taxonomyMapper = getTaxonomyMapper();
  private modelInitialized = false;

  constructor() {
    this.deterministicClassifier = new DeterministicClassifier();
  }

  /**
   * Initialize the model service if not already done
   */
  private async ensureModelInitialized(): Promise<void> {
    if (!this.modelInitialized) {
      try {
        await unifiedModelService.initialize();
        this.modelInitialized = true;
      } catch (error) {
        console.warn('[RealClassifier] Failed to initialize model service:', error);
        this.modelInitialized = false;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    // Check if model service is available
    await this.ensureModelInitialized();
    const modelAvailable = unifiedModelService.isInitialized();
    
    // Also check deterministic as ultimate fallback
    const deterministicAvailable = await this.deterministicClassifier.isAvailable();
    
    return modelAvailable || deterministicAvailable;
  }

  /**
   * Classify a NormalizedOpportunity using the model with deterministic fallback
   */
  async classifyOpportunity(
    opportunity: NormalizedOpportunity,
    options?: ClassifyOptions
  ): Promise<ClassificationResult[]> {
    // Build context from opportunity
    const context: ClassificationContext = {
      title: opportunity.title,
      description: opportunity.description,
      tags: opportunity.category,
      rawText: opportunity.description
    };

    // Combine title and description for classification text
    const text = [
      opportunity.title,
      opportunity.description,
      opportunity.organization,
      opportunity.location,
      ...(opportunity.category || []),
      ...(opportunity.skills?.map(s => s.name) || [])
    ].filter(Boolean).join(' ');

    return this.classify(text, context, options);
  }

  async classify(
    text: string,
    context?: ClassificationContext,
    options?: ClassifyOptions
  ): Promise<ClassificationResult[]> {
    const topK = options?.topK ?? 5;
    const minConfidence = options?.minConfidence ?? 0.3;

    // Try model-based classification first
    const modelResults = await this.classifyWithModel(text, context, options);
    
    if (modelResults.length > 0) {
      // Filter by confidence threshold
      const filtered = modelResults.filter(r => r.confidence.score >= minConfidence);
      if (filtered.length > 0) {
        return filtered.slice(0, topK);
      }
    }

    // Fallback to deterministic classifier
    console.log('[RealClassifier] Falling back to deterministic classifier');
    return this.deterministicClassifier.classify(text, context, options);
  }

  /**
   * Classify using the unified model service
   */
  private async classifyWithModel(
    text: string,
    context?: ClassificationContext,
    options?: ClassifyOptions
  ): Promise<ClassificationResult[]> {
    try {
      await this.ensureModelInitialized();
      
      if (!unifiedModelService.isInitialized()) {
        console.warn('[RealClassifier] Model service not initialized, skipping model classification');
        return [];
      }

      // Build prompt
      const { systemPrompt, userPrompt } = buildClassificationPrompt({
        title: context?.title || '',
        description: context?.description,
        organization: context?.sourceUrl,
        tags: context?.tags,
        rawText: context?.rawText || text
      });

      // Call model service with classification operation
      const executionResult = await unifiedModelService.classify(userPrompt, {
        operation: 'classification',
        metadata: { systemPrompt, responseFormat: 'json', temperature: 0, maxTokens: 1024 }
      });

      if (!executionResult.success || !executionResult.data) {
        console.warn('[RealClassifier] Model classification failed:', executionResult.error);
        return [];
      }

      // Parse model response
      const modelOutput = this.parseModelResponse(executionResult.data);
      
      // Validate against taxonomy
      const validatedResults = this.taxonomyMapper.validateResults(modelOutput);
      
      // Convert to ClassificationResult format
      const results: ClassificationResult[] = validatedResults.map(r => {
        const confidenceLevel: ClassificationConfidenceLevel = 
          r.confidenceScore >= 0.7 ? 'high' : 
          r.confidenceScore >= 0.4 ? 'medium' : 'low';

        return {
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          confidence: {
            score: Number(r.confidenceScore.toFixed(3)),
            level: confidenceLevel,
            reasoning: r.reasoning
          },
          source: 'llm' as const,
          path: r.path,
          matchedTerms: [],
          metadata: {
            promptVersion: PROMPT_VERSION,
            promptHash: getPromptHash(),
            modelLatencyMs: executionResult.executionRecord.latencyMs,
            tokenUsage: executionResult.executionRecord.tokenUsage
          }
        };
      });

      // Sort by confidence and limit
      results.sort((a, b) => b.confidence.score - a.confidence.score);
      return results.slice(0, options?.topK ?? 5);

    } catch (error) {
      console.error('[RealClassifier] Model classification error:', error);
      return [];
    }
  }

  /**
   * Parse model response into structured output
   */
  private parseModelResponse(response: any): ModelClassificationOutput[] {
    try {
      let content: string;
      
      if (typeof response === 'string') {
        content = response;
      } else if (response.content) {
        content = response.content;
      } else if (response.text) {
        content = response.text;
      } else if (response.choices?.[0]?.message?.content) {
        content = response.choices[0].message.content;
      } else {
        content = JSON.stringify(response);
      }

      // Clean up response
      const cleaned = content
        .replace(/```json|```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      
      if (!Array.isArray(parsed)) {
        console.warn('[RealClassifier] Model response is not an array');
        return [];
      }

      // Validate each item
      return parsed
        .filter(item => item && typeof item.categoryId === 'string' && typeof item.confidenceScore === 'number')
        .map(item => ({
          categoryId: String(item.categoryId),
          confidenceScore: Math.max(0, Math.min(1, Number(item.confidenceScore))),
          reasoning: String(item.reasoning || '')
        }));

    } catch (error) {
      console.error('[RealClassifier] Failed to parse model response:', error);
      return [];
    }
  }
}

/**
 * Factory function to create a RealClassifier with custom deterministic fallback
 */
export function createRealClassifier(
  deterministicClassifier?: DeterministicClassifier
): RealClassifier {
  const classifier = new RealClassifier();
  if (deterministicClassifier) {
    // Replace the internal deterministic classifier
    (classifier as any).deterministicClassifier = deterministicClassifier;
  }
  return classifier;
}
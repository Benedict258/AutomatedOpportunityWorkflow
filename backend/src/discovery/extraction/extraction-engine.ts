import type { RawDocument, ExtractionContext, ExtractionResult, ExtractionPipelineOptions, ExtractionMetrics } from './types';
import type { Extractor } from './extractor.interface';
import { DeterministicExtractor } from './deterministic-extractor';
import { GenericLLMExtractor } from './llm-extraction-adapter';

export interface ExtractionEngineOptions extends ExtractionPipelineOptions {
  extractors?: Extractor[];
  defaultExtractor?: Extractor;
}

export class ExtractionEngine {
  private extractors: Extractor[];
  private options: ExtractionPipelineOptions;

  constructor(options?: ExtractionEngineOptions) {
    this.options = {
      enableDeterministicFirst: true,
      enableLLMFallback: true,
      confidenceThreshold: 0.6,
      maxRetries: 1,
      timeoutMs: 30000,
      ...options,
    };

    this.extractors = options?.extractors ?? [new DeterministicExtractor()];
  }

  registerExtractor(extractor: Extractor): void {
    this.extractors.unshift(extractor);
  }

  async extractDocument(document: RawDocument, context?: Partial<ExtractionContext>): Promise<ExtractionResult> {
    const ctx: ExtractionContext = {
      sourceId: document.sourceId,
      documentId: document.documentId,
      contentType: (document.contentType || 'unknown') as any,
      schemaVersion: 'v1',
      ...context,
    };

    const candidates = this.extractors.filter(e => e.canHandle(document, ctx));

    if (candidates.length === 0) {
      return this.buildFallbackResult(document, ctx, 'NO_EXTRACTOR');
    }

    let lastError: Error | null = null;
    let bestResult: ExtractionResult | null = null;

    for (const extractor of candidates) {
      try {
        const result = await this.runWithTimeout(extractor.extract(document, ctx), this.options.timeoutMs || 30000);
        if (result) {
          if (this.options.enableDeterministicFirst && extractor.name === 'deterministic-extractor') {
            // Accept deterministic if confidence meets threshold
            if (result.confidence >= (this.options.confidenceThreshold || 0.6) && result.errors.length === 0) {
              return result;
            }
          }
          // Keep best result
          if (!bestResult || result.confidence > bestResult.confidence) {
            bestResult = result;
          }
          // If confidence is high enough, return early
          if (result.confidence >= (this.options.confidenceThreshold || 0.6) && result.errors.length === 0) {
            return result;
          }
        }
      } catch (e: any) {
        lastError = e;
        continue;
      }
    }

    // LLM fallback if enabled and we haven't succeeded
    if (this.options.enableLLMFallback && !bestResult) {
      const llmExtractor = this.extractors.find(e => e.getCapabilities?.()?.supportsLLM);
      if (llmExtractor) {
        try {
          const result = await llmExtractor.extract(document, ctx);
          return result;
        } catch {}
      }
    }

    if (bestResult) {
      return bestResult;
    }

    return this.buildFallbackResult(document, ctx, lastError?.message || 'EXTRACTION_FAILED');
  }

  async extractBatch(documents: RawDocument[], contextFactory?: (doc: RawDocument) => Partial<ExtractionContext>): Promise<{ results: ExtractionResult[]; metrics: ExtractionMetrics }> {
    const start = Date.now();
    const results: ExtractionResult[] = [];
    let warningsCount = 0;
    let errorsCount = 0;
    let confidenceSum = 0;

    for (const doc of documents) {
      const ctx = contextFactory?.(doc);
      const res = await this.extractDocument(doc, ctx);
      results.push(res);
      warningsCount += res.warnings.length;
      errorsCount += res.errors.length;
      confidenceSum += res.confidence;
      // Simple backpressure
    }

    const succeeded = results.filter(r => r.errors.length === 0 && r.confidence >= (this.options.confidenceThreshold || 0.6)).length;
    const failed = results.length - succeeded;
    const avgConfidence = results.length ? confidenceSum / results.length : 0;

    const metrics: ExtractionMetrics = {
      documentsProcessed: results.length,
      documentsSucceeded: succeeded,
      documentsFailed: failed,
      avgConfidence,
      totalProcessingMs: Date.now() - start,
      warningsCount,
      errorsCount,
    };

    return { results, metrics };
  }

  private async runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    let timeout!: NodeJS.Timeout;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), ms);
    });
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeout);
    return result;
  }

  private buildFallbackResult(document: RawDocument, context: ExtractionContext, reason: string): ExtractionResult {
    return {
      documentId: document.documentId,
      sourceId: document.sourceId,
      extractedAt: new Date().toISOString(),
      fields: {},
      confidence: 0,
      warnings: [],
      errors: [{ code: 'EXTRACTOR_ERROR', message: reason, recoverable: false }],
      provenance: {
        extractor: 'none',
        contentType: context.contentType,
        processingMs: 0,
      },
    };
  }
}

/**
 * Factory helper to create a pre-configured engine with deterministic + LLM fallback.
 */
export function createDefaultExtractionEngine(options?: ExtractionEngineOptions): ExtractionEngine {
  const deterministic = new DeterministicExtractor();
  const llm = new GenericLLMExtractor({ model: process.env.EXTRACTION_MODEL });
  return new ExtractionEngine({
    ...options,
    extractors: [deterministic, llm],
  });
}

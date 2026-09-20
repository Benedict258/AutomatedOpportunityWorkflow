/**
 * Extraction Engine
 * 
 * Orchestrates model-backed extraction with deterministic fallback.
 * Integrates with unified model service for LLM extraction,
 * falls back to deterministic extractor when model unavailable.
 */

import { UnifiedModelService } from 'shared/models/unified-service';
import { DeterministicExtractor } from '../../discovery/extraction/deterministic-extractor';
import type { RawDocument } from '../../discovery/extraction/types';
import type {
  ExtractedFields,
  ExtractionResult,
  ExtractionContext,
  ExtractionOptions,
  ExtractionEngineConfig,
  ExtractionMetrics,
  ExtractionProvenance,
  FallbackEvent,
  FieldProvenance,
  ValidationResult,
  ExtractionWarning,
  ExtractionError
} from './types';
import { buildExtractionPrompt, PROMPT_VERSION, getPromptHash, EXTRACTION_JSON_SCHEMA } from './prompt-v1';
import { validateExtraction, applyValidationToResult } from './validator';

export class ExtractionEngine {
  private unifiedModelService: UnifiedModelService;
  private deterministicExtractor: DeterministicExtractor;
  private defaultPromptVersion: string;
  private defaultConfidenceThreshold: number;
  private defaultTimeoutMs: number;
  private maxRetries: number;
  private enableObservability: boolean;
  
  // Metrics tracking
  private metrics: ExtractionMetrics = {
    documentsProcessed: 0,
    documentsSucceeded: 0,
    documentsFailed: 0,
    modelExtractions: 0,
    deterministicExtractions: 0,
    fallbackCount: 0,
    avgOverallConfidence: 0,
    avgModelConfidence: 0,
    avgDeterministicConfidence: 0,
    totalProcessingMs: 0,
    totalModelLatencyMs: 0,
    totalTokensUsed: 0,
    estimatedCostUsd: 0,
    warningsCount: 0,
    errorsCount: 0
  };

  constructor(config: ExtractionEngineConfig) {
    this.unifiedModelService = config.unifiedModelService;
    this.deterministicExtractor = config.deterministicExtractor || new DeterministicExtractor();
    this.defaultPromptVersion = config.defaultPromptVersion || PROMPT_VERSION;
    this.defaultConfidenceThreshold = config.defaultConfidenceThreshold || 0.7;
    this.defaultTimeoutMs = config.defaultTimeoutMs || 30000;
    this.maxRetries = config.maxRetries || 2;
    this.enableObservability = config.enableObservability ?? true;
  }

  /**
   * Main extraction entry point
   */
  async extract(
    document: RawDocument,
    context: ExtractionContext,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const traceId = options.traceId || `ext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const mergedOptions: Required<ExtractionOptions> = {
      enableModelExtraction: options.enableModelExtraction ?? true,
      enableDeterministicFallback: options.enableDeterministicFallback ?? true,
      confidenceThreshold: options.confidenceThreshold ?? this.defaultConfidenceThreshold,
      maxRetries: options.maxRetries ?? this.maxRetries,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      promptVersion: options.promptVersion ?? this.defaultPromptVersion,
      modelId: options.modelId as string,
      traceId
    };

    this.metrics.documentsProcessed++;

    try {
      // Try model extraction first
      if (mergedOptions.enableModelExtraction && this.unifiedModelService.isInitialized()) {
        const modelResult = await this.extractWithModel(document, context, mergedOptions);
        
        // Check if model extraction meets confidence threshold
        if (modelResult.overallConfidence >= mergedOptions.confidenceThreshold) {
          this.recordSuccess(modelResult, startTime, 'model');
          return modelResult;
        }

        // Model confidence too low, try deterministic fallback
        if (mergedOptions.enableDeterministicFallback) {
          this.metrics.fallbackCount++;
          const fallbackEvent: FallbackEvent = {
            fromExtractor: 'model',
            toExtractor: 'deterministic',
            reason: `Model confidence ${modelResult.overallConfidence.toFixed(2)} below threshold ${mergedOptions.confidenceThreshold}`,
            timestamp: new Date().toISOString(),
            latencyMs: Date.now() - startTime
          };

          const detResult = await this.extractDeterministic(document, context);
          return this.mergeWithFallback(modelResult, detResult, fallbackEvent, startTime);
        }

        // No fallback, return model result anyway
        this.recordSuccess(modelResult, startTime, 'model');
        return modelResult;
      }

      // Model not available or disabled, use deterministic
      const detResult = await this.extractDeterministic(document, context);
      this.recordSuccess(detResult, startTime, 'deterministic');
      return detResult;

    } catch (error) {
      // Model extraction failed, try deterministic fallback
      if (mergedOptions.enableDeterministicFallback) {
        this.metrics.fallbackCount++;
        const fallbackEvent: FallbackEvent = {
          fromExtractor: 'model',
          toExtractor: 'deterministic',
          reason: `Model extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          latencyMs: Date.now() - startTime
        };

        try {
          const detResult = await this.extractDeterministic(document, context);
          const modelResult = this.buildFailedModelResult(document, context, error, startTime);
          return this.mergeWithFallback(modelResult, detResult, fallbackEvent, startTime);
        } catch (detError) {
          // Both failed
          this.metrics.documentsFailed++;
          this.metrics.errorsCount++;
          return this.buildCompleteFailure(document, context, error, detError, startTime);
        }
      }

      // No fallback enabled
      this.metrics.documentsFailed++;
      this.metrics.errorsCount++;
      return this.buildCompleteFailure(document, context, error, null, startTime);
    }
  }

  /**
   * Extract using the unified model service
   */
  private async extractWithModel(
    document: RawDocument,
    context: ExtractionContext,
    options: Required<ExtractionOptions>
  ): Promise<ExtractionResult> {
    const modelStartTime = Date.now();
    const promptHash = getPromptHash();

    const { systemPrompt, userPrompt } = buildExtractionPrompt(document, context);

    const executionResult = await this.unifiedModelService.generateStructured(
      'extraction',
      {
        prompt: userPrompt,
        systemPrompt,
        schema: EXTRACTION_JSON_SCHEMA,
        temperature: 0.1,
        maxTokens: 4096,
        metadata: {
          documentId: document.documentId,
          sourceId: context.sourceId,
          promptVersion: options.promptVersion,
          traceId: options.traceId
        }
      },
      {
        operation: 'extraction',
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries,
        metadata: {
      modelId: options.modelId as string,
          documentId: document.documentId,
          sourceId: context.sourceId,
          promptVersion: options.promptVersion
        }
      }
    );

    const modelLatencyMs = Date.now() - modelStartTime;
    this.metrics.totalModelLatencyMs += modelLatencyMs;

    if (!executionResult.success || !executionResult.data) {
      throw new Error(`Model extraction failed: ${executionResult.error?.message || 'Unknown error'}`);
    }

    const response = executionResult.data as any;
    const rawFields = response.fields || {};
    const modelWarnings = response.warnings || [];

    // Convert to ExtractedFields with provenance
    const fields: ExtractedFields = {};
    let totalConfidence = 0;
    let fieldCount = 0;

    for (const [fieldName, fieldData] of Object.entries(rawFields)) {
      const fd = fieldData as { value: unknown; confidence: number };
      const confidence = typeof fd.confidence === 'number' ? fd.confidence : 0.5;
      
      fields[fieldName] = {
        value: fd.value,
        confidence,
        provenance: {
          extractor: 'model',
          modelId: executionResult.data!.model,
          modelVersion: executionResult.executionRecord.modelVersion,
          promptVersion: options.promptVersion,
          promptHash,
          extractionLatencyMs: modelLatencyMs,
          tokenUsage: executionResult.data!.usage ? {
            promptTokens: executionResult.data!.usage!.promptTokens,
            completionTokens: executionResult.data!.usage!.completionTokens,
            totalTokens: executionResult.data!.usage!.totalTokens
          } : undefined,
          fallbackUsed: false
        },
        rawSource: typeof document.rawData === 'string' ? document.rawData.slice(0, 500) : undefined
      };
      totalConfidence += confidence;
      fieldCount++;
    }

    const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    // Build provenance
    const provenance: ExtractionProvenance = {
      primaryExtractor: 'model',
      modelId: executionResult.data!.model,
      modelVersion: executionResult.executionRecord.modelVersion,
      promptVersion: options.promptVersion,
      modelLatencyMs,
      totalLatencyMs: Date.now() - modelStartTime,
      tokenUsage: executionResult.data!.usage ? {
        promptTokens: executionResult.data!.usage!.promptTokens,
        completionTokens: executionResult.data!.usage!.completionTokens,
        totalTokens: executionResult.data!.usage!.totalTokens,
        estimatedCostUsd: this.estimateCost(executionResult.data!.model, executionResult.data!.usage!)
      } : undefined,
      fallbackChain: [],
      validationResults: []
    };

    // Add model warnings
    const warnings: ExtractionWarning[] = modelWarnings.map((w: string, i: number) => ({
      code: 'MODEL_WARNING',
      message: w,
      severity: 'low' as const,
      extractor: 'model'
    }));

    const result: ExtractionResult = {
      documentId: document.documentId,
      sourceId: document.sourceId,
      extractedAt: new Date().toISOString(),
      fields,
      overallConfidence,
      warnings,
      errors: [],
      provenance,
      rawPreview: typeof document.rawData === 'string' ? document.rawData.slice(0, 1000) : undefined
    };

    // Validate and apply validation results
    const validation = validateExtraction(fields);
    return applyValidationToResult(result, validation);
  }

  /**
   * Extract using deterministic extractor
   */
  private async extractDeterministic(
    document: RawDocument,
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    const detStartTime = Date.now();

    // Check if deterministic extractor can handle this document
    if (!this.deterministicExtractor.canHandle(document, context as any)) {
      throw new Error('Deterministic extractor cannot handle this content type');
    }

    const detResult = await this.deterministicExtractor.extract(document, context as any);

    // Convert to intelligence extraction format with provenance
    const fields: ExtractedFields = {};
    for (const [fieldName, value] of Object.entries(detResult.fields)) {
      fields[fieldName] = {
        value,
        confidence: detResult.confidence,
        provenance: {
          extractor: 'deterministic',
          promptVersion: PROMPT_VERSION,
          extractionLatencyMs: detResult.provenance.processingMs || 0,
          fallbackUsed: false
        }
      };
    }

    const provenance: ExtractionProvenance = {
      primaryExtractor: 'deterministic',
      promptVersion: PROMPT_VERSION,
      modelLatencyMs: 0,
      totalLatencyMs: Date.now() - detStartTime,
      fallbackChain: [],
      validationResults: []
    };

    return {
      documentId: document.documentId,
      sourceId: document.sourceId,
      extractedAt: new Date().toISOString(),
      fields,
      overallConfidence: detResult.confidence,
      warnings: detResult.warnings.map(w => ({
        ...w,
        severity: w.severity || 'medium',
        extractor: 'deterministic'
      })),
      errors: detResult.errors.map(e => ({
        ...e,
        recoverable: e.recoverable ?? true,
        extractor: 'deterministic'
      })),
      provenance,
      rawPreview: detResult.rawPreview
    };
  }

  /**
   * Merge model result with deterministic fallback
   */
  private mergeWithFallback(
    modelResult: ExtractionResult,
    detResult: ExtractionResult,
    fallbackEvent: FallbackEvent,
    startTime: number
  ): ExtractionResult {
    // Use deterministic result as base, but preserve model fields that have higher confidence
    const mergedFields: ExtractedFields = { ...detResult.fields };

    for (const [fieldName, modelField] of Object.entries(modelResult.fields)) {
      if (!modelField) continue;
      const detField = mergedFields[fieldName];
      // Use model field if it has higher confidence or deterministic doesn't have it
      if (!detField || (modelField.confidence > detField.confidence)) {
        mergedFields[fieldName] = {
          ...modelField,
          provenance: {
            ...modelField.provenance,
            fallbackUsed: true,
            fallbackReason: fallbackEvent.reason
          }
        };
      } else if (detField) {
        // Mark deterministic field as fallback-used
        mergedFields[fieldName] = {
          ...detField,
          provenance: {
            ...detField.provenance,
            fallbackUsed: true,
            fallbackReason: fallbackEvent.reason
          }
        };
      }
    }

    // Combine warnings and errors
    const warnings: ExtractionWarning[] = [
      ...modelResult.warnings,
      ...detResult.warnings,
      {
        code: 'FALLBACK_USED',
        message: fallbackEvent.reason,
        severity: 'medium',
        extractor: 'engine'
      }
    ];

    const errors: ExtractionError[] = [
      ...modelResult.errors,
      ...detResult.errors
    ];

    // Calculate overall confidence (weighted toward deterministic since it was fallback)
    const modelConf = modelResult.overallConfidence;
    const detConf = detResult.overallConfidence;
    const overallConfidence = Math.max(detConf, modelConf * 0.8); // Penalize model since we fell back

    const provenance: ExtractionProvenance = {
      primaryExtractor: 'hybrid',
      modelId: modelResult.provenance.modelId,
      modelVersion: modelResult.provenance.modelVersion,
      promptVersion: modelResult.provenance.promptVersion,
      modelLatencyMs: modelResult.provenance.modelLatencyMs,
      totalLatencyMs: Date.now() - startTime,
      tokenUsage: modelResult.provenance.tokenUsage,
      fallbackChain: [fallbackEvent],
      validationResults: []
    };

    return {
      documentId: modelResult.documentId,
      sourceId: modelResult.sourceId,
      extractedAt: new Date().toISOString(),
      fields: mergedFields,
      overallConfidence,
      warnings,
      errors,
      provenance,
      rawPreview: modelResult.rawPreview
    };
  }

  /**
   * Build a failed model result for merging
   */
  private buildFailedModelResult(
    document: RawDocument,
    context: ExtractionContext,
    error: unknown,
    startTime: number
  ): ExtractionResult {
    return {
      documentId: document.documentId,
      sourceId: document.sourceId,
      extractedAt: new Date().toISOString(),
      fields: {},
      overallConfidence: 0,
      warnings: [{
        code: 'MODEL_FAILED',
        message: `Model extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'high',
        extractor: 'model'
      }],
      errors: [{
        code: 'MODEL_EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
        extractor: 'model'
      }],
      provenance: {
        primaryExtractor: 'model',
        promptVersion: this.defaultPromptVersion,
        modelLatencyMs: Date.now() - startTime,
        totalLatencyMs: Date.now() - startTime,
        fallbackChain: [],
        validationResults: []
      },
      rawPreview: typeof document.rawData === 'string' ? document.rawData.slice(0, 1000) : undefined
    };
  }

  /**
   * Build complete failure result
   */
  private buildCompleteFailure(
    document: RawDocument,
    context: ExtractionContext,
    modelError: unknown,
    detError: unknown | null,
    startTime: number
  ): ExtractionResult {
    return {
      documentId: document.documentId,
      sourceId: document.sourceId,
      extractedAt: new Date().toISOString(),
      fields: {},
      overallConfidence: 0,
      warnings: [],
      errors: [
        {
          code: 'MODEL_EXTRACTION_FAILED',
          message: modelError instanceof Error ? modelError.message : 'Unknown error',
          recoverable: false,
          extractor: 'model'
        },
        ...(detError ? [{
          code: 'DETERMINISTIC_EXTRACTION_FAILED',
          message: detError instanceof Error ? detError.message : 'Unknown error',
          recoverable: false,
          extractor: 'deterministic'
        }] : [])
      ],
      provenance: {
        primaryExtractor: 'none' as 'model' | 'deterministic' | 'hybrid',
        promptVersion: this.defaultPromptVersion,
        totalLatencyMs: Date.now() - startTime,
        fallbackChain: [],
        validationResults: []
      },
      rawPreview: typeof document.rawData === 'string' ? document.rawData.slice(0, 1000) : undefined
    };
  }

  /**
   * Record successful extraction for metrics
   */
  private recordSuccess(result: ExtractionResult, startTime: number, extractorType: 'model' | 'deterministic'): void {
    this.metrics.documentsSucceeded++;
    this.metrics.totalProcessingMs += Date.now() - startTime;
    this.metrics.warningsCount += result.warnings.length;
    this.metrics.errorsCount += result.errors.length;

    if (extractorType === 'model') {
      this.metrics.modelExtractions++;
      this.metrics.totalModelLatencyMs += result.provenance.modelLatencyMs || 0;
      if (result.provenance.tokenUsage) {
        this.metrics.totalTokensUsed += result.provenance.tokenUsage.totalTokens;
        this.metrics.estimatedCostUsd += result.provenance.tokenUsage.estimatedCostUsd || 0;
      }
      // Update running average
      const n = this.metrics.modelExtractions;
      this.metrics.avgModelConfidence = ((n - 1) * this.metrics.avgModelConfidence + result.overallConfidence) / n;
    } else {
      this.metrics.deterministicExtractions++;
      const n = this.metrics.deterministicExtractions;
      this.metrics.avgDeterministicConfidence = ((n - 1) * this.metrics.avgDeterministicConfidence + result.overallConfidence) / n;
    }

    // Update overall average
    const total = this.metrics.modelExtractions + this.metrics.deterministicExtractions;
    this.metrics.avgOverallConfidence = (
      this.metrics.modelExtractions * this.metrics.avgModelConfidence +
      this.metrics.deterministicExtractions * this.metrics.avgDeterministicConfidence
    ) / total;
  }

  /**
   * Estimate cost based on model and token usage
   */
  private estimateCost(modelId: string, usage: { promptTokens: number; completionTokens: number }): number {
    // Rough estimates - should be configured per model
    const rates: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    };

    const rate = rates[modelId] || { input: 0.001, output: 0.002 };
    return (usage.promptTokens / 1000) * rate.input + (usage.completionTokens / 1000) * rate.output;
  }

  /**
   * Batch extraction
   */
  async extractBatch(
    documents: RawDocument[],
    contextFactory: (doc: RawDocument) => Partial<ExtractionContext>,
    options: ExtractionOptions = {}
  ): Promise<{ results: ExtractionResult[]; metrics: ExtractionMetrics }> {
    const results: ExtractionResult[] = [];
    
    for (const doc of documents) {
      const context = {
        sourceId: doc.sourceId,
        documentId: doc.documentId,
        contentType: doc.contentType,
        ...contextFactory(doc)
      } as ExtractionContext;
      
      const result = await this.extract(doc, context, options);
      results.push(result);
    }

    return { results, metrics: this.getMetrics() };
  }

  /**
   * Get current metrics
   */
  getMetrics(): ExtractionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      documentsProcessed: 0,
      documentsSucceeded: 0,
      documentsFailed: 0,
      modelExtractions: 0,
      deterministicExtractions: 0,
      fallbackCount: 0,
      avgOverallConfidence: 0,
      avgModelConfidence: 0,
      avgDeterministicConfidence: 0,
      totalProcessingMs: 0,
      totalModelLatencyMs: 0,
      totalTokensUsed: 0,
      estimatedCostUsd: 0,
      warningsCount: 0,
      errorsCount: 0
    };
  }

  /**
   * Check if model service is available
   */
  isModelAvailable(): boolean {
    return this.unifiedModelService.isInitialized();
  }

  /**
   * Get deterministic extractor capabilities
   */
  getDeterministicCapabilities() {
    return this.deterministicExtractor.getCapabilities();
  }
}
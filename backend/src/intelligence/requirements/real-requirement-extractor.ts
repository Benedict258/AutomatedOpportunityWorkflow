/**
 * Real Model-Backed Requirement Extractor
 * 
 * Wraps unifiedModelService.extractRequirements() with deterministic fallback.
 * Uses requirement-extraction model slot with full provenance tracking.
 * Never treats inferred as explicit - all classifications are evidence-based.
 */

import { UnifiedModelService } from '../../../../shared/src/models/unified-service';
import { DeterministicRequirementParser } from './deterministic-requirement-parser';
import type { 
  Requirement, 
  RequirementType, 
  RequirementRelationship, 
  RequirementConfidence,
  RequirementProvenance,
  RequirementExtractionResult 
} from './types';
import { NormalizedOpportunity } from '../../discovery/normalization/types';
import { 
  buildRequirementExtractionPrompt, 
  REQUIREMENT_PROMPT_VERSION, 
  getRequirementPromptHash,
  REQUIREMENT_EXTRACTION_JSON_SCHEMA 
} from './prompt-v1';
import { 
  validateRequirementExtraction, 
  applyRequirementValidationToResult,
  validateRequirementOutputAgainstSchema,
  mergeDuplicateRequirements,
  isExplicitRelationship,
  isInferredRelationship
} from './requirement-validator';

export interface RealRequirementExtractorConfig {
  unifiedModelService: UnifiedModelService;
  deterministicParser?: DeterministicRequirementParser;
  defaultConfidenceThreshold?: number;
  defaultTimeoutMs?: number;
  maxRetries?: number;
  enableObservability?: boolean;
}

export interface RealRequirementExtractorMetrics {
  totalExtractions: number;
  modelExtractions: number;
  deterministicExtractions: number;
  fallbackCount: number;
  avgOverallConfidence: number;
  avgModelConfidence: number;
  avgDeterministicConfidence: number;
  totalProcessingMs: number;
  totalModelLatencyMs: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  warningsCount: number;
  errorsCount: number;
}

interface ModelExtractionResponse {
  requirements: Array<{
    type: RequirementType;
    value: string;
    relationship: RequirementRelationship;
    confidence: number;
    evidence: string;
    normalizedValue: string;
  }>;
  warnings: string[];
}

interface ModelExecutionResult<T> {
  status: 'success' | 'error' | 'validation_failed';
  data?: T;
  model?: string;
  modelVersion?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
  error?: { message: string; category?: string };
}

/**
 * Real requirement extractor using unified model service with deterministic fallback
 */
export class RealRequirementExtractor {
  private unifiedModelService: UnifiedModelService;
  private deterministicParser: DeterministicRequirementParser;
  private defaultConfidenceThreshold: number;
  private defaultTimeoutMs: number;
  private maxRetries: number;
  private enableObservability: boolean;
  
  // Metrics
  private metrics: RealRequirementExtractorMetrics = {
    totalExtractions: 0,
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

  constructor(config: RealRequirementExtractorConfig) {
    this.unifiedModelService = config.unifiedModelService;
    this.deterministicParser = config.deterministicParser || new DeterministicRequirementParser();
    this.defaultConfidenceThreshold = config.defaultConfidenceThreshold || 0.7;
    this.defaultTimeoutMs = config.defaultTimeoutMs || 30000;
    this.maxRetries = config.maxRetries || 2;
    this.enableObservability = config.enableObservability ?? true;
  }

  /**
   * Extract requirements from a NormalizedOpportunity
   * Uses model extraction first, falls back to deterministic parser
   */
  async extract(
    opportunity: NormalizedOpportunity,
    sourceId: string,
    options: {
      enableModelExtraction?: boolean;
      enableDeterministicFallback?: boolean;
      confidenceThreshold?: number;
      maxRetries?: number;
      timeoutMs?: number;
      traceId?: string;
    } = {}
  ): Promise<RequirementExtractionResult> {
    const startTime = Date.now();
    const traceId = options.traceId || `req-ext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const mergedOptions = {
      enableModelExtraction: options.enableModelExtraction ?? true,
      enableDeterministicFallback: options.enableDeterministicFallback ?? true,
      confidenceThreshold: options.confidenceThreshold ?? this.defaultConfidenceThreshold,
      maxRetries: options.maxRetries ?? this.maxRetries,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      traceId
    };

    this.metrics.totalExtractions++;

    // Build text content from opportunity
    const textContent = this.buildOpportunityText(opportunity);
    if (!textContent || textContent.trim().length === 0) {
      return this.emptyResult(sourceId, startTime, 'No text content available');
    }

    try {
      // Try model extraction first
      if (mergedOptions.enableModelExtraction && this.unifiedModelService.isInitialized()) {
        const modelResult = await this.extractWithModel(
          textContent, 
          sourceId, 
          opportunity, 
          mergedOptions
        );
        
        // Check if model extraction meets confidence threshold
        if (modelResult.overallConfidence >= mergedOptions.confidenceThreshold) {
          this.recordSuccess(modelResult, startTime, 'model');
          return modelResult;
        }

        // Model confidence too low, try deterministic fallback
        if (mergedOptions.enableDeterministicFallback) {
          this.metrics.fallbackCount++;
          const fallbackReason = `Model confidence ${modelResult.overallConfidence.toFixed(2)} below threshold ${mergedOptions.confidenceThreshold}`;
          
          const detResult = await this.extractDeterministic(textContent, sourceId, opportunity);
          return this.mergeWithFallback(modelResult, detResult, fallbackReason, startTime);
        }

        // No fallback, return model result anyway
        this.recordSuccess(modelResult, startTime, 'model');
        return modelResult;
      }

      // Model not available or disabled, use deterministic
      const detResult = await this.extractDeterministic(textContent, sourceId, opportunity);
      this.recordSuccess(detResult, startTime, 'deterministic');
      return detResult;

    } catch (error) {
      // Model extraction failed, try deterministic fallback
      if (mergedOptions.enableDeterministicFallback) {
        this.metrics.fallbackCount++;
        const fallbackReason = `Model extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        try {
          const detResult = await this.extractDeterministic(textContent, sourceId, opportunity);
          const modelResult = this.buildFailedModelResult(sourceId, opportunity, error, startTime);
          return this.mergeWithFallback(modelResult, detResult, fallbackReason, startTime);
        } catch (detError) {
          // Both failed
          this.metrics.totalExtractions--;
          this.metrics.errorsCount++;
          return this.buildCompleteFailure(sourceId, opportunity, error, detError, startTime);
        }
      }

      // No fallback enabled
      this.metrics.errorsCount++;
      return this.buildCompleteFailure(sourceId, opportunity, error, null, startTime);
    }
  }

  /**
   * Extract requirements from raw text (for testing or non-normalized input)
   */
  async extractFromText(
    text: string,
    sourceId: string,
    options: {
      enableModelExtraction?: boolean;
      enableDeterministicFallback?: boolean;
      confidenceThreshold?: number;
      maxRetries?: number;
      timeoutMs?: number;
      traceId?: string;
    } = {}
  ): Promise<RequirementExtractionResult> {
    const startTime = Date.now();
    const traceId = options.traceId || `req-ext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const mergedOptions = {
      enableModelExtraction: options.enableModelExtraction ?? true,
      enableDeterministicFallback: options.enableDeterministicFallback ?? true,
      confidenceThreshold: options.confidenceThreshold ?? this.defaultConfidenceThreshold,
      maxRetries: options.maxRetries ?? this.maxRetries,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      traceId
    };

    this.metrics.totalExtractions++;

    if (!text || text.trim().length === 0) {
      return this.emptyResult(sourceId, startTime, 'No text content provided');
    }

    try {
      if (mergedOptions.enableModelExtraction && this.unifiedModelService.isInitialized()) {
        const modelResult = await this.extractWithModel(text, sourceId, null, mergedOptions);
        
        if (modelResult.overallConfidence >= mergedOptions.confidenceThreshold) {
          this.recordSuccess(modelResult, startTime, 'model');
          return modelResult;
        }

        if (mergedOptions.enableDeterministicFallback) {
          this.metrics.fallbackCount++;
          const fallbackReason = `Model confidence ${modelResult.overallConfidence.toFixed(2)} below threshold ${mergedOptions.confidenceThreshold}`;
          const detResult = await this.extractDeterministic(text, sourceId, null);
          return this.mergeWithFallback(modelResult, detResult, fallbackReason, startTime);
        }

        this.recordSuccess(modelResult, startTime, 'model');
        return modelResult;
      }

      const detResult = await this.extractDeterministic(text, sourceId, null);
      this.recordSuccess(detResult, startTime, 'deterministic');
      return detResult;

    } catch (error) {
      if (mergedOptions.enableDeterministicFallback) {
        this.metrics.fallbackCount++;
        const fallbackReason = `Model extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        try {
          const detResult = await this.extractDeterministic(text, sourceId, null);
          const modelResult = this.buildFailedModelResult(sourceId, null, error, startTime);
          return this.mergeWithFallback(modelResult, detResult, fallbackReason, startTime);
        } catch (detError) {
          this.metrics.totalExtractions--;
          this.metrics.errorsCount++;
          return this.buildCompleteFailure(sourceId, null, error, detError, startTime);
        }
      }

      this.metrics.errorsCount++;
      return this.buildCompleteFailure(sourceId, null, error, null, startTime);
    }
  }

  /**
   * Extract using the unified model service
   */
  private async extractWithModel(
    text: string,
    sourceId: string,
    opportunity: NormalizedOpportunity | null,
    options: {
      confidenceThreshold: number;
      maxRetries: number;
      timeoutMs: number;
      traceId: string;
    }
  ): Promise<RequirementExtractionResult> {
    const modelStartTime = Date.now();
    const promptHash = getRequirementPromptHash();

    const { systemPrompt, userPrompt } = buildRequirementExtractionPrompt(
      { contentType: 'text/plain', rawData: text },
      { 
        sourceId, 
        documentId: sourceId,
        extractedFields: opportunity ? this.extractRelevantFields(opportunity) : undefined
      }
    );

    // Use generateStructured for structured output with schema validation
    const executionResult = await this.unifiedModelService.generateStructured<ModelExtractionResponse>(
      'requirement-extraction',
      {
        prompt: userPrompt,
        systemPrompt,
        schema: REQUIREMENT_EXTRACTION_JSON_SCHEMA,
        temperature: 0.1,
        maxTokens: 4096,
        metadata: {
          sourceId,
          traceId: options.traceId,
          promptVersion: REQUIREMENT_PROMPT_VERSION
        }
      },
      {
        operation: 'requirement-extraction',
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries,
        metadata: {
          sourceId,
          promptVersion: REQUIREMENT_PROMPT_VERSION
        }
      }
    );

    const modelLatencyMs = Date.now() - modelStartTime;
    this.metrics.totalModelLatencyMs += modelLatencyMs;

    if (executionResult.status !== 'success' || !executionResult.data) {
      throw new Error(`Model extraction failed: ${executionResult.error?.message || 'Unknown error'}`);
    }

    const response = executionResult.data;
    
    // Validate output against schema
    const schemaValidation = validateRequirementOutputAgainstSchema(response);
    if (!schemaValidation.valid) {
      throw new Error(`Model output failed schema validation: ${schemaValidation.errors.join('; ')}`);
    }

    // Convert to Requirement[] with provenance
    const requirements: Requirement[] = response.requirements.map((r, index) => {
      const requirement: Requirement = {
        id: `${sourceId}-${r.type}-${index}-${Date.now()}`,
        type: r.type,
        value: r.value,
        normalizedValue: r.normalizedValue || this.normalizeValue(r.type, r.value),
        relationship: r.relationship,
        confidence: r.confidence,
        provenance: [{
          source: sourceId,
          section: 'model-extraction',
          snippet: r.evidence,
        }],
        extractedAt: new Date().toISOString(),
        metadata: {
          modelExtraction: true,
          modelId: executionResult.model,
          modelVersion: executionResult.modelVersion,
          promptVersion: REQUIREMENT_PROMPT_VERSION,
          promptHash,
          traceId: options.traceId,
          evidence: r.evidence
        }
      };
      return requirement;
    });

    // Validate requirements
    const validation = validateRequirementExtraction(requirements, { 
      strictMode: false, 
      requireEvidence: true 
    });

    // Calculate overall confidence
    const confidences = requirements.map(r => r.confidence);
    const overallConfidence = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0;

    // Build provenance
    const provenance = {
      primaryExtractor: 'model' as const,
      modelId: executionResult.model,
      modelVersion: executionResult.modelVersion,
      promptVersion: REQUIREMENT_PROMPT_VERSION,
      promptHash,
      modelLatencyMs,
      totalLatencyMs: Date.now() - modelStartTime,
      tokenUsage: executionResult.usage ? {
        promptTokens: executionResult.usage.promptTokens,
        completionTokens: executionResult.usage.completionTokens,
        totalTokens: executionResult.usage.totalTokens,
        estimatedCostUsd: this.estimateCost(executionResult.model || '', executionResult.usage)
      } : undefined,
      fallbackChain: [] as any[],
      validationResults: validation.results.map(r => ({
        field: `requirement[${r.requirementIndex}]`,
        valid: r.valid,
        errors: r.errors,
        warnings: r.warnings
      }))
    };

    // Merge duplicates
    const dedupedRequirements = mergeDuplicateRequirements(requirements);

    // Build warnings
    const warnings = [
      ...response.warnings.map(w => ({
        code: 'MODEL_WARNING',
        message: w,
        severity: 'low' as const,
        extractor: 'model'
      })),
      ...validation.warnings.map(w => ({
        code: 'VALIDATION_WARNING',
        message: w,
        severity: 'low' as const,
        extractor: 'validator'
      }))
    ];

    const result: RequirementExtractionResult = {
      requirements: dedupedRequirements,
      summary: {
        byType: this.countByType(dedupedRequirements),
        byRelationship: this.countByRelationship(dedupedRequirements)
      },
      sourceId,
      extractedAt: new Date().toISOString(),
      overallConfidence
    };

    return applyRequirementValidationToResult(result, validation);
  }

  /**
   * Extract using deterministic parser
   */
  private async extractDeterministic(
    text: string,
    sourceId: string,
    opportunity: NormalizedOpportunity | null
  ): Promise<RequirementExtractionResult> {
    const detStartTime = Date.now();

    const requirements = this.deterministicParser.parse(text, sourceId);

    // Add metadata to indicate deterministic extraction
    for (const req of requirements) {
      req.metadata = {
        ...req.metadata,
        deterministicExtraction: true,
        promptVersion: REQUIREMENT_PROMPT_VERSION
      };
    }

    // Validate deterministic output too
    const validation = validateRequirementExtraction(requirements, {
      strictMode: false,
      requireEvidence: true
    });

    // Calculate overall confidence
    const confidences = requirements.map(r => 
      typeof r.confidence === 'number' ? r.confidence : 0.5
    );
    const overallConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    const provenance = {
      primaryExtractor: 'deterministic' as const,
      promptVersion: REQUIREMENT_PROMPT_VERSION,
      modelLatencyMs: 0,
      totalLatencyMs: Date.now() - detStartTime,
      fallbackChain: [] as any[],
      validationResults: validation.results.map(r => ({
        field: `requirement[${r.requirementIndex}]`,
        valid: r.valid,
        errors: r.errors,
        warnings: r.warnings
      }))
    };

    const dedupedRequirements = mergeDuplicateRequirements(requirements);

    const result: RequirementExtractionResult = {
      requirements: dedupedRequirements,
      summary: {
        byType: this.countByType(dedupedRequirements),
        byRelationship: this.countByRelationship(dedupedRequirements)
      },
      sourceId,
      extractedAt: new Date().toISOString(),
      overallConfidence
    };

    return applyRequirementValidationToResult(result, validation);
  }

  /**
   * Merge model result with deterministic fallback
   */
  private mergeWithFallback(
    modelResult: RequirementExtractionResult,
    detResult: RequirementExtractionResult,
    fallbackReason: string,
    startTime: number
  ): RequirementExtractionResult {
    // Use deterministic as base, but preserve model fields with higher confidence
    const mergedRequirements = new Map<string, Requirement>();
    
    // Add deterministic results first
    for (const req of detResult.requirements) {
      const key = `${req.type}:${req.normalizedValue}`;
      mergedRequirements.set(key, {
        ...req,
        provenance: req.provenance.map(p => ({
          ...p,
          fallbackUsed: true,
          fallbackReason
        }))
      });
    }

    // Merge model results, preferring higher confidence
    for (const req of modelResult.requirements) {
      const key = `${req.type}:${req.normalizedValue}`;
      const existing = mergedRequirements.get(key);
      
      if (!existing) {
        mergedRequirements.set(key, {
          ...req,
          provenance: req.provenance.map(p => ({
            ...p,
            fallbackUsed: true,
            fallbackReason
          }))
        });
      } else {
        const modelConf = req.confidence;
        const detConf = typeof existing.confidence === 'number' ? existing.confidence : 0.5;
        
        if (modelConf > detConf) {
          // Use model but mark as fallback-used
          mergedRequirements.set(key, {
            ...req,
            provenance: req.provenance.map(p => ({
              ...p,
              fallbackUsed: true,
              fallbackReason
            }))
          });
        } else {
          // Keep deterministic but merge provenance
          existing.provenance.push(...req.provenance);
        }
      }
    }

    const merged = Array.from(mergedRequirements.values());

    // Combine warnings
    const warnings = [
      ...modelResult.warnings,
      ...detResult.warnings,
      {
        code: 'FALLBACK_USED',
        message: fallbackReason,
        severity: 'medium' as const,
        extractor: 'engine'
      }
    ];

    const errors = [...modelResult.errors, ...detResult.errors];

    // Calculate overall confidence (weighted toward deterministic since it was fallback)
    const modelConf = modelResult.requirements.length > 0
      ? modelResult.requirements.reduce((a, b) => a + b.confidence, 0) / modelResult.requirements.length
      : 0;
    const detConf = detResult.requirements.length > 0
      ? detResult.requirements.reduce((a, b) => a + (typeof b.confidence === 'number' ? b.confidence : 0.5), 0) / detResult.requirements.length
      : 0;
    const overallConfidence = Math.max(detConf, modelConf * 0.8);

    const provenance = {
      primaryExtractor: 'hybrid' as const,
      modelId: modelResult.requirements[0]?.metadata?.modelId,
      modelVersion: modelResult.requirements[0]?.metadata?.modelVersion,
      promptVersion: REQUIREMENT_PROMPT_VERSION,
      modelLatencyMs: 0, // Not tracked in result, would need to be passed
      totalLatencyMs: Date.now() - startTime,
      tokenUsage: undefined,
      fallbackChain: [{
        fromExtractor: 'model',
        toExtractor: 'deterministic',
        reason: fallbackReason,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime
      }],
      validationResults: []
    };

    return {
      requirements: merged,
      summary: {
        byType: this.countByType(merged),
        byRelationship: this.countByRelationship(merged)
      },
      sourceId: modelResult.sourceId,
      extractedAt: new Date().toISOString(),
      overallConfidence,
      warnings,
      errors
    };
  }

  /**
   * Build text content from NormalizedOpportunity
   */
  private buildOpportunityText(opportunity: NormalizedOpportunity): string {
    const parts: string[] = [];
    
    if (opportunity.title) parts.push(`Title: ${opportunity.title}`);
    if (opportunity.organization) parts.push(`Organization: ${opportunity.organization}`);
    if (opportunity.description) parts.push(`Description: ${opportunity.description}`);
    if (opportunity.location) parts.push(`Location: ${opportunity.location}`);
    if (opportunity.remoteStatus) parts.push(`Remote Status: ${opportunity.remoteStatus}`);
    if (opportunity.opportunityType) parts.push(`Type: ${opportunity.opportunityType}`);
    if (opportunity.category?.length) parts.push(`Categories: ${opportunity.category.join(', ')}`);
    if (opportunity.skills?.length) {
      parts.push(`Skills: ${opportunity.skills.map(s => s.name).join(', ')}`);
    }
    if (opportunity.eligibility?.length) {
      parts.push(`Eligibility: ${opportunity.eligibility.map(e => `${e.type}${e.value ? ': ' + e.value : ''}`).join('; ')}`);
    }
    if (opportunity.educationRequirements?.length) {
      parts.push(`Education: ${opportunity.educationRequirements.join(', ')}`);
    }
    if (opportunity.experienceRequirements?.length) {
      parts.push(`Experience: ${opportunity.experienceRequirements.join(', ')}`);
    }
    if (opportunity.compensation?.text) {
      parts.push(`Compensation: ${opportunity.compensation.text}`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * Extract relevant fields from opportunity for model context
   */
  private extractRelevantFields(opportunity: NormalizedOpportunity): Record<string, unknown> {
    return {
      title: opportunity.title,
      organization: opportunity.organization,
      location: opportunity.location,
      remoteStatus: opportunity.remoteStatus,
      opportunityType: opportunity.opportunityType,
      skills: opportunity.skills?.map(s => s.name),
      eligibility: opportunity.eligibility,
      educationRequirements: opportunity.educationRequirements,
      experienceRequirements: opportunity.experienceRequirements,
      compensation: opportunity.compensation
    };
  }

  /**
   * Normalize value for deduplication
   */
  private normalizeValue(type: RequirementType, value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Build failed model result for merging
   */
  private buildFailedModelResult(
    sourceId: string,
    opportunity: NormalizedOpportunity | null,
    error: unknown,
    startTime: number
  ): RequirementExtractionResult {
    return {
      requirements: [],
      summary: { byType: {} as any, byRelationship: {} as any },
      sourceId,
      extractedAt: new Date().toISOString(),
      overallConfidence: 0
    };
  }

  /**
   * Build complete failure result
   */
  private buildCompleteFailure(
    sourceId: string,
    opportunity: NormalizedOpportunity | null,
    modelError: unknown,
    detError: unknown | null,
    startTime: number
  ): RequirementExtractionResult {
    return {
      requirements: [],
      summary: { byType: {} as any, byRelationship: {} as any },
      sourceId,
      extractedAt: new Date().toISOString(),
      overallConfidence: 0,
      errors: [{
        code: 'MODEL_EXTRACTION_FAILED',
        message: modelError instanceof Error ? modelError.message : 'Unknown error',
        recoverable: false,
        extractor: 'model'
      }]
    };
  }

  /**
   * Empty result for no content
   */
  private emptyResult(sourceId: string, startTime: number, reason: string): RequirementExtractionResult {
    return {
      requirements: [],
      summary: { byType: {} as any, byRelationship: {} as any },
      sourceId,
      extractedAt: new Date().toISOString(),
      overallConfidence: 0,
      warnings: [{
        code: 'EMPTY_CONTENT',
        message: reason,
        severity: 'low'
      }]
    };
  }

  /**
   * Record successful extraction for metrics
   */
  private recordSuccess(
    result: RequirementExtractionResult, 
    startTime: number, 
    extractorType: 'model' | 'deterministic'
  ): void {
    const processingMs = Date.now() - startTime;
    this.metrics.totalProcessingMs += processingMs;

    // Calculate confidence
    const confidences = result.requirements.map(r => 
      typeof r.confidence === 'number' ? r.confidence : 0.5
    );
    const overallConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    this.metrics.warningsCount += result.warnings.length;
    this.metrics.errorsCount += result.errors.length;

    if (extractorType === 'model') {
      this.metrics.modelExtractions++;
      const n = this.metrics.modelExtractions;
      this.metrics.avgModelConfidence = ((n - 1) * this.metrics.avgModelConfidence + overallConfidence) / n;
    } else {
      this.metrics.deterministicExtractions++;
      const n = this.metrics.deterministicExtractions;
      this.metrics.avgDeterministicConfidence = ((n - 1) * this.metrics.avgDeterministicConfidence + overallConfidence) / n;
    }

    const total = this.metrics.modelExtractions + this.metrics.deterministicExtractions;
    this.metrics.avgOverallConfidence = (
      this.metrics.modelExtractions * this.metrics.avgModelConfidence +
      this.metrics.deterministicExtractions * this.metrics.avgDeterministicConfidence
    ) / total;
  }

  /**
   * Estimate cost based on model and token usage
   */
  private estimateCost(modelId: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number }): number {
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
   * Count requirements by type
   */
  private countByType(requirements: Requirement[]): Record<RequirementType, number> {
    const counts: Record<RequirementType, number> = {} as Record<RequirementType, number>;
    for (const type of ['SKILL', 'TECHNOLOGY', 'CERTIFICATION', 'EDUCATION', 'EXPERIENCE', 'LOCATION', 'CITIZENSHIP', 'WORK_AUTHORIZATION', 'CLEARANCE', 'LANGUAGE'] as RequirementType[]) {
      counts[type] = 0;
    }
    for (const req of requirements) {
      counts[req.type] = (counts[req.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Count requirements by relationship
   */
  private countByRelationship(requirements: Requirement[]): Record<RequirementRelationship, number> {
    const counts: Record<RequirementRelationship, number> = {} as Record<RequirementRelationship, number>;
    for (const rel of ['REQUIRED', 'PREFERRED', 'OPTIONAL', 'INFERRED', 'UNKNOWN'] as RequirementRelationship[]) {
      counts[rel] = 0;
    }
    for (const req of requirements) {
      counts[req.relationship] = (counts[req.relationship] || 0) + 1;
    }
    return counts;
  }

  /**
   * Get current metrics
   */
  getMetrics(): RealRequirementExtractorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalExtractions: 0,
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
   * Get deterministic parser capabilities
   */
  getDeterministicCapabilities() {
    return {
      canParseText: true,
      canParseSections: true,
      supportedTypes: [
        'SKILL', 'TECHNOLOGY', 'CERTIFICATION', 'EDUCATION', 
        'EXPERIENCE', 'LOCATION', 'CITIZENSHIP', 'WORK_AUTHORIZATION', 
        'CLEARANCE', 'LANGUAGE'
      ]
    };
  }
}
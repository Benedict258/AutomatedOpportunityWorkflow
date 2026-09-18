import type { RawDocument } from '../../discovery/extraction/types';

/**
 * Core extracted field with provenance and confidence
 */
export interface ExtractedField<T = unknown> {
  value: T;
  confidence: number; // 0-1 per-field confidence
  provenance: FieldProvenance;
  rawSource?: string; // Raw text/source that produced this field
}

/**
 * Provenance tracking for each extracted field
 */
export interface FieldProvenance {
  extractor: 'model' | 'deterministic' | 'hybrid';
  modelId?: string;
  modelVersion?: string;
  promptVersion: string;
  promptHash?: string;
  extractionLatencyMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  fallbackUsed: boolean;
  fallbackReason?: string;
}

/**
 * Complete extracted fields with per-field confidence
 */
export interface ExtractedFields {
  // Core opportunity fields
  title?: ExtractedField<string>;
  organization?: ExtractedField<string>;
  description?: ExtractedField<string>;
  opportunityType?: ExtractedField<string>;
  location?: ExtractedField<string>;
  remoteStatus?: ExtractedField<'remote' | 'hybrid' | 'onsite' | 'unknown'>;
  deadline?: ExtractedField<string>; // ISO date string
  postedDate?: ExtractedField<string>;
  startDate?: ExtractedField<string>;
  endDate?: ExtractedField<string>;

  // Compensation
  salaryMin?: ExtractedField<number>;
  salaryMax?: ExtractedField<number>;
  salaryCurrency?: ExtractedField<string>;
  salaryPeriod?: ExtractedField<'yearly' | 'monthly' | 'hourly' | 'unknown'>;
  equity?: ExtractedField<string>;
  benefits?: ExtractedField<string[]>;

  // Requirements
  experienceLevel?: ExtractedField<string>;
  experienceYearsMin?: ExtractedField<number>;
  experienceYearsMax?: ExtractedField<number>;
  educationLevel?: ExtractedField<string>;
  requiredSkills?: ExtractedField<string[]>;
  preferredSkills?: ExtractedField<string[]>;
  certifications?: ExtractedField<string[]>;
  securityClearance?: ExtractedField<string>;

  // Work authorization
  citizenshipRequired?: ExtractedField<string[]>;
  workAuthorization?: ExtractedField<string[]>;

  // Metadata
  applicationUrl?: ExtractedField<string>;
  contactEmail?: ExtractedField<string>;
  sourceUrl?: ExtractedField<string>;
  externalIds?: ExtractedField<Record<string, string>>;

  // Extensible for custom fields
  [key: string]: ExtractedField<unknown> | undefined;
}

/**
 * Extraction result with full provenance
 */
export interface ExtractionResult {
  documentId: string;
  sourceId: string;
  extractedAt: string;
  fields: ExtractedFields;
  overallConfidence: number; // 0-1 aggregate confidence
  warnings: ExtractionWarning[];
  errors: ExtractionError[];
  provenance: ExtractionProvenance;
  rawPreview?: string;
}

/**
 * Aggregated provenance for the entire extraction
 */
export interface ExtractionProvenance {
  primaryExtractor: 'model' | 'deterministic' | 'hybrid';
  modelId?: string;
  modelVersion?: string;
  promptVersion: string;
  modelLatencyMs?: number;
  totalLatencyMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
  };
  fallbackChain: FallbackEvent[];
  validationResults: ValidationResult[];
}

/**
 * Fallback event tracking
 */
export interface FallbackEvent {
  fromExtractor: string;
  toExtractor: string;
  reason: string;
  timestamp: string;
  latencyMs: number;
}

/**
 * Validation result per field
 */
export interface ValidationResult {
  field: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Warning during extraction
 */
export interface ExtractionWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'low' | 'medium' | 'high';
  extractor?: string;
}

/**
 * Error during extraction
 */
export interface ExtractionError {
  code: string;
  message: string;
  field?: string;
  recoverable: boolean;
  extractor?: string;
}

/**
 * Extraction context from discovery pipeline
 */
export interface ExtractionContext {
  sourceId: string;
  documentId: string;
  contentType: string;
  schemaVersion?: string;
  options?: ExtractionOptions;
  metadata?: Record<string, unknown>;
}

/**
 * Options for extraction engine
 */
export interface ExtractionOptions {
  enableModelExtraction?: boolean;
  enableDeterministicFallback?: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
  timeoutMs?: number;
  promptVersion?: string;
  modelId?: string;
  traceId?: string;
}

/**
 * Metrics for extraction operations
 */
export interface ExtractionMetrics {
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
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

/**
 * Configuration for extraction engine
 */
export interface ExtractionEngineConfig {
  unifiedModelService: any; // UnifiedModelService - using any to avoid circular deps
  deterministicExtractor?: any; // DeterministicExtractor
  defaultPromptVersion: string;
  defaultConfidenceThreshold: number;
  defaultTimeoutMs: number;
  maxRetries: number;
  enableObservability: boolean;
}
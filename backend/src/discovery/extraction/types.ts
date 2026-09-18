export type ContentType =
  | 'application/json'
  | 'text/html'
  | 'text/plain'
  | 'application/xml'
  | 'text/xml'
  | 'application/pdf'
  | 'unknown';

export interface RawResponse {
  sourceId: string;
  documentId: string;
  collectedAt: string;
  url?: string;
  method?: string;
  statusCode?: number;
  contentType: ContentType;
  headers?: Record<string, string>;
  rawData: unknown; // string | Buffer | object
  metadata?: Record<string, unknown>;
}

export interface RawDocument {
  sourceId: string;
  externalId?: string | string[];
  documentId: string;
  collectedAt: string;
  contentType: ContentType;
  rawResponse?: RawResponse;
  rawData: unknown;
  metadata?: {
    page?: number;
    cursor?: string;
    totalItems?: number;
    sourceType?: string;
    adapterId?: string;
    [key: string]: unknown;
  };
}

export interface ExtractionContext {
  sourceId: string;
  documentId: string;
  contentType: ContentType;
  schemaVersion?: string;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ExtractedFields {
  [key: string]: unknown;
}

export interface ExtractionWarning {
  code: string;
  message: string;
  field?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface ExtractionError {
  code: string;
  message: string;
  field?: string;
  recoverable?: boolean;
}

export interface ExtractionResult {
  documentId: string;
  sourceId: string;
  extractedAt: string;
  fields: ExtractedFields;
  confidence: number; // 0-1
  warnings: ExtractionWarning[];
  errors: ExtractionError[];
  provenance: {
    extractor: string;
    contentType: ContentType;
    rawSizeBytes?: number;
    processingMs?: number;
  };
  rawPreview?: string; // truncated
}

export interface ExtractionMetrics {
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
  avgConfidence: number;
  totalProcessingMs: number;
  warningsCount: number;
  errorsCount: number;
}

export interface ExtractionPipelineOptions {
  enableDeterministicFirst?: boolean;
  enableLLMFallback?: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

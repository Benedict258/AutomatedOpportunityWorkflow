import type { QueryPlan } from '../strategy/types';
import type { CollectionResult, RawDocument } from '../collection/types';
import type { ExtractionResult } from '../extraction/types';
import type { NormalizedOpportunity, NormalizationResult } from '../normalization/types';
import type { ValidationResult } from '../validation/types';
import type { DeduplicationResult } from '../deduplication/types';
import type { ChangeDetectionResult, VerificationResult } from '../freshness/types';
import type { VersioningResult } from '../versioning/types';
import type { RunStatus } from '../run-management/types';

export interface PipelineStageInput {
  runId: string;
  jobId?: string;
  sourceIds: string[];
  queryPlan?: QueryPlan;
  metadata?: Record<string, unknown>;
}

export interface PipelineStageOutput<T = unknown> {
  stage: PipelineStageName;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  data?: T;
  errors?: string[];
  warnings?: string[];
  metrics?: Record<string, unknown>;
}

export enum PipelineStageName {
  QUERY_STRATEGY = 'QUERY_STRATEGY',
  COLLECTION = 'COLLECTION',
  EXTRACTION = 'EXTRACTION',
  NORMALIZATION = 'NORMALIZATION',
  VALIDATION = 'VALIDATION',
  DEDUPLICATION = 'DEDUPLICATION',
  FRESHNESS = 'FRESHNESS',
  VERSIONING = 'VERSIONING',
  PERSISTENCE = 'PERSISTENCE',
}

export interface PipelineContext {
  runId: string;
  jobId?: string;
  startedAt: string;
  sourceIds: string[];
  options?: Record<string, unknown>;
  // Stage artifacts
  queryPlan?: QueryPlan;
  collectionResults?: Map<string, CollectionResult>;
  rawDocuments?: RawDocument[];
  extractionResults?: ExtractionResult[];
  normalized?: NormalizationResult[];
  validated?: ValidationResult[];
  dedupResult?: DeduplicationResult;
  freshnessResults?: ChangeDetectionResult[];
  verificationResults?: VerificationResult[];
  versioningResults?: VersioningResult[];
  persisted?: any;
  metrics?: PipelineMetrics;
  errors?: string[];
}

export interface PipelineMetrics {
  sourcesRequested: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  documentsCollected: number;
  documentsExtracted: number;
  opportunitiesNormalized: number;
  opportunitiesValidated: number;
  opportunitiesDeduped: number;
  opportunitiesPersisted: number;
  durationMs: number;
}

export interface DiscoveryPipelineResult {
  runId: string;
  jobId?: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  stages: PipelineStageOutput[];
  context: PipelineContext;
  metrics: PipelineMetrics;
  summary: {
    totalOpportunities: number;
    newOpportunities: number;
    updatedOpportunities: number;
    duplicatesRemoved: number;
    validationErrors: number;
  };
  errors?: string[];
}

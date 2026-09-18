import { BaseEntity, EntityId } from '../types';

export interface BenchmarkSample extends BaseEntity {
  sourceData: unknown;
  expectedExtraction?: Record<string, unknown>;
  expectedClassification?: Record<string, unknown>;
  expectedEligibility?: Record<string, unknown>;
  expectedRelevance?: number;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface BenchmarkResult extends BaseEntity {
  sampleId: EntityId;
  modelTask?: string;
  accuracy?: number;
  jsonValidity?: boolean;
  hallucinationIndicators?: string[];
  latencyMs?: number;
  tokenUsage?: Record<string, number>;
  cost?: number;
  evaluationTimestamp: string;
}

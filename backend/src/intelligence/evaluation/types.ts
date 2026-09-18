export interface EvaluationDataset<TInput, TExpected> {
  name: string;
  description: string;
  version: string;
  items: EvaluationItem<TInput, TExpected>[];
}

export interface EvaluationItem<TInput, TExpected> {
  id: string;
  input: TInput;
  expected: TExpected;
  metadata?: Record<string, unknown>;
}

export interface EvaluationResult {
  datasetName: string;
  modelId: string;
  providerId: string;
  promptVersion: string;
  runId: string;
  timestamp: string;
  metrics: EvaluationMetrics;
  items: ItemResult[];
}

export interface ItemResult {
  id: string;
  success: boolean;
  predicted?: unknown;
  expected?: unknown;
  score?: number;
  errors?: string[];
  latencyMs?: number;
  tokenUsage?: { prompt: number; completion: number; total: number };
}

export interface EvaluationMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  schemaValidity?: number;
  groundingScore?: number;
  hallucinationRate?: number;
  avgLatencyMs?: number;
  avgTokens?: number;
  fallbackRate?: number;
  errorRate?: number;
}

export interface EvaluationConfig {
  datasetPath: string;
  modelIds: string[];
  operations: string[];
  outputDir: string;
  parallel?: boolean;
  timeoutMs?: number;
}
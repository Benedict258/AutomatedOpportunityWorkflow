export interface ModelProvider {
  id: string;
  name: string;
  type: 'openai-compatible' | 'ollama' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  defaultHeaders?: Record<string, string>;
}

export interface ModelDefinition {
  id: string;
  providerId: string;
  name: string;
  capabilities: ModelCapability[];
  contextLength?: number;
  embeddingDimensions?: number;
  structuredOutputSupport: boolean;
  enabled: boolean;
  fallbackModelId?: string;
  config?: Record<string, unknown>;
}

export type ModelCapability =
  | 'text-generation'
  | 'structured-generation'
  | 'embeddings'
  | 'reranking'
  | 'classification'
  | 'extraction';

export interface GenerationRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  responseFormat?: 'text' | 'json' | 'json_schema';
  jsonSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GenerationResponse {
  text: string;
  usage?: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
  finishReason?: string;
}

export interface StructuredGenerationRequest<T = unknown> {
  prompt: string;
  systemPrompt?: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface StructuredGenerationResponse<T = unknown> {
  data: T;
  usage?: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
  validationErrors?: string[];
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
  dimensions?: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  usage?: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
  dimensions: number;
}

export interface RerankRequest {
  query: string;
  documents: string[];
  model?: string;
  topK?: number;
  metadata?: Record<string, unknown>;
}

export interface RerankResponse {
  results: Array<{ index: number; score: number }>;
  usage?: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelExecutionRecord {
  id: string;
  operation: ModelOperation;
  providerId: string;
  modelId: string;
  modelVersion?: string;
  promptVersion?: string;
  inputHash: string;
  status: 'success' | 'error' | 'fallback' | 'validation_failed';
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  retryCount: number;
  fallbackUsed: boolean;
  tokenUsage?: TokenUsage;
  estimatedCost?: number;
  errorCategory?: ModelErrorCategory;
  errorMessage?: string;
  validationErrors?: string[];
  metadata?: Record<string, unknown>;
}

export type ModelOperation =
  | 'extraction'
  | 'classification'
  | 'requirement-extraction'
  | 'embedding'
  | 'semantic-matching'
  | 'reasoning'
  | 'reranking'
  | 'candidate-intelligence'
  | 'matching';

export type ModelErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'auth_error'
  | 'provider_unavailable'
  | 'malformed_output'
  | 'validation_error'
  | 'context_length_exceeded'
  | 'unknown';

export interface ModelRegistryConfig {
  providers: ModelProvider[];
  models: ModelDefinition[];
  defaultModels: {
    extraction: string;
    classification: string;
    embedding: string;
    reasoning: string;
    matching?: string;
    reranking?: string;
  };
}

export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  fallbackModel?: string;
}

export interface ModelHealthCheck {
  providerId: string;
  modelId: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export { ModelRegistry } from './registry';
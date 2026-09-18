import {
  ModelProvider,
  ModelDefinition,
  GenerationRequest,
  GenerationResponse,
  StructuredGenerationRequest,
  StructuredGenerationResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
  ModelHealthCheck,
} from './types';

export interface ModelProviderAdapter {
  readonly provider: ModelProvider;
  readonly models: Map<string, ModelDefinition>;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  generate(request: GenerationRequest, model: ModelDefinition): Promise<GenerationResponse>;
  generateStructured<T>(request: StructuredGenerationRequest<T>, model: ModelDefinition): Promise<StructuredGenerationResponse<T>>;
  embed(request: EmbeddingRequest, model: ModelDefinition): Promise<EmbeddingResponse>;
  rerank?(request: RerankRequest, model: ModelDefinition): Promise<RerankResponse>;

  healthCheck(model: ModelDefinition): Promise<ModelHealthCheck>;
  getAvailableModels(capability?: string): ModelDefinition[];
}

export interface ModelProviderFactory {
  createProvider(config: ModelProvider): ModelProviderAdapter;
  getSupportedTypes(): string[];
}

export interface ModelClient {
  generate(request: GenerationRequest, model: string): Promise<GenerationResponse>;
  generateStructured<T>(request: StructuredGenerationRequest<T>, model: string): Promise<StructuredGenerationResponse<T>>;
  embed(request: EmbeddingRequest, model: string): Promise<EmbeddingResponse>;
  rerank?(request: RerankRequest, model: string): Promise<RerankResponse>;
}

export interface RateLimiter {
  acquire(tokens?: number): Promise<void>;
  release(tokens?: number): void;
  getAvailableTokens(): number;
}

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
}
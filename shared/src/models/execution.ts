import {
  ModelRegistry,
  ModelOperation,
  ModelConfig,
  GenerationRequest,
  GenerationResponse,
  StructuredGenerationRequest,
  StructuredGenerationResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
  ModelExecutionRecord,
  TokenUsage,
  ModelErrorCategory,
} from './types';
import { ModelProviderAdapter } from './provider.interface';
import { ModelObservability, generateExecutionId, hashInput, estimateCost } from './observability';

export interface ModelExecutionOptions {
  operation: ModelOperation;
  promptVersion?: string;
  maxRetries?: number;
  timeoutMs?: number;
  fallbackOnError?: boolean;
  enableObservability?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ModelExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  executionRecord: ModelExecutionRecord;
}

export class ModelExecutionService {
  private registry: ModelRegistry;
  private observability: ModelObservability;
  private defaultMaxRetries = 2;
  private defaultTimeoutMs = 30000;

  constructor(registry: ModelRegistry, observability?: ModelObservability) {
    this.registry = registry;
    this.observability = observability || new ModelObservability({ enabled: false });
  }

  async execute<T>(
    operation: ModelOperation,
    executeFn: (adapter: ModelProviderAdapter, model: any, config: ModelConfig) => Promise<T>,
    options: ModelExecutionOptions
  ): Promise<ModelExecutionResult<T>> {
    const config = this.registry.getConfigForOperation(operation);
    if (!config) {
      return this.createFailure<T>(operation, new Error(`No model configured for operation: ${operation}`), options);
    }

    const executionId = generateExecutionId();
    const startedAt = new Date().toISOString();
    let retryCount = 0;
    let lastError: Error | undefined;
    let fallbackUsed = false;
    let currentConfig = { ...config };

    const maxRetries = options.maxRetries ?? currentConfig.maxRetries ?? this.defaultMaxRetries;
    const timeoutMs = options.timeoutMs ?? currentConfig.timeoutMs ?? this.defaultTimeoutMs;

    while (retryCount <= maxRetries) {
      const adapter = this.registry.getAdapter(currentConfig.provider);
      if (!adapter) {
        lastError = new Error(`Provider adapter not found: ${currentConfig.provider}`);
        break;
      }

      const model = this.registry.getModel(currentConfig.model);
      if (!model) {
        lastError = new Error(`Model not found: ${currentConfig.model}`);
        break;
      }

      try {
        const result = await this.executeWithTimeout(
          () => executeFn(adapter, model, currentConfig),
          timeoutMs
        );

        const record = this.createExecutionRecord(
          executionId,
          operation,
          currentConfig,
          options,
          'success',
          startedAt,
          retryCount,
          fallbackUsed,
          undefined,
          undefined,
          undefined
        );

        if (options.enableObservability !== false) {
          this.observability.record(record);
        }

        return { success: true, data: result, executionRecord: record };
      } catch (error: any) {
        lastError = error;
        const category = this.categorizeError(error);

        if (category === 'rate_limit' || category === 'timeout') {
          await this.delay(this.calculateBackoff(retryCount));
        }

        retryCount++;

        if (retryCount <= maxRetries) {
          continue;
        }

        if (options.fallbackOnError !== false && currentConfig.fallbackModel) {
          fallbackUsed = true;
          const fallbackModel = this.registry.getModel(currentConfig.fallbackModel);
          if (fallbackModel) {
            const fallbackProvider = this.registry.getProvider(fallbackModel.providerId);
            if (fallbackProvider?.enabled) {
              currentConfig = {
                ...currentConfig,
                provider: fallbackProvider.id,
                model: fallbackModel.id,
              };
              retryCount = 0;
              continue;
            }
          }
        }
        break;
      }
    }

    return this.createFailure<T>(operation, lastError || new Error('Unknown error'), options, {
      executionId,
      startedAt,
      retryCount,
      fallbackUsed,
    });
  }

  async generate(
    operation: ModelOperation,
    request: GenerationRequest,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<GenerationResponse>> {
    return this.execute(operation, async (adapter, model, config) => {
      return adapter.generate(request, model);
    }, options);
  }

  async generateStructured<T>(
    operation: ModelOperation,
    request: StructuredGenerationRequest<T>,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<StructuredGenerationResponse<T>>> {
    return this.execute(operation, async (adapter, model, config) => {
      return adapter.generateStructured<T>(request, model);
    }, options);
  }

  async embed(
    operation: ModelOperation,
    request: EmbeddingRequest,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<EmbeddingResponse>> {
    return this.execute(operation, async (adapter, model, config) => {
      return adapter.embed(request, model);
    }, options);
  }

  async rerank(
    operation: ModelOperation,
    request: RerankRequest,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<RerankResponse>> {
    return this.execute(operation, async (adapter, model, config) => {
      if (!adapter.rerank) {
        throw new Error('Reranking not supported by this provider');
      }
      return adapter.rerank(request, model);
    }, options);
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private categorizeError(error: any): ModelErrorCategory {
    if (error?.category) return error.category;

    const message = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.response?.status;

    if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }
    if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('invalid api key')) {
      return 'auth_error';
    }
    if (status === 503 || message.includes('unavailable') || message.includes('service unavailable')) {
      return 'provider_unavailable';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    if (message.includes('context length') || message.includes('max tokens') || message.includes('too long')) {
      return 'context_length_exceeded';
    }
    return 'unknown';
  }

  private createExecutionRecord(
    executionId: string,
    operation: ModelOperation,
    config: ModelConfig,
    options: ModelExecutionOptions,
    status: ModelExecutionRecord['status'],
    startedAt: string,
    retryCount: number,
    fallbackUsed: boolean,
    tokenUsage?: TokenUsage,
    errorCategory?: ModelErrorCategory,
    errorMessage?: string,
    validationErrors?: string[]
  ): ModelExecutionRecord {
    const completedAt = new Date().toISOString();
    const latencyMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const inputHash = hashInput(JSON.stringify(options.metadata || {}));

    return {
      id: executionId,
      operation,
      providerId: config.provider,
      modelId: config.model,
      modelVersion: options.metadata?.modelVersion as string,
      promptVersion: options.promptVersion,
      inputHash,
      status,
      startedAt,
      completedAt,
      latencyMs,
      retryCount,
      fallbackUsed,
      tokenUsage,
      estimatedCost: tokenUsage ? estimateCost(tokenUsage, config.provider, config.model) : undefined,
      errorCategory,
      errorMessage,
      validationErrors,
      metadata: options.metadata,
    };
  }

  private createFailure<T>(
    operation: ModelOperation,
    error: Error,
    options: ModelExecutionOptions,
    extra?: { executionId: string; startedAt: string; retryCount: number; fallbackUsed: boolean }
  ): ModelExecutionResult<T> {
    const executionId = extra?.executionId || generateExecutionId();
    const startedAt = extra?.startedAt || new Date().toISOString();
    const category = this.categorizeError(error);

    const record = this.createExecutionRecord(
      executionId,
      operation,
      this.registry.getConfigForOperation(operation)!,
      options,
      'error',
      startedAt,
      extra?.retryCount || 0,
      extra?.fallbackUsed || false,
      undefined,
      category,
      error.message
    );

    if (options.enableObservability !== false) {
      this.observability.record(record);
    }

    return { success: false, error, executionRecord: record };
  }
}

export function createModelExecutionService(
  registry: ModelRegistry,
  observability?: ModelObservability
): ModelExecutionService {
  return new ModelExecutionService(registry, observability);
}
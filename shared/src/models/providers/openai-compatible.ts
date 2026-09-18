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
  TokenUsage,
  ModelErrorCategory,
} from './types';
import { ModelProviderAdapter, ModelProviderFactory, RateLimiter, TokenBucketConfig } from './provider.interface';

function createTokenBucket(config: TokenBucketConfig): RateLimiter {
  let tokens = config.capacity;
  let lastRefill = Date.now();

  const refill = () => {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const refillAmount = (elapsed / 1000) * config.refillRate;
    tokens = Math.min(config.capacity, tokens + refillAmount);
    lastRefill = now;
  };

  return {
    async acquire(requestedTokens = 1): Promise<void> {
      while (true) {
        refill();
        if (tokens >= requestedTokens) {
          tokens -= requestedTokens;
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    },
    release(returnedTokens = 1): void {
      refill();
      tokens = Math.min(config.capacity, tokens + returnedTokens);
    },
    getAvailableTokens(): number {
      refill();
      return tokens;
    },
  };
}

function mapErrorCategory(error: any): ModelErrorCategory {
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

export class OpenAICompatibleAdapter implements ModelProviderAdapter {
  readonly provider: ModelProvider;
  readonly models = new Map<string, ModelDefinition>();
  private client: any;
  private rateLimiter?: RateLimiter;
  private baseUrl: string;
  private apiKey: string;

  constructor(provider: ModelProvider) {
    this.provider = provider;
    this.baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
    this.apiKey = provider.apiKey || process.env.OPENAI_API_KEY || '';

    if (provider.rateLimit) {
      this.rateLimiter = createTokenBucket({
        capacity: provider.rateLimit.requestsPerMinute,
        refillRate: provider.rateLimit.requestsPerMinute / 60,
      });
    }
  }

  async initialize(): Promise<void> {
    if (!this.apiKey && this.provider.type !== 'ollama') {
      throw new Error(`API key required for provider ${this.provider.id}`);
    }

    if (this.provider.type === 'ollama') {
      this.client = {
        async post(url: string, data: any) {
          const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
          }
          return { data: await response.json() };
        },
      };
    } else {
      const { default: axios } = await import('axios');
      this.client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.provider.defaultHeaders,
        },
        timeout: 30000,
      });
    }
  }

  async shutdown(): Promise<void> {
    this.client = null;
  }

  async generate(request: GenerationRequest, model: ModelDefinition): Promise<GenerationResponse> {
    if (this.rateLimiter) await this.rateLimiter.acquire();

    const startTime = Date.now();
    const payload: any = {
      model: model.name,
      messages: [],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
      top_p: request.topP ?? 1,
      stop: request.stopSequences,
    };

    if (request.systemPrompt) {
      payload.messages.push({ role: 'system', content: request.systemPrompt });
    }
    payload.messages.push({ role: 'user', content: request.prompt });

    if (request.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
    } else if (request.responseFormat === 'json_schema' && request.jsonSchema) {
      payload.response_format = { type: 'json_schema', json_schema: request.jsonSchema };
    }

    try {
      const response = await this.client.post('/chat/completions', payload);
      const choice = response.data.choices?.[0];
      const text = choice?.message?.content || '';

      const usage: TokenUsage = {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      };

      return {
        text,
        usage,
        model: model.name,
        provider: this.provider.id,
        latencyMs: Date.now() - startTime,
        finishReason: choice?.finish_reason,
      };
    } catch (error: any) {
      throw this.enhanceError(error, 'generation');
    }
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>, model: ModelDefinition): Promise<StructuredGenerationResponse<T>> {
    if (this.rateLimiter) await this.rateLimiter.acquire();

    const startTime = Date.now();
    const payload: any = {
      model: model.name,
      messages: [],
      temperature: request.temperature ?? 0,
      max_tokens: request.maxTokens ?? 2000,
      response_format: { type: 'json_schema', json_schema: { name: 'output', schema: request.schema } },
    };

    if (request.systemPrompt) {
      payload.messages.push({ role: 'system', content: request.systemPrompt });
    }
    payload.messages.push({ role: 'user', content: request.prompt });

    try {
      const response = await this.client.post('/chat/completions', payload);
      const choice = response.data.choices?.[0];
      const text = choice?.message?.content || '{}';

      let data: T;
      let validationErrors: string[] = [];

      try {
        data = JSON.parse(text);
      } catch {
        validationErrors.push('Failed to parse JSON response');
        data = {} as T;
      }

      const usage: TokenUsage = {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: response.data.usage?.completion_tokens || 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      };

      return {
        data,
        usage,
        model: model.name,
        provider: this.provider.id,
        latencyMs: Date.now() - startTime,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      };
    } catch (error: any) {
      throw this.enhanceError(error, 'structured_generation');
    }
  }

  async embed(request: EmbeddingRequest, model: ModelDefinition): Promise<EmbeddingResponse> {
    if (this.rateLimiter) await this.rateLimiter.acquire(request.texts.length);

    const startTime = Date.now();
    const payload = {
      model: model.name,
      input: request.texts,
      dimensions: request.dimensions,
    };

    try {
      const response = await this.client.post('/embeddings', payload);
      const embeddings = response.data.data
        .sort((a: any, b: any) => a.index - b.index)
        .map((d: any) => d.embedding);

      const usage: TokenUsage = {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      };

      return {
        embeddings,
        usage,
        model: model.name,
        provider: this.provider.id,
        latencyMs: Date.now() - startTime,
        dimensions: embeddings[0]?.length || 0,
      };
    } catch (error: any) {
      throw this.enhanceError(error, 'embedding');
    }
  }

  async rerank(request: RerankRequest, model: ModelDefinition): Promise<RerankResponse> {
    if (this.rateLimiter) await this.rateLimiter.acquire();

    const startTime = Date.now();
    const payload = {
      model: model.name,
      query: request.query,
      documents: request.documents,
      top_k: request.topK,
    };

    try {
      const response = await this.client.post('/rerank', payload);
      const results = response.data.results || [];

      const usage: TokenUsage = {
        promptTokens: response.data.usage?.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: response.data.usage?.total_tokens || 0,
      };

      return {
        results,
        usage,
        model: model.name,
        provider: this.provider.id,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      throw this.enhanceError(error, 'reranking');
    }
  }

  async healthCheck(model: ModelDefinition): Promise<ModelHealthCheck> {
    const startTime = Date.now();
    try {
      if (this.provider.type === 'ollama') {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        if (!response.ok) throw new Error(`Ollama health check failed: ${response.status}`);
        return {
          providerId: this.provider.id,
          modelId: model.id,
          healthy: true,
          latencyMs: Date.now() - startTime,
          checkedAt: new Date().toISOString(),
        };
      }

      const response = await this.client.get('/models', { timeout: 5000 });
      return {
        providerId: this.provider.id,
        modelId: model.id,
        healthy: true,
        latencyMs: Date.now() - startTime,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        providerId: this.provider.id,
        modelId: model.id,
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error.message,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  getAvailableModels(capability?: string): ModelDefinition[] {
    const models = Array.from(this.models.values()).filter(m => m.enabled);
    if (!capability) return models;
    return models.filter(m => m.capabilities.includes(capability as any));
  }

  private enhanceError(error: any, operation: string): Error {
    const category = mapErrorCategory(error);
    const message = error?.response?.data?.error?.message || error?.message || 'Unknown error';
    const enhanced = new Error(`[${this.provider.id}] ${operation} failed: ${message}`);
    (enhanced as any).category = category;
    (enhanced as any).status = error?.status || error?.response?.status;
    (enhanced as any).provider = this.provider.id;
    (enhanced as any).originalError = error;
    return enhanced;
  }
}

export class OpenAICompatibleFactory implements ModelProviderFactory {
  createProvider(config: ModelProvider): ModelProviderAdapter {
    return new OpenAICompatibleAdapter(config);
  }

  getSupportedTypes(): string[] {
    return ['openai-compatible', 'ollama'];
  }
}
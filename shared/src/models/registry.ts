import {
  ModelProvider,
  ModelDefinition,
  ModelRegistryConfig,
  ModelConfig,
  ModelOperation,
  ModelHealthCheck,
} from './types';
import { ModelProviderAdapter, ModelProviderFactory } from './provider.interface';

export class ModelRegistry {
  private providers: Map<string, ModelProvider> = new Map();
  private models: Map<string, ModelDefinition> = new Map();
  private adapters: Map<string, ModelProviderAdapter> = new Map();
  private factories: Map<string, ModelProviderFactory> = new Map();
  private defaultModels: Record<ModelOperation, string> = {
    extraction: '',
    classification: '',
    embedding: '',
    reasoning: '',
    matching: '',
    reranking: '',
  };
  private healthCache: Map<string, ModelHealthCheck> = new Map();
  private healthCacheTTL = 60000;

  constructor(config?: ModelRegistryConfig) {
    if (config) {
      this.loadConfig(config);
    }
  }

  loadConfig(config: ModelRegistryConfig): void {
    for (const provider of config.providers) {
      this.registerProvider(provider);
    }
    for (const model of config.models) {
      this.registerModel(model);
    }
    this.defaultModels = { ...this.defaultModels, ...config.defaultModels };
  }

  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  registerModel(model: ModelDefinition): void {
    this.models.set(model.id, model);
  }

  registerFactory(type: string, factory: ModelProviderFactory): void {
    this.factories.set(type, factory);
  }

  async initialize(): Promise<void> {
    for (const [id, provider] of this.providers) {
      if (!provider.enabled) continue;
      const factory = this.factories.get(provider.type);
      if (!factory) {
        console.warn(`No factory registered for provider type: ${provider.type}`);
        continue;
      }
      try {
        const adapter = factory.createProvider(provider);
        await adapter.initialize();
        this.adapters.set(id, adapter);
        for (const model of adapter.models.values()) {
          if (!this.models.has(model.id)) {
            this.registerModel(model);
          }
        }
      } catch (err) {
        console.error(`Failed to initialize provider ${id}:`, err);
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.shutdown();
    }
    this.adapters.clear();
  }

  getProvider(id: string): ModelProvider | undefined {
    return this.providers.get(id);
  }

  getModel(id: string): ModelDefinition | undefined {
    return this.models.get(id);
  }

  getModelsByCapability(capability: string): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(m => m.enabled && m.capabilities.includes(capability as any));
  }

  getDefaultModel(operation: ModelOperation): ModelDefinition | undefined {
    const modelId = this.defaultModels[operation];
    if (!modelId) return undefined;
    return this.models.get(modelId);
  }

  setDefaultModel(operation: ModelOperation, modelId: string): void {
    if (!this.models.has(modelId)) {
      throw new Error(`Model ${modelId} not registered`);
    }
    this.defaultModels[operation] = modelId;
  }

  getAdapter(providerId: string): ModelProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  getAdapterForModel(modelId: string): ModelProviderAdapter | undefined {
    const model = this.models.get(modelId);
    if (!model) return undefined;
    return this.adapters.get(model.providerId);
  }

  async healthCheck(modelId: string): Promise<ModelHealthCheck> {
    const cached = this.healthCache.get(modelId);
    if (cached && Date.now() - new Date(cached.checkedAt).getTime() < this.healthCacheTTL) {
      return cached;
    }

    const model = this.models.get(modelId);
    if (!model) {
      return {
        providerId: '',
        modelId,
        healthy: false,
        error: 'Model not found',
        checkedAt: new Date().toISOString(),
      };
    }

    const adapter = this.adapters.get(model.providerId);
    if (!adapter) {
      return {
        providerId: model.providerId,
        modelId,
        healthy: false,
        error: 'Provider adapter not initialized',
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const result = await adapter.healthCheck(model);
      this.healthCache.set(modelId, result);
      return result;
    } catch (err) {
      const result: ModelHealthCheck = {
        providerId: model.providerId,
        modelId,
        healthy: false,
        error: (err as Error).message,
        checkedAt: new Date().toISOString(),
      };
      this.healthCache.set(modelId, result);
      return result;
    }
  }

  async healthCheckAll(): Promise<ModelHealthCheck[]> {
    const checks = await Promise.all(
      Array.from(this.models.keys()).map(id => this.healthCheck(id))
    );
    return checks;
  }

  getConfigForOperation(operation: ModelOperation): ModelConfig | undefined {
    const model = this.getDefaultModel(operation);
    if (!model) return undefined;
    const provider = this.providers.get(model.providerId);
    if (!provider) return undefined;

    return {
      provider: provider.id,
      model: model.id,
      temperature: (model.config?.temperature as number) ?? 0,
      maxTokens: (model.config?.maxTokens as number) ?? 2000,
      timeoutMs: (model.config?.timeoutMs as number) ?? 30000,
      maxRetries: (model.config?.maxRetries as number) ?? 2,
      fallbackModel: model.fallbackModelId,
    };
  }

  listProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  listModels(): ModelDefinition[] {
    return Array.from(this.models.values());
  }
}

export const modelRegistry = new ModelRegistry();
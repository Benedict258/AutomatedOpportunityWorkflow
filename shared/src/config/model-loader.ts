import { ModelRegistryConfig, ModelProvider, ModelDefinition } from '../../models/types';

function parseEnvArray(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function parseEnvNumber(value: string, defaultValue: number): number {
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseEnvBoolean(value: string, defaultValue: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

function getEnvPrefix(prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix)) {
      result[key] = value;
    }
  }
  return result;
}

export function loadModelRegistryConfig(): ModelRegistryConfig {
  const providers: ModelProvider[] = [];
  const models: ModelDefinition[] = [];

  // Load providers from MODEL_PROVIDER_<ID>_* env vars
  const providerEnvs = getEnvPrefix('MODEL_PROVIDER_');
  const providerIds = new Set<string>();

  for (const key of Object.keys(providerEnvs)) {
    const match = key.match(/^MODEL_PROVIDER_([A-Z0-9_]+)_/);
    if (match) {
      providerIds.add(match[1].toLowerCase());
    }
  }

  for (const id of providerIds) {
    const upperId = id.toUpperCase();
    const type = process.env[`MODEL_PROVIDER_${upperId}_TYPE`];
    if (!type) continue;

    const provider: ModelProvider = {
      id,
      name: process.env[`MODEL_PROVIDER_${upperId}_NAME`] || id,
      type: type as any,
      baseUrl: process.env[`MODEL_PROVIDER_${upperId}_BASE_URL`],
      apiKey: process.env[`MODEL_PROVIDER_${upperId}_API_KEY`],
      enabled: parseEnvBoolean(process.env[`MODEL_PROVIDER_${upperId}_ENABLED`] || '', true),
      priority: parseEnvNumber(process.env[`MODEL_PROVIDER_${upperId}_PRIORITY`] || '', 1),
      rateLimit: process.env[`MODEL_PROVIDER_${upperId}_RATE_LIMIT_RPM`] ? {
        requestsPerMinute: parseEnvNumber(process.env[`MODEL_PROVIDER_${upperId}_RATE_LIMIT_RPM`]!, 60),
        tokensPerMinute: parseEnvNumber(process.env[`MODEL_PROVIDER_${upperId}_RATE_LIMIT_TPM`] || '', 150000),
      } : undefined,
    };
    providers.push(provider);
  }

  // Load models from MODEL_<ID>_* env vars
  const modelEnvs = getEnvPrefix('MODEL_');
  const modelIds = new Set<string>();

  for (const key of Object.keys(modelEnvs)) {
    const match = key.match(/^MODEL_([A-Z0-9_]+)_/);
    if (match) {
      const potentialId = match[1];
      if (!['PROVIDER', 'DEFAULT'].includes(potentialId)) {
        modelIds.add(potentialId.toLowerCase().replace(/_/g, '-'));
      }
    }
  }

  for (const id of modelIds) {
    const upperId = id.toUpperCase().replace(/-/g, '_');
    const providerId = process.env[`MODEL_${upperId}_PROVIDER`];
    if (!providerId) continue;

    const capabilities = process.env[`MODEL_${upperId}_CAPABILITIES`]
      ? parseEnvArray(process.env[`MODEL_${upperId}_CAPABILITIES`]!)
      : ['text-generation'];

    const model: ModelDefinition = {
      id,
      providerId,
      name: process.env[`MODEL_${upperId}_NAME`] || id,
      capabilities: capabilities as any,
      contextLength: process.env[`MODEL_${upperId}_CONTEXT`]
        ? parseEnvNumber(process.env[`MODEL_${upperId}_CONTEXT`]!, 4096)
        : undefined,
      embeddingDimensions: process.env[`MODEL_${upperId}_DIMENSIONS`]
        ? parseEnvNumber(process.env[`MODEL_${upperId}_DIMENSIONS`]!, 1536)
        : undefined,
      structuredOutputSupport: capabilities.includes('structured-generation'),
      enabled: parseEnvBoolean(process.env[`MODEL_${upperId}_ENABLED`] || '', true),
      fallbackModelId: process.env[`MODEL_${upperId}_FALLBACK`],
      config: {
        temperature: process.env[`MODEL_${upperId}_TEMPERATURE`]
          ? parseEnvNumber(process.env[`MODEL_${upperId}_TEMPERATURE`]!, 0.1)
          : undefined,
        maxTokens: process.env[`MODEL_${upperId}_MAX_TOKENS`]
          ? parseEnvNumber(process.env[`MODEL_${upperId}_MAX_TOKENS`]!, 2000)
          : undefined,
        timeoutMs: process.env[`MODEL_${upperId}_TIMEOUT_MS`]
          ? parseEnvNumber(process.env[`MODEL_${upperId}_TIMEOUT_MS`]!, 30000)
          : undefined,
        maxRetries: process.env[`MODEL_${upperId}_MAX_RETRIES`]
          ? parseEnvNumber(process.env[`MODEL_${upperId}_MAX_RETRIES`]!, 2)
          : undefined,
      },
    };
    models.push(model);
  }

  // Load default model assignments
  const defaultModels: ModelRegistryConfig['defaultModels'] = {
    extraction: process.env.MODEL_DEFAULT_EXTRACTION || '',
    classification: process.env.MODEL_DEFAULT_CLASSIFICATION || '',
    embedding: process.env.MODEL_DEFAULT_EMBEDDING || '',
    reasoning: process.env.MODEL_DEFAULT_REASONING || '',
    matching: process.env.MODEL_DEFAULT_MATCHING || '',
    reranking: process.env.MODEL_DEFAULT_RERANKING || '',
  };

  // Sort providers by priority
  providers.sort((a, b) => a.priority - b.priority);

  return {
    providers,
    models,
    defaultModels,
  };
}

export function createDefaultConfig(): ModelRegistryConfig {
  return {
    providers: [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        enabled: !!process.env.OPENAI_API_KEY,
        priority: 1,
        rateLimit: { requestsPerMinute: 60, tokensPerMinute: 150000 },
      },
      {
        id: 'ollama',
        name: 'Ollama Local',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        enabled: true,
        priority: 2,
      },
    ],
    models: [
      {
        id: 'gpt-4o-mini',
        providerId: 'openai',
        name: 'gpt-4o-mini',
        capabilities: ['text-generation', 'structured-generation'],
        contextLength: 128000,
        structuredOutputSupport: true,
        enabled: !!process.env.OPENAI_API_KEY,
        config: { temperature: 0.1, maxTokens: 4096 },
      },
      {
        id: 'text-embedding-3-small',
        providerId: 'openai',
        name: 'text-embedding-3-small',
        capabilities: ['embeddings'],
        embeddingDimensions: 1536,
        structuredOutputSupport: false,
        enabled: !!process.env.OPENAI_API_KEY,
      },
      {
        id: 'nemotron-3-ultra',
        providerId: 'openai',
        name: 'nvidia/nemotron-3-ultra',
        capabilities: ['text-generation', 'structured-generation'],
        contextLength: 4096,
        structuredOutputSupport: true,
        enabled: !!process.env.OPENAI_API_KEY,
        config: { temperature: 0.1, maxTokens: 4096 },
      },
    ],
    defaultModels: {
      extraction: 'gpt-4o-mini',
      classification: 'gpt-4o-mini',
      embedding: 'text-embedding-3-small',
      reasoning: 'gpt-4o-mini',
      matching: 'text-embedding-3-small',
      reranking: '',
    },
  };
}
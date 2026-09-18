# Model Providers

## Supported Providers

### OpenAI-Compatible
- **Type**: `openai-compatible`
- **Endpoints**: `/chat/completions`, `/embeddings`, `/rerank`
- **Auth**: Bearer token
- **Models**: gpt-4o, gpt-4o-mini, text-embedding-3-small, text-embedding-3-large, nemotron-3-ultra
- **Structured Output**: JSON Schema via `response_format`

### Ollama (Local)
- **Type**: `ollama`
- **Endpoints**: `/api/chat`, `/api/embeddings`
- **Auth**: None (local)
- **Models**: llama3.1, llama3.2, mistral, codellama, nomic-embed-text
- **Structured Output**: JSON Schema via `format: json`

## Adding a New Provider

1. Implement `ModelProviderAdapter` interface
2. Implement `ModelProviderFactory` interface
3. Register factory: `registry.registerFactory('my-type', new MyFactory())`
4. Add provider config via environment variables

## Provider Configuration

```env
MODEL_PROVIDER_MY_PROVIDER_ID=my-provider
MODEL_PROVIDER_MY_PROVIDER_NAME=My Provider
MODEL_PROVIDER_MY_PROVIDER_TYPE=openai-compatible
MODEL_PROVIDER_MY_PROVIDER_BASE_URL=https://api.myprovider.com/v1
MODEL_PROVIDER_MY_PROVIDER_API_KEY=sk-...
MODEL_PROVIDER_MY_PROVIDER_ENABLED=true
MODEL_PROVIDER_MY_PROVIDER_PRIORITY=1
MODEL_PROVIDER_MY_PROVIDER_RATE_LIMIT_RPM=60
MODEL_PROVIDER_MY_PROVIDER_RATE_LIMIT_TPM=150000
```

## Model Definitions

```env
MODEL_MY_MODEL_PROVIDER=my-provider
MODEL_MY_MODEL_NAME=my-model-name
MODEL_MY_MODEL_CAPABILITIES=text-generation,structured-generation,embeddings
MODEL_MY_MODEL_ENABLED=true
MODEL_MY_MODEL_CONTEXT=8192
MODEL_MY_MODEL_DIMENSIONS=1536
MODEL_MY_MODEL_TEMPERATURE=0.1
MODEL_MY_MODEL_MAX_TOKENS=4096
```

## Default Model Assignments

```env
MODEL_DEFAULT_EXTRACTION=my-model
MODEL_DEFAULT_CLASSIFICATION=my-model
MODEL_DEFAULT_EMBEDDING=my-embedding-model
MODEL_DEFAULT_REASONING=my-model
MODEL_DEFAULT_MATCHING=my-embedding-model
MODEL_DEFAULT_RERANKING=
```
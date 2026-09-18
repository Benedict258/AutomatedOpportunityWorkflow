import { ModelRegistry } from './registry';
import { ModelExecutionService, ModelExecutionOptions, ModelExecutionResult } from './execution';
import { ModelObservability, generateExecutionId } from './observability';
import { ModelCache, generateKey as cacheGenerateKey } from './cache';
import {
  ModelOperation,
  GenerationRequest,
  GenerationResponse,
  StructuredGenerationRequest,
  StructuredGenerationResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
  TokenUsage,
} from './types';

export interface UnifiedModelServiceConfig {
  registry?: ModelRegistry;
  enableObservability?: boolean;
  enableCaching?: boolean;
  cacheTTLMs?: number;
  defaultMaxRetries?: number;
  defaultTimeoutMs?: number;
}

export class UnifiedModelService {
  private registry: ModelRegistry;
  private execution: ModelExecutionService;
  private observability: ModelObservability;
  private cache: ModelCache;
  private initialized = false;

  constructor(config: UnifiedModelServiceConfig = {}) {
    this.registry = config.registry || new ModelRegistry();
    this.observability = new ModelObservability({
      enabled: config.enableObservability ?? true,
    });
    this.cache = new ModelCache({
      enabled: config.enableCaching ?? true,
      defaultTTLMs: config.cacheTTLMs ?? 3600000,
    });
    this.execution = new ModelExecutionService(this.registry, this.observability);
  }

  async initialize(config?: any): Promise<void> {
    if (this.initialized) return;

    // Load configuration
    try {
      const { modelConfig } = await import('../config');
      this.registry.loadConfig(modelConfig);
    } catch (e) {
      console.warn('Could not load model config from environment, using defaults');
    }

    // Register provider factory
    const { OpenAICompatibleFactory } = await import('./providers/openai-compatible');
    this.registry.registerFactory('openai-compatible', new OpenAICompatibleFactory());
    this.registry.registerFactory('ollama', new OpenAICompatibleFactory());

    // Initialize registry
    await this.registry.initialize();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    await this.registry.shutdown();
    await this.observability.shutdown();
    await this.cache.clear();
    this.initialized = false;
  }

  // Generation methods
  async generate(
    operation: ModelOperation,
    request: GenerationRequest,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<GenerationResponse>> {
    return this.execution.generate(operation, request, options);
  }

  async generateStructured<T>(
    operation: ModelOperation,
    request: StructuredGenerationRequest<T>,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<StructuredGenerationResponse<T>>> {
    // Check cache first
    if (options.enableObservability !== false) {
      const cacheKey = cacheGenerateKey(operation, options.metadata?.modelId || '', request.promptVersion || 'v1', '');
      // Note: For structured generation, we'd need to hash the full request
    }

    return this.execution.generateStructured(operation, request, options);
  }

  async embed(
    operation: ModelOperation,
    request: EmbeddingRequest,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<EmbeddingResponse>> {
    return this.execution.embed(operation, request, options);
  }

  async rerank(
    operation: ModelOperation,
    request: RerankRequest,
    options: ModelExecutionOptions = { operation }
  ): Promise<ModelExecutionResult<RerankResponse>> {
    return this.execution.rerank(operation, request, options);
  }

  // Convenience methods for specific operations
  async extract(opportunityText: string, options: ModelExecutionOptions = {}): Promise<ModelExecutionResult<GenerationResponse>> {
    return this.generate('extraction', {
      prompt: opportunityText,
      systemPrompt: 'You are an expert at extracting structured information from job postings and opportunity descriptions.',
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: 'json',
    }, { operation: 'extraction', ...options });
  }

  async classify(text: string, options: ModelExecutionOptions = {}): Promise<ModelExecutionResult<GenerationResponse>> {
    return this.generate('classification', {
      prompt: text,
      systemPrompt: 'You are a taxonomy classifier for opportunities.',
      temperature: 0,
      maxTokens: 512,
      responseFormat: 'json',
    }, { operation: 'classification', ...options });
  }

  async extractRequirements(text: string, options: ModelExecutionOptions = {}): Promise<ModelExecutionResult<GenerationResponse>> {
    return this.generate('requirement-extraction', {
      prompt: text,
      systemPrompt: 'You are an expert at extracting requirements from job postings.',
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: 'json',
    }, { operation: 'requirement-extraction', ...options });
  }

  async generateEmbeddings(texts: string[], options: ModelExecutionOptions = {}): Promise<ModelExecutionResult<EmbeddingResponse>> {
    return this.embed('embedding', { texts }, options);
  }

  async explain(
    opportunity: any,
    candidate: any,
    matchFactors: any,
    score: number,
    options: ModelExecutionOptions = {}
  ): Promise<ModelExecutionResult<GenerationResponse>> {
    return this.generate('reasoning', {
      prompt: this.buildExplanationPrompt(opportunity, candidate, matchFactors, score),
      systemPrompt: 'You are explaining an already-computed opportunity intelligence result. You MUST NOT change eligibility, score, ranking, deadline, or source facts.',
      temperature: 0.3,
      maxTokens: 2048,
      responseFormat: 'json',
    }, { operation: 'reasoning', ...options });
  }

  private buildExplanationPrompt(opportunity: any, candidate: any, matchFactors: any, score: number): string {
    return `Explain the match between this candidate and opportunity:

OPPORTUNITY:
Title: ${opportunity.title}
Organization: ${opportunity.organization}
Description: ${opportunity.description}
Type: ${opportunity.opportunityType}
Location: ${opportunity.location}
Remote: ${opportunity.remoteStatus}
Deadline: ${opportunity.deadline}

CANDIDATE:
Skills: ${candidate.skills?.join(', ') || 'Not provided'}
Experience: ${candidate.experience?.map((e: any) => e.title).join(', ') || 'Not provided'}
Education: ${candidate.education?.map((e: any) => e.degree).join(', ') || 'Not provided'}
Location Preference: ${candidate.locationPreferences?.join(', ') || 'Not provided'}

MATCH FACTORS:
Career Alignment: ${matchFactors.careerAlignment?.toFixed(2) || 'N/A'}
Skill Alignment: ${matchFactors.skillAlignment?.toFixed(2) || 'N/A'}
Eligibility: ${matchFactors.eligibility?.toFixed(2) || 'N/A'}
Experience Fit: ${matchFactors.experienceFit?.toFixed(2) || 'N/A'}
Education Fit: ${matchFactors.educationFit?.toFixed(2) || 'N/A'}
Opportunity Value: ${matchFactors.opportunityValue?.toFixed(2) || 'N/A'}
Location/Remote Fit: ${matchFactors.locationFit?.toFixed(2) || 'N/A'}
Timing: ${matchFactors.timing?.toFixed(2) || 'N/A'}

FINAL SCORE: ${score.toFixed(3)}

Return JSON with:
{
  "summary": "Brief explanation of why this opportunity matches",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "eligibilityNotes": "Notes on eligibility status",
  "preparation": ["action1", "action2"],
  "uncertainties": ["uncertainty1"]
}`;
  }

  getRegistry(): ModelRegistry {
    return this.registry;
  }

  getObservability(): ModelObservability {
    return this.observability;
  }

  getCache(): ModelCache {
    return this.cache;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const unifiedModelService = new UnifiedModelService();
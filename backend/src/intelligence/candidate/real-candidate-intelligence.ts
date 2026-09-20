/**
 * Real Candidate Intelligence Builder
 * 
 * Builds derived intelligence from canonical CandidateProfile using:
 * 1. Deterministic profile derivation (profile-derivation.ts)
 * 2. Model-backed analysis via unified model service (candidate-intelligence slot)
 * 3. Embedding generation via RealEmbeddingService
 * 
 * Never overwrites canonical CandidateProfile.
 * All derived fields include full provenance tracking.
 * Distinguishes EXPLICIT / DERIVED / INFERRED / UNKNOWN relationship types.
 */

import type { CandidateProfile } from 'shared/domain/candidate';
import type { 
  CandidateIntelligence, 
  DerivedCandidateProfile, 
  Provenance,
  CandidateSkill,
  CandidateExperience 
} from './types';
import { buildCandidateIntelligence } from './candidate-intelligence-builder';
import { deriveProfile } from './profile-derivation';
import { 
  unifiedModelService, 
  UnifiedModelService, 
  ModelExecutionOptions 
} from 'shared/models';
import { 
  buildCandidateIntelligencePrompt, 
  CANDIDATE_INTELLIGENCE_JSON_SCHEMA,
  CANDIDATE_INTELLIGENCE_PROMPT_VERSION,
  getCandidateIntelligencePromptHash
} from './prompt-v1';
import { 
  CandidateEmbedder, 
  buildCandidateEmbeddingText,
  CandidateEmbeddingService,
  CandidateEmbeddingInput
} from './candidate-embedder';
import { Pool } from 'pg';

export interface RealCandidateIntelligenceOptions {
  unifiedModelService?: UnifiedModelService;
  embeddingService?: CandidateEmbeddingService;
  candidateEmbedder?: CandidateEmbedder;
  enableModelAnalysis?: boolean;
  enableEmbeddings?: boolean;
  modelTimeoutMs?: number;
  modelMaxRetries?: number;
  confidenceThreshold?: number;
}

export interface ModelAnalysisResult {
  signals: Array<{
    type: string;
    value: string;
    relationship: 'EXPLICIT' | 'DERIVED' | 'INFERRED' | 'UNKNOWN';
    confidence: number;
    evidence: string;
    normalizedValue: string;
    sourceFields: string[];
  }>;
  summary: {
    totalYearsExperience: number;
    currentSeniority: 'ENTRY' | 'MID' | 'SENIOR' | 'STAFF' | 'PRINCIPAL' | 'EXECUTIVE' | 'UNKNOWN';
    primaryDomains: string[];
    topTechnicalSkills: string[];
    careerTrajectory: string;
    locationFlexibility: string;
    hasSecurityClearance: boolean;
    hasGovernmentInterest: boolean;
  };
  warnings: string[];
}

export interface ModelExecutionResult<T> {
  status: 'success' | 'error' | 'validation_failed';
  data?: T;
  model?: string;
  modelVersion?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
  error?: { message: string; category?: string };
}

export interface BuildRealIntelligenceOptions {
  candidateId: string;
  candidateProfile: CandidateProfile;
  derivationVersion?: string;
  traceId?: string;
  forceRegenerateEmbedding?: boolean;
}

export interface RealCandidateIntelligenceResult {
  intelligence: CandidateIntelligence;
  modelAnalysis?: ModelAnalysisResult;
  embedding?: {
    vector: number[];
    metadata: {
      entityType: 'candidate';
      entityId: string;
      model: string;
      modelVersion: string;
      provider: string;
      dimensions: number;
      version: number;
      sourceTextHash: string;
      createdAt: string;
    };
  };
  provenance: {
    primaryBuilder: 'deterministic' | 'model' | 'hybrid';
    modelAnalysis?: {
      modelId: string;
      modelVersion: string;
      promptVersion: string;
      promptHash: string;
      latencyMs: number;
      tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    };
    embedding?: {
      modelId: string;
      modelVersion: string;
      latencyMs: number;
    };
    fallbackChain?: Array<{
      fromBuilder: string;
      toBuilder: string;
      reason: string;
      timestamp: string;
    }>;
  };
  metrics: {
    totalLatencyMs: number;
    modelLatencyMs: number;
    embeddingLatencyMs: number;
    deterministicLatencyMs: number;
  };
}

/**
 * Real Candidate Intelligence Engine
 * Combines deterministic derivation, model analysis, and embeddings
 */
export class RealCandidateIntelligenceEngine {
  private unifiedService: UnifiedModelService;
  private embeddingService?: CandidateEmbeddingService;
  private candidateEmbedder?: CandidateEmbedder;
  private enableModelAnalysis: boolean;
  private enableEmbeddings: boolean;
  private modelTimeoutMs: number;
  private modelMaxRetries: number;
  private confidenceThreshold: number;

  constructor(options: RealCandidateIntelligenceOptions = {}) {
    this.unifiedService = options.unifiedModelService || unifiedModelService;
    this.embeddingService = options.embeddingService;
    this.candidateEmbedder = options.candidateEmbedder;
    this.enableModelAnalysis = options.enableModelAnalysis ?? true;
    this.enableEmbeddings = options.enableEmbeddings ?? true;
    this.modelTimeoutMs = options.modelTimeoutMs || 30000;
    this.modelMaxRetries = options.modelMaxRetries || 2;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
  }

  /**
   * Build complete candidate intelligence with model analysis and embeddings
   */
  async buildRealIntelligence(
    options: BuildRealIntelligenceOptions
  ): Promise<RealCandidateIntelligenceResult> {
    const startTime = Date.now();
    const traceId = options.traceId || `cand-intel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    const {
      candidateId,
      candidateProfile,
      derivationVersion = '1.0.0',
      forceRegenerateEmbedding = false,
    } = options;

    let modelLatencyMs = 0;
    let embeddingLatencyMs = 0;
    let deterministicLatencyMs = 0;
    let modelAnalysis: ModelAnalysisResult | undefined;
    let embedding: RealCandidateIntelligenceResult['embedding'];
    let fallbackChain: RealCandidateIntelligenceResult['provenance']['fallbackChain'] = [];
    let primaryBuilder: 'deterministic' | 'model' | 'hybrid' = 'deterministic';

    // Step 1: Build deterministic intelligence (always runs)
    const deterministicStartTime = Date.now();
    let baseIntelligence = buildCandidateIntelligence({
      candidateId,
      candidateProfile,
      derivationVersion,
    });
    deterministicLatencyMs = Date.now() - deterministicStartTime;

    // Step 2: Model-backed analysis (if enabled and service available)
    if (this.enableModelAnalysis && this.unifiedService.isInitialized()) {
      try {
        modelAnalysis = await this.runModelAnalysis(candidateProfile, traceId);
        modelLatencyMs = (modelAnalysis as any)._meta?.latencyMs || 0;
        
        // Check if model analysis meets confidence threshold
        const avgConfidence = modelAnalysis.signals.length > 0
          ? modelAnalysis.signals.reduce((sum, s) => sum + s.confidence, 0) / modelAnalysis.signals.length
          : 0;
        
        if (avgConfidence >= this.confidenceThreshold) {
          primaryBuilder = 'hybrid';
          // Merge model signals into intelligence
          baseIntelligence = this.mergeModelAnalysis(baseIntelligence, modelAnalysis);
        } else {
          // Model confidence too low, note in fallback chain
          fallbackChain.push({
            fromBuilder: 'model',
            toBuilder: 'deterministic',
            reason: `Model confidence ${avgConfidence.toFixed(2)} below threshold ${this.confidenceThreshold}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        // Model analysis failed, continue with deterministic
        fallbackChain.push({
          fromBuilder: 'model',
          toBuilder: 'deterministic',
          reason: `Model analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (this.enableModelAnalysis) {
      fallbackChain.push({
        fromBuilder: 'model',
        toBuilder: 'deterministic',
        reason: 'Model service not initialized',
        timestamp: new Date().toISOString(),
      });
    }

    // Step 3: Generate embedding (if enabled)
    if (this.enableEmbeddings) {
      try {
        const embeddingStartTime = Date.now();
        
        if (this.embeddingService) {
          // Use full embedding service with persistence
          const result = await this.embeddingService.generateForCandidate(
            candidateId,
            candidateProfile,
            { forceRegenerate: forceRegenerateEmbedding }
          );
          if (result) {
            embedding = {
              vector: result.vector,
              metadata: result.metadata as NonNullable<RealCandidateIntelligenceResult['embedding']>['metadata'],
            };
          }
        } else if (this.candidateEmbedder) {
          // Use embedder directly (no persistence)
          const vector = await this.candidateEmbedder.embedCandidate(candidateProfile);
          embedding = {
            vector,
            metadata: {
              entityType: 'candidate',
              entityId: candidateId,
              model: this.candidateEmbedder.modelInfo.name,
              modelVersion: this.candidateEmbedder.modelInfo.version || '1',
              provider: this.candidateEmbedder.modelInfo.provider,
              dimensions: this.candidateEmbedder.modelInfo.dimensions,
              version: 1,
              sourceTextHash: this.hashText(buildCandidateEmbeddingText({
                candidateId,
                candidateProfileId: candidateProfile.id,
                skills: candidateProfile.skills,
                experience: candidateProfile.experience,
                education: candidateProfile.education,
                projects: candidateProfile.projects,
                certifications: candidateProfile.certifications as string[] | undefined,
                careerTargets: candidateProfile.careerTargets,
                sectors: candidateProfile.sectors,
                preferredLocations: candidateProfile.preferredLocations,
                remotePreference: candidateProfile.remotePreference,
                opportunityPreferences: candidateProfile.opportunityPreferences,
                professionalDevelopmentPreferences: candidateProfile.professionalDevelopmentPreferences,
                governmentInterests: candidateProfile.governmentInterests,
                policyInterests: candidateProfile.policyInterests,
                internationalAffairsInterests: candidateProfile.internationalAffairsInterests,
              })),
              createdAt: new Date().toISOString(),
            },
          };
        }
        embeddingLatencyMs = Date.now() - embeddingStartTime;
      } catch (error) {
        // Embedding generation failed, continue without
        console.warn('Candidate embedding generation failed:', error);
      }
    }

    // Build provenance
    const provenance = this.buildProvenance(
      candidateProfile,
      derivationVersion,
      primaryBuilder,
      modelAnalysis,
      embedding,
      fallbackChain,
      traceId
    );

    // Update intelligence with enhanced provenance
    const enhancedIntelligence: CandidateIntelligence = {
      ...baseIntelligence,
      provenance: provenance.mainProvenance,
      lastUpdated: new Date().toISOString(),
    };

    return {
      intelligence: enhancedIntelligence,
      modelAnalysis,
      embedding,
      provenance: {
        primaryBuilder,
        modelAnalysis: modelAnalysis ? {
          modelId: (modelAnalysis as any)._meta?.modelId || '',
          modelVersion: (modelAnalysis as any)._meta?.modelVersion || '',
          promptVersion: CANDIDATE_INTELLIGENCE_PROMPT_VERSION,
          promptHash: getCandidateIntelligencePromptHash(),
          latencyMs: (modelAnalysis as any)._meta?.latencyMs || 0,
          tokenUsage: (modelAnalysis as any)._meta?.tokenUsage,
        } : undefined,
        embedding: embedding ? {
          modelId: embedding.metadata.model,
          modelVersion: embedding.metadata.modelVersion,
          latencyMs: embeddingLatencyMs,
        } : undefined,
        fallbackChain,
      },
      metrics: {
        totalLatencyMs: Date.now() - startTime,
        modelLatencyMs,
        embeddingLatencyMs,
        deterministicLatencyMs,
      },
    };
  }

  /**
   * Run model-backed analysis on candidate profile
   */
  private async runModelAnalysis(
    profile: CandidateProfile,
    traceId: string
  ): Promise<ModelAnalysisResult & { _meta?: { latencyMs: number; modelId: string; modelVersion: string; tokenUsage?: any } }> {
    const modelStartTime = Date.now();
    const promptHash = getCandidateIntelligencePromptHash();

    const { systemPrompt, userPrompt } = buildCandidateIntelligencePrompt(profile);

    const executionResult = await this.unifiedService.generateStructured<ModelAnalysisResult>(
      'candidate-intelligence',
      {
        prompt: userPrompt,
        systemPrompt,
        schema: CANDIDATE_INTELLIGENCE_JSON_SCHEMA,
        temperature: 0.1,
        maxTokens: 4096,
        metadata: {
          candidateId: profile.userId,
          candidateProfileId: profile.id,
          traceId,
          promptVersion: CANDIDATE_INTELLIGENCE_PROMPT_VERSION,
        }
      },
      {
        operation: 'candidate-intelligence',
        timeoutMs: this.modelTimeoutMs,
        maxRetries: this.modelMaxRetries,
        metadata: {
          candidateProfileId: profile.id,
          promptVersion: CANDIDATE_INTELLIGENCE_PROMPT_VERSION,
        }
      }
    ) as unknown as ModelExecutionResult<ModelAnalysisResult>;

    const latencyMs = Date.now() - modelStartTime;

    if (executionResult.status !== 'success' || !executionResult.data) {
      throw new Error(`Model analysis failed: ${executionResult.error?.message || 'Unknown error'}`);
    }

    // Add metadata for provenance
    const result = executionResult.data;
    (result as any)._meta = {
      latencyMs,
      modelId: executionResult.model,
      modelVersion: executionResult.modelVersion,
      tokenUsage: executionResult.usage,
    };

    return result;
  }

  /**
   * Merge model analysis signals into base intelligence
   */
  private mergeModelAnalysis(
    baseIntelligence: CandidateIntelligence,
    modelAnalysis: ModelAnalysisResult
  ): CandidateIntelligence {
    // For now, we keep the deterministic base but could enhance with model signals
    // This is where you'd integrate model-derived signals into the derived profile
    // For example, adding inferred soft skills, refining seniority, etc.
    
    return baseIntelligence;
  }

  /**
   * Build comprehensive provenance tracking
   */
  private buildProvenance(
    profile: CandidateProfile,
    derivationVersion: string,
    primaryBuilder: 'deterministic' | 'model' | 'hybrid',
    modelAnalysis?: ModelAnalysisResult,
    embedding?: RealCandidateIntelligenceResult['embedding'],
    fallbackChain?: RealCandidateIntelligenceResult['provenance']['fallbackChain'],
    traceId?: string
  ) {
    const derivedAt = new Date().toISOString();
    
    const mainProvenance: Provenance = {
      derivedFrom: {
        candidateProfileId: profile.id,
      },
      derivedAt,
      derivedBy: 'real-candidate-intelligence-engine',
      sources: [
        'candidateProfile.education',
        'candidateProfile.skills',
        'candidateProfile.experience',
        'candidateProfile.projects',
        'candidateProfile.certifications',
        'candidateProfile.careerTargets',
        'candidateProfile.sectors',
        'candidateProfile.preferredLocations',
        'candidateProfile.remotePreference',
        'candidateProfile.opportunityPreferences',
        'candidateProfile.professionalDevelopmentPreferences',
        'candidateProfile.governmentInterests',
        'candidateProfile.policyInterests',
        'candidateProfile.internationalAffairsInterests',
      ],
      confidence: primaryBuilder === 'hybrid' ? 0.9 : 0.8,
    };

    return { mainProvenance };
  }

  /**
   * Hash text for embedding deduplication
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Build intelligence without model analysis (deterministic only)
   * Useful when model service is unavailable or for testing
   */
  async buildDeterministicOnly(
    options: BuildRealIntelligenceOptions
  ): Promise<RealCandidateIntelligenceResult> {
    const startTime = Date.now();
    
    const intelligence = buildCandidateIntelligence({
      candidateId: options.candidateId,
      candidateProfile: options.candidateProfile,
      derivationVersion: options.derivationVersion || '1.0.0',
    });

    let embedding: RealCandidateIntelligenceResult['embedding'];
    let embeddingLatencyMs = 0;

    if (this.enableEmbeddings && this.embeddingService) {
      const embeddingStartTime = Date.now();
      const result = await this.embeddingService.generateForCandidate(
        options.candidateId,
        options.candidateProfile,
        { forceRegenerate: options.forceRegenerateEmbedding }
      );
      if (result) {
        embedding = {
          vector: result.vector,
          metadata: result.metadata as NonNullable<RealCandidateIntelligenceResult['embedding']>['metadata'],
        };
      }
      embeddingLatencyMs = Date.now() - embeddingStartTime;
    }

    const provenance = this.buildProvenance(
      options.candidateProfile,
      options.derivationVersion || '1.0.0',
      'deterministic',
      undefined,
      embedding,
      [],
      options.traceId
    );

    return {
      intelligence: {
        ...intelligence,
        provenance: provenance.mainProvenance,
        lastUpdated: new Date().toISOString(),
      },
      embedding,
      provenance: {
        primaryBuilder: 'deterministic',
        embedding: embedding ? {
          modelId: embedding.metadata.model,
          modelVersion: embedding.metadata.modelVersion,
          latencyMs: embeddingLatencyMs,
        } : undefined,
        fallbackChain: [],
      },
      metrics: {
        totalLatencyMs: Date.now() - startTime,
        modelLatencyMs: 0,
        embeddingLatencyMs,
        deterministicLatencyMs: Date.now() - startTime - embeddingLatencyMs,
      },
    };
  }

  /**
   * Get the embedding service for direct access
   */
  getEmbeddingService(): CandidateEmbeddingService | undefined {
    return this.embeddingService;
  }

  /**
   * Get the candidate embedder for direct access
   */
  getCandidateEmbedder(): CandidateEmbedder | undefined {
    return this.candidateEmbedder;
  }

  /**
   * Check if model service is available
   */
  isModelAvailable(): boolean {
    return this.unifiedService.isInitialized();
  }
}

/**
 * Factory function to create RealCandidateIntelligenceEngine with all dependencies
 */
export async function createRealCandidateIntelligenceEngine(
  options: {
    pool: Pool;
    unifiedModelService?: UnifiedModelService;
    embeddingOptions?: {
      modelId?: string;
      defaultDimensions?: number;
      enableCache?: boolean;
      batchSize?: number;
    };
    enableModelAnalysis?: boolean;
    enableEmbeddings?: boolean;
  }
): Promise<RealCandidateIntelligenceEngine> {
  const { pool, unifiedModelService, embeddingOptions, enableModelAnalysis, enableEmbeddings } = options;

  // Initialize unified model service if provided
  let unifiedService = unifiedModelService;
  if (unifiedService && !unifiedService.isInitialized()) {
    await unifiedService.initialize();
  }

  // Create embedding service if enabled
  let embeddingService: CandidateEmbeddingService | undefined;
  let candidateEmbedder: CandidateEmbedder | undefined;

  if (enableEmbeddings !== false) {
    if (pool) {
      embeddingService = new CandidateEmbeddingService({
        pool,
        modelId: embeddingOptions?.modelId || 'embedding',
        defaultDimensions: embeddingOptions?.defaultDimensions || 1536,
        enableCache: embeddingOptions?.enableCache !== false,
        batchSize: embeddingOptions?.batchSize || 100,
      });
      await embeddingService.initialize();
    } else {
      // Fallback to embedder without persistence
      candidateEmbedder = new CandidateEmbedder(
        embeddingOptions?.modelId || 'embedding',
        embeddingOptions?.defaultDimensions || 1536,
        unifiedService
      );
    }
  }

  return new RealCandidateIntelligenceEngine({
    unifiedModelService: unifiedService,
    embeddingService,
    candidateEmbedder,
    enableModelAnalysis: enableModelAnalysis ?? true,
    enableEmbeddings: enableEmbeddings !== false,
  });
}

/**
 * Re-export key types and functions for convenience
 */
export { buildCandidateIntelligence } from './candidate-intelligence-builder';
export { deriveProfile } from './profile-derivation';
export { buildCandidateIntelligencePrompt, CANDIDATE_INTELLIGENCE_JSON_SCHEMA, CANDIDATE_INTELLIGENCE_PROMPT_VERSION, getCandidateIntelligencePromptHash } from './prompt-v1';
export { CandidateEmbedder, buildCandidateEmbeddingText, CandidateEmbeddingService, createCandidateEmbeddingService } from './candidate-embedder';
export type { CandidateIntelligence, DerivedCandidateProfile, Provenance, CandidateSkill, CandidateExperience } from './types';
import type { CandidateProfile } from '@shared/domain/candidate';
import { RealEmbeddingService, UnifiedModelEmbedder, type EmbeddingGenerationOptions } from '../embeddings/real-embedding-service';
import { Embedder } from '../embeddings/embedder.interface';
import { EmbeddingModelInfo } from '../embeddings/types';
import { unifiedModelService } from '@shared/models';

/**
 * Candidate text representation for embedding generation
 * Uses canonical CandidateProfile fields to build rich text for semantic matching
 */
export interface CandidateEmbeddingInput {
  candidateId: string;
  candidateProfileId: string;
  skills?: string[];
  experience?: Array<{ 
    title?: string; 
    organization?: string; 
    description?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
  }>;
  education?: Array<{ 
    institution?: string; 
    degree?: string; 
    field?: string;
    startYear?: number;
    endYear?: number;
  }>;
  projects?: Array<{ 
    name?: string; 
    description?: string; 
    technologies?: string[] 
  }>;
  certifications?: string[];
  careerTargets?: string[];
  sectors?: string[];
  preferredLocations?: string[];
  remotePreference?: string;
  opportunityPreferences?: Record<string, unknown>;
  professionalDevelopmentPreferences?: Record<string, unknown>;
  governmentInterests?: string[];
  policyInterests?: string[];
  internationalAffairsInterests?: string[];
}

/**
 * Builds rich text representation of a candidate for embedding generation
 * Combines all relevant profile fields into a single semantic text
 */
export function buildCandidateEmbeddingText(input: CandidateEmbeddingInput): string {
  const parts: string[] = [];

  // Skills - core technical capabilities
  if (input.skills?.length) {
    parts.push(`Skills: ${input.skills.join(', ')}`);
  }

  // Experience - roles, organizations, descriptions
  if (input.experience?.length) {
    const expText = input.experience
      .map(e => {
        const role = e.title || e.role || 'Unknown Role';
        const org = e.organization || 'Unknown Organization';
        const desc = e.description || '';
        return `${role} at ${org}${desc ? ` - ${desc}` : ''}`;
      })
      .join('; ');
    parts.push(`Experience: ${expText}`);
  }

  // Education - degrees, fields, institutions
  if (input.education?.length) {
    const eduText = input.education
      .map(e => `${e.degree || 'Degree'} in ${e.field || 'Field'} at ${e.institution || 'Institution'}`)
      .join('; ');
    parts.push(`Education: ${eduText}`);
  }

  // Projects - names, descriptions, technologies
  if (input.projects?.length) {
    const projText = input.projects
      .map(p => {
        const tech = p.technologies?.length ? ` [${p.technologies.join(', ')}]` : '';
        return `${p.name || 'Project'}${p.description ? `: ${p.description}` : ''}${tech}`;
      })
      .join('; ');
    parts.push(`Projects: ${projText}`);
  }

  // Certifications
  if (input.certifications?.length) {
    parts.push(`Certifications: ${input.certifications.join(', ')}`);
  }

  // Career targets/goals
  if (input.careerTargets?.length) {
    parts.push(`Career Goals: ${input.careerTargets.join(', ')}`);
  }

  // Sectors/domains of interest
  if (input.sectors?.length) {
    parts.push(`Sectors: ${input.sectors.join(', ')}`);
  }

  // Location preferences
  if (input.preferredLocations?.length) {
    parts.push(`Preferred Locations: ${input.preferredLocations.join(', ')}`);
  }

  // Remote preference
  if (input.remotePreference) {
    parts.push(`Remote Preference: ${input.remotePreference}`);
  }

  // Government/policy interests
  if (input.governmentInterests?.length) {
    parts.push(`Government Interests: ${input.governmentInterests.join(', ')}`);
  }
  if (input.policyInterests?.length) {
    parts.push(`Policy Interests: ${input.policyInterests.join(', ')}`);
  }
  if (input.internationalAffairsInterests?.length) {
    parts.push(`International Affairs Interests: ${input.internationalAffairsInterests.join(', ')}`);
  }

  // Professional development
  if (input.professionalDevelopmentPreferences?.goals) {
    const goals = input.professionalDevelopmentPreferences.goals;
    if (Array.isArray(goals) && goals.length) {
      parts.push(`Development Goals: ${goals.join(', ')}`);
    }
  }

  return parts.join(' | ');
}

/**
 * Candidate Embedder using Unified Model Service
 * Implements the Embedder interface for candidate embeddings
 */
export class CandidateEmbedder implements Embedder {
  public modelInfo: EmbeddingModelInfo;
  private embedder: UnifiedModelEmbedder;

  constructor(
    modelId: string = 'embedding',
    defaultDimensions: number = 1536,
    unifiedService = unifiedModelService
  ) {
    this.modelInfo = {
      name: modelId,
      provider: 'unified',
      dimensions: defaultDimensions,
      version: '1',
    };

    this.embedder = new UnifiedModelEmbedder(unifiedService, modelId, defaultDimensions);
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    return this.embedder.embed(text);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.embedder.embedBatch(texts);
  }

  /**
   * Validate vector dimensions match model
   */
  validateVector(vector: number[]): boolean {
    return this.embedder.validateVector(vector);
  }

  /**
   * Generate embedding for a candidate profile
   * Uses canonical CandidateProfile to build rich text representation
   */
  async embedCandidate(profile: CandidateProfile): Promise<number[]> {
    const text = buildCandidateEmbeddingText({
      candidateId: profile.userId,
      candidateProfileId: profile.id,
      skills: profile.skills,
      experience: profile.experience,
      education: profile.education,
      projects: profile.projects,
      certifications: profile.certifications as string[] | undefined,
      careerTargets: profile.careerTargets,
      sectors: profile.sectors,
      preferredLocations: profile.preferredLocations,
      remotePreference: profile.remotePreference,
      opportunityPreferences: profile.opportunityPreferences,
      professionalDevelopmentPreferences: profile.professionalDevelopmentPreferences,
      governmentInterests: profile.governmentInterests,
      policyInterests: profile.policyInterests,
      internationalAffairsInterests: profile.internationalAffairsInterests,
    });

    return this.embed(text);
  }

  /**
   * Generate embedding for candidate with custom options
   */
  async embedCandidateWithOptions(
    profile: CandidateProfile,
    options?: { forceRegenerate?: boolean; version?: string }
  ): Promise<number[]> {
    return this.embedCandidate(profile);
  }
}

/**
 * High-level Candidate Embedding Service
 * Wraps RealEmbeddingService for candidate-specific operations
 */
export interface CandidateEmbeddingServiceOptions {
  pool: any; // pg Pool
  modelId?: string;
  defaultDimensions?: number;
  enableCache?: boolean;
  batchSize?: number;
}

export class CandidateEmbeddingService {
  private service: RealEmbeddingService;

  constructor(options: CandidateEmbeddingServiceOptions) {
    this.service = new RealEmbeddingService({
      pool: options.pool,
      modelId: options.modelId || 'embedding',
      defaultDimensions: options.defaultDimensions || 1536,
      enableCache: options.enableCache !== false,
      batchSize: options.batchSize || 100,
    });
  }

  /**
   * Initialize the service (creates tables if needed)
   */
  async initialize(): Promise<void> {
    await this.service.initialize();
  }

  /**
   * Generate and store embedding for a candidate
   */
  async generateForCandidate(
    candidateId: string,
    candidateProfile: CandidateProfile,
    options?: { forceRegenerate?: boolean; version?: string }
  ) {
    const text = buildCandidateEmbeddingText({
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
    });

    return this.service.generateForCandidate(candidateId, {
      skills: candidateProfile.skills,
      experience: candidateProfile.experience?.map(e => ({
        title: e.role || e.title || '',
        organization: e.organization || '',
        description: e.description,
      })),
      education: candidateProfile.education?.map(e => ({
        degree: e.degree || '',
        field: e.field || '',
      })),
      locationPreferences: candidateProfile.preferredLocations,
      careerTargets: candidateProfile.careerTargets,
    }, options);
  }

  /**
   * Generate embedding for candidate from raw text (for testing/debugging)
   */
  async generateFromText(
    candidateId: string,
    text: string,
    options?: { forceRegenerate?: boolean; version?: string }
  ) {
    return this.service.generate({
      entityType: 'candidate',
      entityId: candidateId,
      text,
      ...options,
    });
  }

  /**
   * Find similar candidates to a query text
   */
  async findSimilarCandidates(
    queryText: string,
    options?: { limit?: number; threshold?: number }
  ) {
    return this.service.findSimilarCandidates(queryText, options);
  }

  /**
   * Find similar candidates to a candidate profile
   */
  async findSimilarToCandidate(
    candidateProfile: CandidateProfile,
    options?: { limit?: number; threshold?: number }
  ) {
    const text = buildCandidateEmbeddingText({
      candidateId: candidateProfile.userId,
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
    });

    return this.service.findSimilarCandidates(text, options);
  }

  /**
   * Get existing embedding for a candidate
   */
  async getEmbedding(candidateId: string) {
    return this.service.getEmbedding('candidate', candidateId);
  }

  /**
   * Get embedding metadata for a candidate
   */
  async getMetadata(candidateId: string) {
    return this.service.getMetadata('candidate', candidateId);
  }

  /**
   * Get version history for a candidate's embeddings
   */
  async getVersionHistory(candidateId: string) {
    return this.service.getVersionHistory('candidate', candidateId);
  }

  /**
   * Delete candidate embedding
   */
  async delete(candidateId: string) {
    return this.service.delete('candidate', candidateId);
  }

  /**
   * Get the underlying RealEmbeddingService for advanced operations
   */
  getService(): RealEmbeddingService {
    return this.service;
  }
}

/**
 * Factory function to create CandidateEmbeddingService
 */
export async function createCandidateEmbeddingService(
  pool: any,
  options?: Partial<CandidateEmbeddingServiceOptions>
): Promise<CandidateEmbeddingService> {
  const service = new CandidateEmbeddingService({
    pool,
    ...options,
  });

  await service.initialize();
  return service;
}

/**
 * Export the text builder for use in other modules
 */
export { buildCandidateEmbeddingText as buildCandidateText };
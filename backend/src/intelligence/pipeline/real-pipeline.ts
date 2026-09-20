import { UnifiedModelService } from 'shared/models/unified-service';
import { createExtractionEngine } from '../extraction';
import { createRealEngine as createRealClassificationEngine } from '../classification';
import { RealRequirementExtractor } from '../requirements';
import { createRealCandidateIntelligenceEngine } from '../candidate';
import { createRealEmbeddingService } from '../embeddings/real-embedding-service';
import { realMatchingEngine } from '../matching';
import { realExplanationEngine } from '../explanation';
import { EligibilityEngine } from '../eligibility';
import { DeterministicScoringEngine } from '../scoring';
import { RankingEngine } from '../ranking';
import { ValueAssessmentEngine } from '../value';
import { TimingIntelligenceEngine } from '../timing';
import { PgEmbeddingRepository } from '../../persistence/pg-embedding-repository';

export interface IntelligencePipelineInput {
  rawDocument: any;
  candidateProfile: any;
  opportunityId?: string;
  candidateId?: string;
}

export interface IntelligencePipelineOutput {
  extraction: any;
  classification: any;
  requirements: any;
  eligibility: any;
  candidateIntelligence: any;
  embeddings: { opportunity: any; candidate: any };
  semanticMatch: any;
  scoring: any;
  value: any;
  timing: any;
  ranking: any;
  explanation: any;
  provenance: any;
}

export class IntelligencePipeline {
  private modelService: UnifiedModelService;
  private extractionEngine: any;
  private classificationEngine: any;
  private requirementExtractor: RealRequirementExtractor;
  private candidateIntelligenceEngine: any;
  private embeddingService: any;
  private eligibilityEngine: EligibilityEngine;
  private scoringEngine: DeterministicScoringEngine;
  private rankingEngine: RankingEngine;
  private valueEngine: ValueAssessmentEngine;
  private timingEngine: TimingIntelligenceEngine;
  private embeddingRepo: PgEmbeddingRepository;
  private initialized = false;

  constructor(modelService: UnifiedModelService) {
    this.modelService = modelService;
    this.extractionEngine = createExtractionEngine(modelService);
    this.classificationEngine = createRealClassificationEngine();
    this.requirementExtractor = new RealRequirementExtractor({ unifiedModelService: modelService });
    this.eligibilityEngine = new EligibilityEngine();
    this.scoringEngine = new DeterministicScoringEngine();
    this.rankingEngine = new RankingEngine();
    this.valueEngine = new ValueAssessmentEngine();
    this.timingEngine = new TimingIntelligenceEngine();
    this.embeddingRepo = new PgEmbeddingRepository();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.candidateIntelligenceEngine = await createRealCandidateIntelligenceEngine({
      pool: { query: async () => ({ rows: [] }), end: async () => {} } as any,
      unifiedModelService: this.modelService
    });

    // Initialize embedding service with mock pool for now
    // In production, this would be a real pg pool
    this.embeddingService = await createRealEmbeddingService({
      query: async () => ({ rows: [] }),
      end: async () => {}
    } as any);

    await this.modelService.initialize();
    this.initialized = true;
  }

  async run(input: IntelligencePipelineInput): Promise<IntelligencePipelineOutput> {
    if (!this.initialized) await this.initialize();

    const { rawDocument, candidateProfile, opportunityId, candidateId } = input;

    // 1. Extraction
    const extraction = await this.extractionEngine.extract(rawDocument, { contentType: 'text/plain' });

    // 2. Normalization (placeholder - would normalize extraction output)
    const normalizedOpportunity = this.normalizeExtraction(extraction, rawDocument);

    // 3. Classification
    const classification = await this.classificationEngine.classifyOpportunity(normalizedOpportunity);

    // 4. Requirements
    const requirements = await this.requirementExtractor.extract(
      normalizedOpportunity.description || '',
      normalizedOpportunity
    );

    // 5. Eligibility
    const eligibility = this.eligibilityEngine.assess(normalizedOpportunity, candidateProfile);

    // 6. Candidate Intelligence
    const candidateIntelligence = await this.candidateIntelligenceEngine.buildCandidateIntelligence({
      candidateId: candidateId || 'unknown',
      candidateProfile
    });

    // 7. Embeddings
    const [opportunityEmbedding, candidateEmbedding] = await Promise.all([
      this.embeddingService.generateForOpportunity(opportunityId || 'temp', normalizedOpportunity),
      this.candidateIntelligenceEngine.embeddingService?.generateForCandidate(candidateId || 'temp', candidateIntelligence.derivedProfile)
    ]);

    // Persist embeddings
    if (opportunityEmbedding?.vector) {
      await this.embeddingRepo.upsert('opportunity', opportunityId || 'temp', opportunityEmbedding.vector);
    }
    if (candidateEmbedding?.vector) {
      await this.embeddingRepo.upsert('candidate', candidateId || 'temp', candidateEmbedding.vector);
    }

    // 8. Semantic Matching
    const semanticMatch = await realMatchingEngine.computeMatch({
      id: candidateId || 'temp',
      skills: candidateIntelligence.derivedProfile?.technicalSkills?.map((s: any) => s.name) || [],
      currentTitle: candidateIntelligence.derivedProfile?.careerGoals?.[0] || '',
      technologies: candidateIntelligence.derivedProfile?.technologies || [],
      domain: candidateIntelligence.derivedProfile?.domains?.[0] || '',
      yearsOfExperience: candidateIntelligence.derivedProfile?.experience?.length || 0
    }, {
      id: opportunityId || 'temp',
      requiredSkills: requirements.requirements?.filter((r: any) => r.relationship === 'REQUIRED').map((r: any) => r.requirement) || [],
      domain: classification.primaryCategory,
      title: normalizedOpportunity.title || '',
      requiredExperienceYears: 5
    });

    // 9. Scoring
    const factorScores = {
      careerAlignment: { rawScore: semanticMatch.careerSimilarity.score, confidence: semanticMatch.careerSimilarity.confidence, evidence: semanticMatch.careerSimilarity.evidence },
      skillAlignment: { rawScore: semanticMatch.skillSimilarity.score, confidence: semanticMatch.skillSimilarity.confidence, evidence: semanticMatch.skillSimilarity.evidence },
      eligibility: { rawScore: eligibility.overall === 'ELIGIBLE' ? 1 : eligibility.overall === 'UNCERTAIN' ? 0.5 : 0, confidence: 0.9, evidence: [] },
      experienceFit: { rawScore: semanticMatch.experienceSimilarity.score, confidence: semanticMatch.experienceSimilarity.confidence, evidence: semanticMatch.experienceSimilarity.evidence },
      educationFit: { rawScore: 0.5, confidence: 0.6, evidence: [] },
      opportunityValue: { rawScore: 0.7, confidence: 0.6, evidence: [] },
      locationRemoteFit: { rawScore: 0.8, confidence: 0.7, evidence: [] },
      timingDeadline: { rawScore: 0.8, confidence: 0.7, evidence: [] }
    };

    const scoring = this.scoringEngine.score({
      opportunityId: opportunityId || 'temp',
      candidateId: candidateId || 'temp',
      factorScores,
      hardEligibility: eligibility.overall === 'ELIGIBLE' ? 1 : eligibility.overall === 'UNCERTAIN' ? 0.5 : 0
    });

    // 10. Value Assessment
    const value = await this.valueEngine.assess({
      id: opportunityId || 'temp',
      title: normalizedOpportunity.title,
      description: normalizedOpportunity.description,
      skills: normalizedOpportunity.skills || [],
      location: normalizedOpportunity.location,
      remote: normalizedOpportunity.remoteStatus,
      compensation: normalizedOpportunity.compensation || undefined
    }, candidateIntelligence.derivedProfile);

    // 11. Timing
    const timing = this.timingEngine.assess(normalizedOpportunity);

    // 12. Ranking
    const ranking = this.rankingEngine.rank([scoring], { filterEligibleOnly: eligibility.overall === 'ELIGIBLE' });

    // 13. Explanation
    const explanation = await realExplanationEngine.generate({
      opportunity: normalizedOpportunity,
      candidate: candidateIntelligence.derivedProfile,
      eligibility: { status: eligibility.overall, decisions: eligibility.decisions },
      matchFactors: {
        careerAlignment: semanticMatch.careerSimilarity.score,
        skillAlignment: semanticMatch.skillSimilarity.score,
        eligibility: eligibility.overall === 'ELIGIBLE' ? 1 : eligibility.overall === 'UNCERTAIN' ? 0.5 : 0,
        experienceFit: semanticMatch.experienceSimilarity.score,
        educationFit: 0.5,
        opportunityValue: value.composite.valueScore,
        locationFit: 0.8,
        timing: 0.8
      },
      score: scoring.finalScore,
      value: { compositeScore: value.composite.valueScore, factors: value.factors },
      timing: { actionability: timing.actionability, deadlineDistanceDays: timing.deadlineDistanceDays }
    });

    return {
      extraction,
      classification,
      requirements,
      eligibility,
      candidateIntelligence,
      embeddings: { opportunity: opportunityEmbedding, candidate: candidateEmbedding },
      semanticMatch,
      scoring,
      value,
      timing,
      ranking,
      explanation,
      provenance: {
        pipelineVersion: '1.0',
        modelVersions: this.getModelVersions(),
        timestamp: new Date().toISOString()
      }
    };
  }

  private normalizeExtraction(extraction: any, rawDocument: any): any {
    const fields = extraction.fields || {};
    return {
      id: rawDocument.externalId || 'temp',
      title: fields.title || 'Unknown',
      organization: fields.organization || 'Unknown',
      description: fields.description || '',
      url: fields.url || '',
      location: fields.location || '',
      remoteStatus: fields.remote || false,
      opportunityType: fields.opportunityType || 'WORK',
      skills: fields.skills || [],
      requirements: fields.requirements || [],
      education: fields.education || [],
      experience: fields.experience || [],
      compensation: fields.compensation || {},
      deadline: fields.deadline || null,
      publicationDate: fields.publicationDate || new Date().toISOString()
    };
  }

  private getModelVersions(): Record<string, string> {
    return {
      extraction: 'v1',
      classification: 'v1',
      requirements: 'v1',
      embedding: 'v1',
      reasoning: 'v1'
    };
  }

  async shutdown(): Promise<void> {
    await this.modelService.shutdown();
  }
}

export function createIntelligencePipeline(modelService?: UnifiedModelService): IntelligencePipeline {
  const service = modelService || new UnifiedModelService();
  return new IntelligencePipeline(service);
}
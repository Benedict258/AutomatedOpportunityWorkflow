import { UnifiedModelService } from '../../models/unified-service';
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
  private initialized = false;

  constructor(modelService: UnifiedModelService) {
    this.modelService = modelService;
    this.extractionEngine = createExtractionEngine(modelService);
    this.classificationEngine = createRealClassificationEngine(modelService);
    this.requirementExtractor = new RealRequirementExtractor(modelService);
    this.candidateIntelligenceEngine = createRealCandidateIntelligenceEngine(modelService);
    this.eligibilityEngine = new EligibilityEngine();
    this.scoringEngine = new DeterministicScoringEngine();
    this.rankingEngine = new RankingEngine();
    this.valueEngine = new ValueAssessmentEngine();
    this.timingEngine = new TimingIntelligenceEngine();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

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

    // 8. Semantic Matching
    const semanticMatch = await realMatchingEngine.computeMatch({
      id: candidateId || 'temp',
      embedding: candidateEmbedding?.vector || [],
      skills: candidateIntelligence.derivedProfile?.technicalSkills || [],
      careerGoals: candidateIntelligence.derivedProfile?.careerGoals || [],
      experience: candidateIntelligence.derivedProfile?.experience || [],
      domains: candidateIntelligence.derivedProfile?.domains || []
    }, {
      id: opportunityId || 'temp',
      embedding: opportunityEmbedding?.vector || [],
      skills: requirements.requirements?.filter((r: any) => r.relationship === 'REQUIRED').map((r: any) => r.requirement) || [],
      domain: classification.primaryCategory,
      experienceRequired: 5
    });

    // 9. Scoring
    const factorScores = {
      careerAlignment: { rawScore: semanticMatch.factors.careerSimilarity, confidence: 0.8, evidence: [] },
      skillAlignment: { rawScore: semanticMatch.factors.skillSimilarity, confidence: 0.8, evidence: [] },
      eligibility: { rawScore: eligibility.overall === 'ELIGIBLE' ? 1 : eligibility.overall === 'UNCERTAIN' ? 0.5 : 0, confidence: 0.9, evidence: [] },
      experienceFit: { rawScore: semanticMatch.factors.experienceSimilarity, confidence: 0.7, evidence: [] },
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
    const value = this.valueEngine.assess({
      careerRelevance: semanticMatch.factors.careerSimilarity,
      experienceBuildingValue: semanticMatch.factors.experienceSimilarity,
      skillDevelopment: semanticMatch.factors.skillSimilarity,
      credentialValue: 0.5,
      networkingPotential: 0.5,
      organizationRelevance: 0.6,
      compensation: 0.7,
      accessibility: 0.8,
      deadlineUrgency: 0.6,
      effortApplicationComplexity: 0.5
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
        careerAlignment: semanticMatch.factors.careerSimilarity,
        skillAlignment: semanticMatch.factors.skillSimilarity,
        eligibility: eligibility.overall === 'ELIGIBLE' ? 1 : eligibility.overall === 'UNCERTAIN' ? 0.5 : 0,
        experienceFit: semanticMatch.factors.experienceSimilarity,
        educationFit: 0.5,
        opportunityValue: value.compositeScore,
        locationFit: 0.8,
        timing: 0.8
      },
      score: scoring.finalScore,
      value: { compositeScore: value.compositeScore, factors: value.factors },
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
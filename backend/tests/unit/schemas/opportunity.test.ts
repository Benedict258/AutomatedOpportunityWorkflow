import { describe, it, expect } from 'vitest';
import {
  opportunityStatusSchema,
  deadlineTypeSchema,
  opportunitySchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  opportunityFiltersSchema,
  opportunityVersionSchema,
  opportunityClassificationSchema,
  eligibilityRequirementSchema,
  eligibilityAssessmentSchema,
  matchFactorSchema,
  matchScoreSchema,
  rankingResultSchema,
  explanationSchema,
  opportunityIntelligenceSchema,
} from '@/schemas/opportunity.js';

describe('Opportunity Schemas', () => {
  describe('opportunityStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['ACTIVE', 'CLOSED', 'EXPIRED', 'DRAFT', 'ARCHIVED'];
      validStatuses.forEach(status => {
        expect(opportunityStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => opportunityStatusSchema.parse('INVALID')).toThrow();
    });
  });

  describe('deadlineTypeSchema', () => {
    it('should accept valid deadline types', () => {
      const validTypes = ['FIXED', 'ROLLING', 'ONGOING', 'UNKNOWN'];
      validTypes.forEach(type => {
        expect(deadlineTypeSchema.parse(type)).toBe(type);
      });
    });

    it('should reject invalid deadline type', () => {
      expect(() => deadlineTypeSchema.parse('INVALID')).toThrow();
    });
  });

  describe('opportunitySchema', () => {
    it('should accept valid opportunity', () => {
      const now = new Date().toISOString();
      const validOpportunity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        stableId: '123e4567-e89b-12d3-a456-426614174001',
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        externalId: 'ext-123',
        title: 'Test Opportunity',
        organization: 'Test Org',
        description: 'Description',
        url: 'https://example.com/opp',
        location: 'Remote',
        remoteInfo: { timezone: 'UTC' },
        opportunityType: 'FELLOWSHIP',
        categoryIds: ['123e4567-e89b-12d3-a456-426614174003'],
        status: 'ACTIVE',
        publicationDate: now,
        applicationDeadline: now,
        deadlineType: 'FIXED',
        firstSeenAt: now,
        lastSeenAt: now,
        lastVerifiedAt: now,
        closedAt: undefined,
        lifecycleStage: 'DISCOVERED',
        createdAt: now,
        updatedAt: now,
      };
      const result = opportunitySchema.parse(validOpportunity);
      expect(result.title).toBe('Test Opportunity');
    });

    it('should reject title over 500 chars', () => {
      const now = new Date().toISOString();
      expect(() => opportunitySchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        stableId: '123e4567-e89b-12d3-a456-426614174001',
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'x'.repeat(501),
        status: 'ACTIVE',
        deadlineType: 'FIXED',
        firstSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })).toThrow();
    });

    it('should reject invalid URL', () => {
      const now = new Date().toISOString();
      expect(() => opportunitySchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        stableId: '123e4567-e89b-12d3-a456-426614174001',
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Test',
        url: 'not-a-url',
        status: 'ACTIVE',
        deadlineType: 'FIXED',
        firstSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })).toThrow();
    });
  });

  describe('createOpportunitySchema', () => {
    it('should accept valid create request', () => {
      const result = createOpportunitySchema.parse({
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        externalId: 'ext-123',
        title: 'New Opportunity',
        organization: 'Org',
        description: 'Desc',
        url: 'https://example.com',
        location: 'Remote',
        opportunityType: 'FELLOWSHIP',
        categoryIds: ['123e4567-e89b-12d3-a456-426614174003'],
        status: 'ACTIVE',
        publicationDate: new Date().toISOString(),
        applicationDeadline: new Date().toISOString(),
        deadlineType: 'FIXED',
        lifecycleStage: 'DISCOVERED',
      });
      expect(result.title).toBe('New Opportunity');
    });

    it('should apply default status', () => {
      const result = createOpportunitySchema.parse({
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Test',
      });
      expect(result.status).toBe('ACTIVE');
    });

    it('should apply default deadlineType', () => {
      const result = createOpportunitySchema.parse({
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Test',
      });
      expect(result.deadlineType).toBe('UNKNOWN');
    });

    it('should reject empty title', () => {
      expect(() => createOpportunitySchema.parse({
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        title: '',
      })).toThrow();
    });

    it('should reject title over 500 chars', () => {
      expect(() => createOpportunitySchema.parse({
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'x'.repeat(501),
      })).toThrow();
    });
  });

  describe('updateOpportunitySchema', () => {
    it('should accept partial update', () => {
      const result = updateOpportunitySchema.parse({
        title: 'Updated Title',
        status: 'CLOSED',
      });
      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('CLOSED');
    });

    it('should accept empty update', () => {
      const result = updateOpportunitySchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('opportunityFiltersSchema', () => {
    it('should accept valid filters', () => {
      const result = opportunityFiltersSchema.parse({
        category: '123e4567-e89b-12d3-a456-426614174003',
        status: 'ACTIVE',
        sourceId: '123e4567-e89b-12d3-a456-426614174002',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z',
        search: 'fellowship',
        hasDeadline: true,
        page: 2,
        limit: 50,
        sortBy: 'title',
        sortOrder: 'asc',
      });
      expect(result.category).toBe('123e4567-e89b-12d3-a456-426614174003');
      expect(result.hasDeadline).toBe(true);
    });

    it('should coerce hasDeadline boolean', () => {
      const result = opportunityFiltersSchema.parse({
        hasDeadline: 'true',
      });
      expect(result.hasDeadline).toBe(true);
    });
  });

  describe('opportunityVersionSchema', () => {
    it('should accept valid version', () => {
      const now = new Date().toISOString();
      const result = opportunityVersionSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
        versionNumber: 2,
        capturedAt: now,
        title: 'Version 2',
        description: 'Updated',
        applicationDeadline: now,
        deadlineType: 'FIXED',
        location: 'Remote',
        url: 'https://example.com',
        status: 'ACTIVE',
        changeMetadata: { changedBy: 'user-123' },
        createdAt: now,
      });
      expect(result.versionNumber).toBe(2);
    });
  });

  describe('opportunityClassificationSchema', () => {
    it('should accept valid classification', () => {
      const result = opportunityClassificationSchema.parse({
        primaryCategory: 'TECHNOLOGY',
        secondaryCategories: ['AI', 'ML'],
        confidence: 0.95,
        taxonomyPath: ['TECHNOLOGY', 'AI'],
      });
      expect(result.confidence).toBe(0.95);
    });

    it('should reject confidence out of range', () => {
      expect(() => opportunityClassificationSchema.parse({
        primaryCategory: 'TECHNOLOGY',
        confidence: 1.5,
      })).toThrow();
      expect(() => opportunityClassificationSchema.parse({
        primaryCategory: 'TECHNOLOGY',
        confidence: -0.1,
      })).toThrow();
    });
  });

  describe('matchFactorSchema', () => {
    it('should accept valid match factor', () => {
      const result = matchFactorSchema.parse({
        name: 'skills',
        weight: 0.4,
        score: 0.9,
        evidence: 'Strong match',
      });
      expect(result.weight).toBe(0.4);
      expect(result.score).toBe(0.9);
    });

    it('should reject weight out of range', () => {
      expect(() => matchFactorSchema.parse({
        name: 'skills',
        weight: 1.5,
        score: 0.5,
      })).toThrow();
    });

    it('should reject score out of range', () => {
      expect(() => matchFactorSchema.parse({
        name: 'skills',
        weight: 0.5,
        score: -0.1,
      })).toThrow();
    });
  });

  describe('matchScoreSchema', () => {
    it('should accept valid match score', () => {
      const result = matchScoreSchema.parse({
        overall: 0.85,
        factors: [
          { name: 'skills', weight: 0.4, score: 0.9, evidence: 'Strong' },
          { name: 'experience', weight: 0.6, score: 0.8, evidence: 'Good' },
        ],
        confidence: 0.9,
      });
      expect(result.overall).toBe(0.85);
      expect(result.factors).toHaveLength(2);
    });
  });

  describe('rankingResultSchema', () => {
    it('should accept valid ranking', () => {
      const result = rankingResultSchema.parse({
        rank: 1,
        score: 0.95,
        percentile: 99,
      });
      expect(result.rank).toBe(1);
      expect(result.percentile).toBe(99);
    });

    it('should reject negative rank', () => {
      expect(() => rankingResultSchema.parse({
        rank: 0,
        score: 0.5,
      })).toThrow();
    });
  });

  describe('explanationSchema', () => {
    it('should accept valid explanation', () => {
      const result = explanationSchema.parse({
        summary: 'Great match',
        strengths: ['Skills', 'Experience'],
        gaps: ['Certification'],
        recommendations: ['Apply now'],
        detail: { key: 'value' },
      });
      expect(result.strengths).toHaveLength(2);
    });
  });

  describe('opportunityIntelligenceSchema', () => {
    it('should accept valid intelligence', () => {
      const now = new Date().toISOString();
      const result = opportunityIntelligenceSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174000',
        classification: {
          primaryCategory: 'TECHNOLOGY',
          confidence: 0.9,
        },
        requirements: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            name: 'PhD',
            requirementType: 'EDUCATION',
            value: 'PhD',
            isRequired: true,
            sourceEvidence: 'Job description',
          },
        ],
        eligibility: {
          opportunityId: '123e4567-e89b-12d3-a456-426614174000',
          candidateId: '123e4567-e89b-12d3-a456-426614174002',
          requirements: [
            { requirementId: '123e4567-e89b-12d3-a456-426614174001', state: 'MET' },
          ],
          overallEligible: true,
          assessedAt: now,
        },
        match: {
          candidateId: '123e4567-e89b-12d3-a456-426614174002',
          score: {
            overall: 0.85,
            factors: [{ name: 'skills', weight: 0.5, score: 0.9 }],
            confidence: 0.9,
          },
          ranking: { rank: 1, score: 0.85, percentile: 95 },
        },
        explanation: {
          summary: 'Excellent match',
          strengths: ['PhD', 'Experience'],
          gaps: [],
          recommendations: ['Apply'],
        },
        scoredAt: now,
        version: 1,
      });
      expect(result.version).toBe(1);
    });
  });
});

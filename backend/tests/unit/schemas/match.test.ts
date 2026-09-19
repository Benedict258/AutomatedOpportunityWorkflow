import { describe, it, expect } from 'vitest';
import {
  matchStatusSchema,
  matchSchema,
  matchFiltersSchema,
  createMatchRequestSchema,
} from '@/schemas/match.js';

describe('Match Schemas', () => {
  describe('matchStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['PENDING', 'COMPUTED', 'NOTIFIED', 'APPLIED', 'REJECTED', 'EXPIRED'];
      validStatuses.forEach(status => {
        expect(matchStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => matchStatusSchema.parse('INVALID')).toThrow();
    });
  });

  describe('matchSchema', () => {
    it('should accept valid match', () => {
      const now = new Date().toISOString();
      const result = matchSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityId: '123e4567-e89b-12d3-a456-426614174002',
        score: {
          overall: 0.85,
          factors: [
            { name: 'skills', weight: 0.4, score: 0.9, evidence: 'Strong match' },
            { name: 'experience', weight: 0.3, score: 0.8, evidence: 'Good experience' },
            { name: 'location', weight: 0.3, score: 0.85, evidence: 'Remote' },
          ],
          confidence: 0.9,
        },
        ranking: {
          rank: 1,
          score: 0.85,
          percentile: 95,
        },
        explanation: {
          summary: 'Excellent match',
          strengths: ['Skills', 'Experience'],
          gaps: ['Certification'],
          recommendations: ['Apply early'],
          detail: { key: 'value' },
        },
        status: 'COMPUTED',
        computedAt: now,
        notifiedAt: undefined,
        createdAt: now,
        updatedAt: now,
      });
      expect(result.status).toBe('COMPUTED');
      expect(result.score.overall).toBe(0.85);
    });

    it('should apply default status', () => {
      const now = new Date().toISOString();
      const result = matchSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityId: '123e4567-e89b-12d3-a456-426614174002',
        score: {
          overall: 0.5,
          factors: [],
          confidence: 0.5,
        },
        explanation: {
          summary: 'Average',
          strengths: [],
          gaps: [],
          recommendations: [],
        },
        computedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      expect(result.status).toBe('COMPUTED');
    });

    it('should reject score overall out of range', () => {
      const now = new Date().toISOString();
      expect(() => matchSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityId: '123e4567-e89b-12d3-a456-426614174002',
        score: {
          overall: 1.5,
          factors: [],
          confidence: 0.5,
        },
        explanation: { summary: '', strengths: [], gaps: [], recommendations: [] },
        computedAt: now,
        createdAt: now,
        updatedAt: now,
      })).toThrow();
    });

    it('should reject negative rank', () => {
      const now = new Date().toISOString();
      expect(() => matchSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityId: '123e4567-e89b-12d3-a456-426614174002',
        score: { overall: 0.5, factors: [], confidence: 0.5 },
        explanation: { summary: '', strengths: [], gaps: [], recommendations: [] },
        ranking: { rank: 0, score: 0.5 },
        computedAt: now,
        createdAt: now,
        updatedAt: now,
      })).toThrow();
    });
  });

  describe('matchFiltersSchema', () => {
    it('should accept valid filters', () => {
      const result = matchFiltersSchema.parse({
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityId: '123e4567-e89b-12d3-a456-426614174002',
        status: 'COMPUTED',
        minScore: 0.7,
        maxScore: 1.0,
        computedAfter: '2024-01-01T00:00:00Z',
        computedBefore: '2024-12-31T23:59:59Z',
        page: 2,
        limit: 50,
        sortBy: 'computed_at',
        sortOrder: 'desc',
      });
      expect(result.minScore).toBe(0.7);
      expect(result.maxScore).toBe(1.0);
    });

    it('should coerce minScore and maxScore', () => {
      const result = matchFiltersSchema.parse({
        minScore: '0.5',
        maxScore: '0.9',
      });
      expect(result.minScore).toBe(0.5);
      expect(result.maxScore).toBe(0.9);
    });

    it('should reject minScore out of range', () => {
      expect(() => matchFiltersSchema.parse({ minScore: -0.1 })).toThrow();
      expect(() => matchFiltersSchema.parse({ minScore: 1.1 })).toThrow();
    });

    it('should reject maxScore out of range', () => {
      expect(() => matchFiltersSchema.parse({ maxScore: -0.1 })).toThrow();
      expect(() => matchFiltersSchema.parse({ maxScore: 1.1 })).toThrow();
    });
  });

  describe('createMatchRequestSchema', () => {
    it('should accept valid create request', () => {
      const result = createMatchRequestSchema.parse({
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityIds: [
          '123e4567-e89b-12d3-a456-426614174002',
          '123e4567-e89b-12d3-a456-426614174003',
        ],
      });
      expect(result.opportunityIds).toHaveLength(2);
    });

    it('should reject empty opportunityIds', () => {
      expect(() => createMatchRequestSchema.parse({
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityIds: [],
      })).toThrow();
    });

    it('should reject more than 100 opportunityIds', () => {
      const ids = Array(101).fill('123e4567-e89b-12d3-a456-426614174000');
      expect(() => createMatchRequestSchema.parse({
        candidateId: '123e4567-e89b-12d3-a456-426614174001',
        opportunityIds: ids,
      })).toThrow();
    });
  });
});

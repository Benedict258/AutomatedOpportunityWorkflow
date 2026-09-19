import { describe, it, expect } from 'vitest';
import {
  verificationStatusSchema,
  verificationRunSchema,
  createVerificationRunSchema,
  verificationFiltersSchema,
  reprocessingStatusSchema,
  reprocessingRunSchema,
  createReprocessingRunSchema,
  reprocessingFiltersSchema,
} from '@/schemas/verification.js';

describe('Verification & Reprocessing Schemas', () => {
  describe('verificationStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLED'];
      validStatuses.forEach(status => {
        expect(verificationStatusSchema.parse(status)).toBe(status);
      });
    });
  });

  describe('verificationRunSchema', () => {
    it('should accept valid run', () => {
      const now = new Date().toISOString();
      const result = verificationRunSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
        status: 'RUNNING',
        startedAt: now,
        completedAt: undefined,
        results: undefined,
        error: undefined,
        triggeredBy: 'scheduler',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
      expect(result.status).toBe('RUNNING');
      expect(result.opportunityIds).toHaveLength(2);
    });
  });

  describe('createVerificationRunSchema', () => {
    it('should accept valid create request', () => {
      const result = createVerificationRunSchema.parse({
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
        triggeredBy: 'manual',
        metadata: { reason: 'data-update' },
      });
      expect(result.opportunityIds).toHaveLength(1);
    });

    it('should require at least one opportunityId', () => {
      expect(() => createVerificationRunSchema.parse({ opportunityIds: [] })).toThrow();
    });

    it('should reject more than 1000 opportunityIds', () => {
      const ids = Array(1001).fill('123e4567-e89b-12d3-a456-426614174000');
      expect(() => createVerificationRunSchema.parse({ opportunityIds: ids })).toThrow();
    });
  });

  describe('verificationFiltersSchema', () => {
    it('should accept valid filters', () => {
      const result = verificationFiltersSchema.parse({
        status: 'SUCCEEDED',
        triggeredBy: 'scheduler',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z',
        page: 2,
        limit: 50,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      expect(result.status).toBe('SUCCEEDED');
    });
  });

  describe('reprocessingStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLED'];
      validStatuses.forEach(status => {
        expect(reprocessingStatusSchema.parse(status)).toBe(status);
      });
    });
  });

  describe('reprocessingRunSchema', () => {
    it('should accept valid run', () => {
      const now = new Date().toISOString();
      const result = reprocessingRunSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
        status: 'SUCCEEDED',
        startedAt: now,
        completedAt: now,
        results: [
          { opportunityId: '123e4567-e89b-12d3-a456-426614174001', reprocessed: true, intelligenceUpdated: true },
        ],
        error: undefined,
        triggeredBy: 'manual',
        forceReprocess: false,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
      expect(result.forceReprocess).toBe(false);
    });
  });

  describe('createReprocessingRunSchema', () => {
    it('should accept valid create request', () => {
      const result = createReprocessingRunSchema.parse({
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
        reason: 'Intelligence update',
        triggeredBy: 'admin',
        forceReprocess: true,
        metadata: {},
      });
      expect(result.forceReprocess).toBe(true);
    });

    it('should apply default forceReprocess', () => {
      const result = createReprocessingRunSchema.parse({
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
      });
      expect(result.forceReprocess).toBe(false);
    });
  });

  describe('reprocessingFiltersSchema', () => {
    it('should accept valid filters', () => {
      const result = reprocessingFiltersSchema.parse({
        status: 'RUNNING',
        triggeredBy: 'admin',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z',
        page: 1,
        limit: 20,
      });
      expect(result.status).toBe('RUNNING');
    });
  });
});

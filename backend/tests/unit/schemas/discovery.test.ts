import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  paginationSchema,
  dateRangeSchema,
  createJobOptionsSchema,
  discoveryJobSchema,
  discoveryRunSchema,
  runScheduleRequestSchema,
  runCancelRequestSchema,
  runPollOptionsSchema,
} from '@/schemas/discovery.js';

describe('Discovery Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it('should reject invalid UUID', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
      expect(() => uuidSchema.parse('123')).toThrow();
      expect(() => uuidSchema.parse('')).toThrow();
    });
  });

  describe('paginationSchema', () => {
    it('should accept valid pagination params', () => {
      const result = paginationSchema.parse({
        page: 2,
        limit: 50,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.sortBy).toBe('created_at');
      expect(result.sortOrder).toBe('desc');
    });

    it('should apply defaults', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortOrder).toBe('desc');
    });

    it('should coerce string numbers', () => {
      const result = paginationSchema.parse({
        page: '3',
        limit: '25',
      });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });

    it('should reject invalid page', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
      expect(() => paginationSchema.parse({ page: -1 })).toThrow();
    });

    it('should reject limit over max', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject invalid sortOrder', () => {
      expect(() => paginationSchema.parse({ sortOrder: 'invalid' })).toThrow();
    });
  });

  describe('dateRangeSchema', () => {
    it('should accept valid date range', () => {
      const result = dateRangeSchema.parse({
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      });
      expect(result.from).toBe('2024-01-01T00:00:00Z');
      expect(result.to).toBe('2024-12-31T23:59:59Z');
    });

    it('should accept partial date range', () => {
      const result = dateRangeSchema.parse({ from: '2024-01-01T00:00:00Z' });
      expect(result.from).toBe('2024-01-01T00:00:00Z');
      expect(result.to).toBeUndefined();
    });

    it('should reject invalid datetime', () => {
      expect(() => dateRangeSchema.parse({ from: 'not-a-date' })).toThrow();
    });
  });

  describe('createJobOptionsSchema', () => {
    it('should accept valid job options', () => {
      const result = createJobOptionsSchema.parse({
        sourceIds: ['source-1', 'source-2'],
        runAllEnabled: true,
        category: 'TECHNOLOGY',
        priorityMin: 75,
        metadata: { key: 'value' },
        triggeredBy: 'scheduler',
      });
      expect(result.sourceIds).toEqual(['source-1', 'source-2']);
      expect(result.runAllEnabled).toBe(true);
      expect(result.category).toBe('TECHNOLOGY');
      expect(result.priorityMin).toBe(75);
    });

    it('should apply defaults', () => {
      const result = createJobOptionsSchema.parse({});
      expect(result.runAllEnabled).toBe(false);
    });

    it('should reject priorityMin out of range', () => {
      expect(() => createJobOptionsSchema.parse({ priorityMin: -1 })).toThrow();
      expect(() => createJobOptionsSchema.parse({ priorityMin: 101 })).toThrow();
    });
  });

  describe('discoveryJobSchema', () => {
    it('should accept valid job', () => {
      const now = new Date().toISOString();
      const result = discoveryJobSchema.parse({
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: now,
        updatedAt: now,
        sourceIds: ['source-1'],
        runAllEnabled: false,
        category: 'TECHNOLOGY',
        priorityMin: 50,
        metadata: {},
        triggeredBy: 'manual',
        status: 'DRAFT',
      });
      expect(result.status).toBe('DRAFT');
    });

    it('should reject invalid status', () => {
      const now = new Date().toISOString();
      expect(() => discoveryJobSchema.parse({
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: now,
        updatedAt: now,
        runAllEnabled: false,
        status: 'INVALID',
      })).toThrow();
    });
  });

  describe('discoveryRunSchema', () => {
    it('should accept valid run', () => {
      const now = new Date().toISOString();
      const result = discoveryRunSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        jobId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'RUNNING',
        startedAt: now,
        completedAt: undefined,
        sourcesRequested: 5,
        sourcesSucceeded: 3,
        sourcesFailed: 1,
        sourcesSkipped: 1,
        stageResults: [],
        error: undefined,
        metadata: {},
        executionContext: {},
      });
      expect(result.status).toBe('RUNNING');
    });

    it('should reject invalid status', () => {
      const now = new Date().toISOString();
      expect(() => discoveryRunSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        jobId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'INVALID',
        sourcesRequested: 0,
        sourcesSucceeded: 0,
        sourcesFailed: 0,
        sourcesSkipped: 0,
        stageResults: [],
        executionContext: {},
      })).toThrow();
    });
  });

  describe('runScheduleRequestSchema', () => {
    it('should accept valid schedule request', () => {
      const result = runScheduleRequestSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        jobId: '123e4567-e89b-12d3-a456-426614174001',
        sources: ['source-1', 'source-2'],
        scheduleAt: '2024-01-01T00:00:00Z',
        cronExpression: '0 0 * * *',
        metadata: {},
        triggeredBy: 'scheduler',
      });
      expect(result.sources).toHaveLength(2);
    });

    it('should require at least one source', () => {
      expect(() => runScheduleRequestSchema.parse({
        jobId: '123e4567-e89b-12d3-a456-426614174001',
        sources: [],
      })).toThrow();
    });
  });

  describe('runCancelRequestSchema', () => {
    it('should accept valid cancel request', () => {
      const result = runCancelRequestSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        reason: 'User requested',
      });
      expect(result.reason).toBe('User requested');
    });

    it('should accept cancel request without reason', () => {
      const result = runCancelRequestSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.reason).toBeUndefined();
    });
  });

  describe('runPollOptionsSchema', () => {
    it('should accept valid poll options', () => {
      const result = runPollOptionsSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        intervalMs: 2000,
        timeoutMs: 120000,
      });
      expect(result.intervalMs).toBe(2000);
      expect(result.timeoutMs).toBe(120000);
    });

    it('should apply defaults', () => {
      const result = runPollOptionsSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.intervalMs).toBe(1000);
      expect(result.timeoutMs).toBe(60000);
    });
  });
});

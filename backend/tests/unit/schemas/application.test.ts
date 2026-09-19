import { describe, it, expect } from 'vitest';
import {
  applicationStatusSchema,
  applicationSchema,
  createApplicationSchema,
  updateApplicationSchema,
  applicationFiltersSchema,
  reminderSchema,
  sendReminderRequestSchema,
} from '@/schemas/application.js';

describe('Application Schemas', () => {
  describe('applicationStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = [
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEWING',
        'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'
      ];
      validStatuses.forEach(status => {
        expect(applicationStatusSchema.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => applicationStatusSchema.parse('INVALID')).toThrow();
    });
  });

  describe('applicationSchema', () => {
    it('should accept valid application', () => {
      const now = new Date().toISOString();
      const result = applicationSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        externalId: 'ext-123',
        applicationUrl: 'https://example.com/apply',
        status: 'SUBMITTED',
        notes: 'Applied via portal',
        metadata: { source: 'web' },
        createdAt: now,
        updatedAt: now,
      });
      expect(result.status).toBe('SUBMITTED');
    });

    it('should reject invalid URL', () => {
      const now = new Date().toISOString();
      expect(() => applicationSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        applicationUrl: 'not-a-url',
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      })).toThrow();
    });
  });

  describe('createApplicationSchema', () => {
    it('should accept valid create request', () => {
      const result = createApplicationSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
        externalId: 'ext-123',
        applicationUrl: 'https://example.com/apply',
        status: 'DRAFT',
        notes: 'Draft application',
        metadata: {},
      });
      expect(result.status).toBe('DRAFT');
    });

    it('should apply default status', () => {
      const result = createApplicationSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
      });
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('updateApplicationSchema', () => {
    it('should accept partial update', () => {
      const result = updateApplicationSchema.parse({
        status: 'SUBMITTED',
        notes: 'Submitted',
      });
      expect(result.status).toBe('SUBMITTED');
    });

    it('should accept empty update', () => {
      const result = updateApplicationSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('applicationFiltersSchema', () => {
    it('should accept valid filters', () => {
      const result = applicationFiltersSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        status: 'SUBMITTED',
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z',
        page: 2,
        limit: 50,
      });
      expect(result.opportunityId).toBe('123e4567-e89b-12d3-a456-426614174001');
    });
  });

  describe('reminderSchema', () => {
    it('should accept valid reminder', () => {
      const now = new Date().toISOString();
      const result = reminderSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        applicationId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'DEADLINE',
        scheduledAt: now,
        sentAt: undefined,
        status: 'PENDING',
        channel: 'EMAIL',
        error: undefined,
        createdAt: now,
      });
      expect(result.type).toBe('DEADLINE');
      expect(result.channel).toBe('EMAIL');
    });

    it('should accept all valid types', () => {
      const types = ['DEADLINE', 'FOLLOW_UP', 'INTERVIEW', 'CUSTOM'];
      types.forEach(type => {
        const now = new Date().toISOString();
        const result = reminderSchema.parse({
          id: '123e4567-e89b-12d3-a456-426614174000',
          applicationId: '123e4567-e89b-12d3-a456-426614174001',
          type,
          scheduledAt: now,
          status: 'PENDING',
          channel: 'EMAIL',
          createdAt: now,
        });
        expect(result.type).toBe(type);
      });
    });

    it('should accept all valid channels', () => {
      const channels = ['EMAIL', 'PUSH', 'SMS', 'WEBHOOK'];
      channels.forEach(channel => {
        const now = new Date().toISOString();
        const result = reminderSchema.parse({
          id: '123e4567-e89b-12d3-a456-426614174000',
          applicationId: '123e4567-e89b-12d3-a456-426614174001',
          type: 'DEADLINE',
          scheduledAt: now,
          status: 'PENDING',
          channel,
          createdAt: now,
        });
        expect(result.channel).toBe(channel);
      });
    });
  });

  describe('sendReminderRequestSchema', () => {
    it('should accept valid request', () => {
      const result = sendReminderRequestSchema.parse({
        type: 'DEADLINE',
        scheduledAt: new Date().toISOString(),
        channel: 'EMAIL',
        customMessage: 'Custom reminder',
      });
      expect(result.customMessage).toBe('Custom reminder');
    });

    it('should apply default channel', () => {
      const result = sendReminderRequestSchema.parse({
        type: 'FOLLOW_UP',
      });
      expect(result.channel).toBe('EMAIL');
    });

    it('should accept all valid types', () => {
      const types = ['DEADLINE', 'FOLLOW_UP', 'INTERVIEW', 'CUSTOM'];
      types.forEach(type => {
        const result = sendReminderRequestSchema.parse({ type });
        expect(result.type).toBe(type);
      });
    });
  });
});

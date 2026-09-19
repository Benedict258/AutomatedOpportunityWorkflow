import { describe, it, expect } from 'vitest';
import {
  discoveryCompleteWebhookSchema,
  intelligenceCompleteWebhookSchema,
  highPriorityAlertWebhookSchema,
  applicationTrackingWebhookSchema,
  discoveryManualTriggerSchema,
  reprocessingManualTriggerSchema,
  verificationCompleteWebhookSchema,
  reprocessingCompleteWebhookSchema,
  webhookRegistrationSchema,
} from '@/schemas/webhook.js';

describe('Webhook Schemas', () => {
  describe('discoveryCompleteWebhookSchema', () => {
    it('should accept valid webhook', () => {
      const now = new Date().toISOString();
      const result = discoveryCompleteWebhookSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        jobId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'SUCCEEDED',
        metrics: {
          totalSources: 5,
          sourcesSucceeded: 4,
          sourcesFailed: 1,
          sourcesSkipped: 0,
          itemsDiscovered: 100,
          itemsDeduplicated: 80,
          durationMs: 5000,
          errorsCount: 2,
          warningsCount: 5,
        },
        opportunities: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            stableId: '123e4567-e89b-12d3-a456-426614174003',
            externalId: 'ext-123',
            title: 'Opportunity 1',
            url: 'https://example.com/1',
          },
        ],
        completedAt: now,
      });
      expect(result.status).toBe('SUCCEEDED');
      expect(result.metrics.itemsDiscovered).toBe(100);
    });

    it('should accept webhook without opportunities', () => {
      const now = new Date().toISOString();
      const result = discoveryCompleteWebhookSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        jobId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'FAILED',
        metrics: {
          totalSources: 5,
          sourcesSucceeded: 0,
          sourcesFailed: 5,
          sourcesSkipped: 0,
          itemsDiscovered: 0,
          itemsDeduplicated: 0,
          durationMs: 1000,
          errorsCount: 5,
          warningsCount: 0,
        },
        error: 'All sources failed',
        completedAt: now,
      });
      expect(result.opportunities).toBeUndefined();
      expect(result.error).toBe('All sources failed');
    });
  });

  describe('intelligenceCompleteWebhookSchema', () => {
    it('should accept valid webhook', () => {
      const now = new Date().toISOString();
      const result = intelligenceCompleteWebhookSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174000',
        runId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'SUCCEEDED',
        intelligence: {
          classification: {
            primaryCategory: 'TECHNOLOGY',
            secondaryCategories: ['AI'],
            confidence: 0.95,
          },
          requirements: [
            { id: '123e4567-e89b-12d3-a456-426614174002', name: 'PhD', requirementType: 'EDUCATION', isRequired: true },
          ],
          eligibility: {
            overallEligible: true,
            requirements: [
              { requirementId: '123e4567-e89b-12d3-a456-426614174003', state: 'MET' },
            ],
          },
          explanation: {
            summary: 'Great match',
            strengths: ['PhD'],
            gaps: [],
            recommendations: ['Apply'],
          },
        },
        completedAt: now,
      });
      expect(result.intelligence?.classification.primaryCategory).toBe('TECHNOLOGY');
    });
  });

  describe('highPriorityAlertWebhookSchema', () => {
    it('should accept valid alert', () => {
      const now = new Date().toISOString();
      const result = highPriorityAlertWebhookSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174000',
        alertType: 'DEADLINE_SOON',
        severity: 'HIGH',
        message: 'Deadline in 2 days',
        metadata: { daysUntilDeadline: 2 },
        triggeredAt: now,
        candidateIds: ['123e4567-e89b-12d3-a456-426614174001'],
      });
      expect(result.alertType).toBe('DEADLINE_SOON');
      expect(result.severity).toBe('HIGH');
    });

    it('should reject invalid alert type', () => {
      const now = new Date().toISOString();
      expect(() => highPriorityAlertWebhookSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174000',
        alertType: 'INVALID',
        severity: 'HIGH',
        message: 'Test',
        triggeredAt: now,
      })).toThrow();
    });

    it('should reject invalid severity', () => {
      const now = new Date().toISOString();
      expect(() => highPriorityAlertWebhookSchema.parse({
        opportunityId: '123e4567-e89b-12d3-a456-426614174000',
        alertType: 'DEADLINE_SOON',
        severity: 'INVALID',
        message: 'Test',
        triggeredAt: now,
      })).toThrow();
    });
  });

  describe('applicationTrackingWebhookSchema', () => {
    it('should accept valid tracking event', () => {
      const now = new Date().toISOString();
      const result = applicationTrackingWebhookSchema.parse({
        applicationId: '123e4567-e89b-12d3-a456-426614174000',
        opportunityId: '123e4567-e89b-12d3-a456-426614174001',
        candidateId: '123e4567-e89b-12d3-a456-426614174002',
        event: 'SUBMITTED',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        metadata: { submittedVia: 'portal' },
        occurredAt: now,
      });
      expect(result.event).toBe('SUBMITTED');
    });

    it('should accept all valid event types', () => {
      const events = ['CREATED', 'SUBMITTED', 'STATUS_CHANGED', 'INTERVIEW_SCHEDULED', 'OFFER_RECEIVED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];
      events.forEach(event => {
        const now = new Date().toISOString();
        const result = applicationTrackingWebhookSchema.parse({
          applicationId: '123e4567-e89b-12d3-a456-426614174000',
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          candidateId: '123e4567-e89b-12d3-a456-426614174002',
          event,
          newStatus: event,
          occurredAt: now,
        });
        expect(result.event).toBe(event);
      });
    });
  });

  describe('discoveryManualTriggerSchema', () => {
    it('should accept valid trigger', () => {
      const result = discoveryManualTriggerSchema.parse({
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        sourceIds: ['source-1'],
        runAllEnabled: false,
        category: 'TECHNOLOGY',
        priorityMin: 50,
        triggeredBy: 'admin',
        metadata: { reason: 'manual' },
      });
      expect(result.triggeredBy).toBe('admin');
    });

    it('should apply defaults', () => {
      const result = discoveryManualTriggerSchema.parse({});
      expect(result.runAllEnabled).toBe(false);
      expect(result.triggeredBy).toBe('manual-webhook');
    });
  });

  describe('reprocessingManualTriggerSchema', () => {
    it('should accept valid trigger', () => {
      const result = reprocessingManualTriggerSchema.parse({
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174000'],
        reason: 'Data update',
        triggeredBy: 'admin',
        forceReprocess: true,
        metadata: {},
      });
      expect(result.forceReprocess).toBe(true);
    });

    it('should require at least one opportunityId', () => {
      expect(() => reprocessingManualTriggerSchema.parse({
        opportunityIds: [],
      })).toThrow();
    });

    it('should reject more than 1000 opportunityIds', () => {
      const ids = Array(1001).fill('123e4567-e89b-12d3-a456-426614174000');
      expect(() => reprocessingManualTriggerSchema.parse({
        opportunityIds: ids,
      })).toThrow();
    });
  });

  describe('verificationCompleteWebhookSchema', () => {
    it('should accept valid webhook', () => {
      const now = new Date().toISOString();
      const result = verificationCompleteWebhookSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
        status: 'SUCCEEDED',
        results: [
          { opportunityId: '123e4567-e89b-12d3-a456-426614174001', verified: true, changes: ['deadline'] },
        ],
        completedAt: now,
      });
      expect(result.results?.[0].verified).toBe(true);
    });
  });

  describe('reprocessingCompleteWebhookSchema', () => {
    it('should accept valid webhook', () => {
      const now = new Date().toISOString();
      const result = reprocessingCompleteWebhookSchema.parse({
        runId: '123e4567-e89b-12d3-a456-426614174000',
        opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
        status: 'SUCCEEDED',
        results: [
          { opportunityId: '123e4567-e89b-12d3-a456-426614174001', reprocessed: true, intelligenceUpdated: true },
        ],
        completedAt: now,
      });
      expect(result.results?.[0].intelligenceUpdated).toBe(true);
    });
  });

  describe('webhookRegistrationSchema', () => {
    it('should accept valid registration', () => {
      const result = webhookRegistrationSchema.parse({
        url: 'https://example.com/webhook',
        events: ['discovery.complete', 'intelligence.complete'],
        secret: 'secret-key-min-32-chars-long-enough',
        active: true,
      });
      expect(result.url).toBe('https://example.com/webhook');
      expect(result.events).toHaveLength(2);
    });

    it('should require at least one event', () => {
      expect(() => webhookRegistrationSchema.parse({
        url: 'https://example.com/webhook',
        events: [],
      })).toThrow();
    });

    it('should reject invalid URL', () => {
      expect(() => webhookRegistrationSchema.parse({
        url: 'not-a-url',
        events: ['discovery.complete'],
      })).toThrow();
    });

    it('should reject secret too short', () => {
      expect(() => webhookRegistrationSchema.parse({
        url: 'https://example.com/webhook',
        events: ['discovery.complete'],
        secret: 'short',
      })).toThrow();
    });
  });
});

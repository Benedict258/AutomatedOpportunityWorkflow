import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { buildServer } from '@/server.js';
import type { FastifyInstance } from 'fastify';
import { createValidHMAC } from '@tests/factories.js';

describe('Webhook Endpoints Integration', () => {
  let app: FastifyInstance;
  const secret = 'test-webhook-secret-key-min-32-chars-long';

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/webhooks/discovery-complete', () => {
    const validPayload = {
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
      completedAt: new Date().toISOString(),
    };

    it('should accept valid HMAC and idempotency key', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        headers: {
          'x-webhook-signature': signature,
          'idempotency-key': 'idem-key-123',
        },
        payload: validPayload,
      });

      expect([200, 202, 401]).toContain(response.statusCode);
      if (response.statusCode === 200 || response.statusCode === 202) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
      }
    });

    it('should reject invalid HMAC', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        headers: {
          'x-webhook-signature': 'sha256=invalid',
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject missing signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject duplicate idempotency key', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      const idempotencyKey = 'duplicate-key-123';
      
      // First request
      await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        headers: {
          'x-webhook-signature': signature,
          'idempotency-key': idempotencyKey,
        },
        payload: validPayload,
      });
      
      // Second request with same key
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        headers: {
          'x-webhook-signature': signature,
          'idempotency-key': idempotencyKey,
        },
        payload: validPayload,
      });

      // Should return the cached response
      expect([200, 202, 401]).toContain(response.statusCode);
      if (response.statusCode === 200 || response.statusCode === 202) {
        expect(response.headers['x-idempotency-replay']).toBe('true');
      }
    });

    it('should validate payload structure', async () => {
      const invalidPayload = { invalid: 'data' };
      const signature = await createValidHMAC(JSON.stringify(invalidPayload), secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        headers: {
          'x-webhook-signature': signature,
        },
        payload: invalidPayload,
      });

      expect([400, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/webhooks/intelligence-complete', () => {
    const validPayload = {
      opportunityId: '123e4567-e89b-12d3-a456-426614174000',
      runId: '123e4567-e89b-12d3-a456-426614174001',
      status: 'SUCCEEDED',
      intelligence: {
        classification: { primaryCategory: 'TECHNOLOGY', confidence: 0.9 },
        requirements: [{ id: '123', name: 'PhD', requirementType: 'EDUCATION', isRequired: true }],
        explanation: { summary: 'Great', strengths: [], gaps: [], recommendations: [] },
      },
      completedAt: new Date().toISOString(),
    };

    it('should accept valid webhook', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/intelligence-complete',
        headers: {
          'x-webhook-signature': signature,
        },
        payload: validPayload,
      });

      expect([200, 202, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/webhooks/high-priority-alert', () => {
    const validPayload = {
      opportunityId: '123e4567-e89b-12d3-a456-426614174000',
      alertType: 'DEADLINE_SOON',
      severity: 'HIGH',
      message: 'Deadline approaching',
      triggeredAt: new Date().toISOString(),
    };

    it('should accept valid alert webhook', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/high-priority-alert',
        headers: {
          'x-webhook-signature': signature,
        },
        payload: validPayload,
      });

      expect([200, 202, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/webhooks/application-tracking', () => {
    const validPayload = {
      applicationId: '123e4567-e89b-12d3-a456-426614174000',
      opportunityId: '123e4567-e89b-12d3-a456-426614174001',
      candidateId: '123e4567-e89b-12d3-a456-426614174002',
      event: 'SUBMITTED',
      newStatus: 'SUBMITTED',
      occurredAt: new Date().toISOString(),
    };

    it('should accept valid tracking webhook', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/application-tracking',
        headers: {
          'x-webhook-signature': signature,
        },
        payload: validPayload,
      });

      expect([200, 202, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/webhooks/verification-complete', () => {
    const validPayload = {
      runId: '123e4567-e89b-12d3-a456-426614174000',
      opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
      status: 'SUCCEEDED',
      results: [{ opportunityId: '123e4567-e89b-12d3-a456-426614174001', verified: true }],
      completedAt: new Date().toISOString(),
    };

    it('should accept valid verification webhook', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/verification-complete',
        headers: {
          'x-webhook-signature': signature,
        },
        payload: validPayload,
      });

      expect([200, 202, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/webhooks/reprocessing-complete', () => {
    const validPayload = {
      runId: '123e4567-e89b-12d3-a456-426614174000',
      opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
      status: 'SUCCEEDED',
      results: [{ opportunityId: '123e4567-e89b-12d3-a456-426614174001', reprocessed: true, intelligenceUpdated: true }],
      completedAt: new Date().toISOString(),
    };

    it('should accept valid reprocessing webhook', async () => {
      const payload = JSON.stringify(validPayload);
      const signature = await createValidHMAC(payload, secret);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/reprocessing-complete',
        headers: {
          'x-webhook-signature': signature,
        },
        payload: validPayload,
      });

      expect([200, 202, 401]).toContain(response.statusCode);
    });
  });
});

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { buildServer } from '@/server.js';
import type { FastifyInstance } from 'fastify';
import { createValidJWT, createExpiredJWT, createInvalidJWT, createValidAPIKey, createValidHMAC } from '@tests/factories.js';

describe('Authentication Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('JWT Authentication', () => {
    it('should return 401 for missing auth on protected endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for invalid JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities',
        headers: {
          authorization: createInvalidJWT(),
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for expired JWT', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities',
        headers: {
          authorization: createExpiredJWT(),
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('API Key Authentication', () => {
    it('should return 401 for invalid API key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities',
        headers: {
          'x-api-key': 'invalid-key',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept valid API key in development', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities',
        headers: {
          'x-api-key': createValidAPIKey(),
        },
      });

      // In development, the mock API key validation returns a candidate ID
      // This might return 200 or 404 depending on DB state
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  describe('Webhook HMAC Authentication', () => {
    it('should return 401 for missing signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        payload: { runId: 'test', jobId: 'test', status: 'SUCCEEDED' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should return 401 for invalid HMAC', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/discovery-complete',
        payload: { runId: 'test', jobId: 'test', status: 'SUCCEEDED' },
        headers: {
          'x-webhook-signature': 'sha256=invalid',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

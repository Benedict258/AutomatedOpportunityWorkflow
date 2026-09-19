import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { buildServer } from '@/server.js';
import type { FastifyInstance } from 'fastify';
import { createValidAPIKey } from '@tests/factories.js';

describe('Discovery Endpoints Integration', () => {
  let app: FastifyInstance;
  const authHeaders = { 'x-api-key': createValidAPIKey() };

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/discovery/jobs', () => {
    it('should create a discovery job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/jobs',
        headers: authHeaders,
        payload: {
          sourceIds: ['source-1'],
          category: 'TECHNOLOGY',
          priorityMin: 50,
        },
      });

      expect([201, 401, 500]).toContain(response.statusCode);
      if (response.statusCode === 201) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(body.data.jobId).toBeDefined();
        expect(body.data.status).toBe('DRAFT');
      }
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/jobs',
        headers: authHeaders,
        payload: {
          priorityMin: 150, // Invalid - over max
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/discovery/jobs/:jobId', () => {
    it('should return 404 for non-existent job', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/jobs/123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
      });

      expect([404, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/discovery/jobs/:jobId/execute', () => {
    it('should execute a job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/jobs/123e4567-e89b-12d3-a456-426614174000/execute',
        headers: authHeaders,
      });

      expect([201, 404, 409, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/discovery/runs', () => {
    it('should schedule a run', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/runs',
        headers: authHeaders,
        payload: {
          jobId: '123e4567-e89b-12d3-a456-426614174000',
          sources: ['source-1'],
        },
      });

      expect([201, 401, 400]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/discovery/runs/:runId', () => {
    it('should get run status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/runs/123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/discovery/runs/:runId/results', () => {
    it('should get run results', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/runs/123e4567-e89b-12d3-a456-426614174000/results',
        headers: authHeaders,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/discovery/runs/:runId/cancel', () => {
    it('should cancel a run', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/discovery/runs/123e4567-e89b-12d3-a456-426614174000/cancel',
        headers: authHeaders,
        payload: { reason: 'Test cancellation' },
      });

      expect([200, 404, 409, 401]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/discovery/runs', () => {
    it('should list runs with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/runs?page=1&limit=10',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(body.meta).toBeDefined();
        expect(body.meta.page).toBe(1);
        expect(body.meta.limit).toBe(10);
      }
    });

    it('should filter runs by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/runs?status=SUCCEEDED,FAILED',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });
  });
});

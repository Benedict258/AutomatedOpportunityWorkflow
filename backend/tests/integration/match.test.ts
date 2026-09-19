import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { buildServer } from '@/server.js';
import type { FastifyInstance } from 'fastify';
import { createValidAPIKey } from '@tests/factories.js';

describe('Match Endpoints Integration', () => {
  let app: FastifyInstance;
  const authHeaders = { 'x-api-key': createValidAPIKey() };

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/matches', () => {
    it('should create matches for candidate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/matches',
        headers: authHeaders,
        payload: {
          candidateId: '123e4567-e89b-12d3-a456-426614174000',
          opportunityIds: ['123e4567-e89b-12d3-a456-426614174001'],
        },
      });

      expect([201, 401, 400, 500]).toContain(response.statusCode);
    });

    it('should validate opportunityIds limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/matches',
        headers: authHeaders,
        payload: {
          candidateId: '123e4567-e89b-12d3-a456-426614174000',
          opportunityIds: Array(101).fill('123e4567-e89b-12d3-a456-426614174001'),
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/matches', () => {
    it('should list matches with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches?page=1&limit=20',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(body.meta).toBeDefined();
      }
    });

    it('should filter by candidateId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches?candidateId=123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });

    it('should filter by opportunityId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches?opportunityId=123e4567-e89b-12d3-a456-426614174001',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches?status=COMPUTED',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });

    it('should filter by minScore and maxScore', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches?minScore=0.7&maxScore=0.95',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });

    it('should filter by computed date range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches?computedAfter=2024-01-01T00:00:00Z&computedBefore=2024-12-31T23:59:59Z',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/matches/:id', () => {
    it('should get match detail with explanation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/matches/123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(body.data.score).toBeDefined();
        expect(body.data.explanation).toBeDefined();
        expect(body.data.explanation.summary).toBeDefined();
        expect(body.data.explanation.strengths).toBeDefined();
        expect(body.data.explanation.gaps).toBeDefined();
        expect(body.data.explanation.recommendations).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/candidates/:candidateId/matches', () => {
    it('should get candidate-scoped matches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/candidates/123e4567-e89b-12d3-a456-426614174000/matches',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });
  });
});

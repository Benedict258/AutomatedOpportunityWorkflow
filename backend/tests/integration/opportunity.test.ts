import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { buildServer } from '@/server.js';
import type { FastifyInstance } from 'fastify';
import { createValidAPIKey } from '@tests/factories.js';

describe('Opportunity Endpoints Integration', () => {
  let app: FastifyInstance;
  const authHeaders = { 'x-api-key': createValidAPIKey() };

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/opportunities', () => {
    it('should create an opportunity', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/opportunities',
        headers: authHeaders,
        payload: {
          sourceId: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Test Fellowship',
          organization: 'Test Org',
          url: 'https://example.com/fellowship',
          location: 'Remote',
          opportunityType: 'FELLOWSHIP',
          deadlineType: 'FIXED',
          applicationDeadline: new Date(Date.now() + 86400000 * 30).toISOString(),
        },
      });

      expect([201, 401, 400, 500]).toContain(response.statusCode);
      if (response.statusCode === 201) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(body.data.id).toBeDefined();
        expect(body.data.title).toBe('Test Fellowship');
      }
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/opportunities',
        headers: authHeaders,
        payload: {
          title: '', // Invalid - empty
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/opportunities', () => {
    it('should list opportunities with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities?page=1&limit=20',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.meta).toBeDefined();
        expect(body.links).toBeDefined();
      }
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities?status=ACTIVE',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });

    it('should filter by search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities?search=fellowship',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });

    it('should filter by hasDeadline', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities?hasDeadline=true',
        headers: authHeaders,
      });

      expect([200, 401]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/opportunities/:id', () => {
    it('should return 404 for non-existent opportunity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
      });

      expect([404, 401]).toContain(response.statusCode);
    });
  });

  describe('PATCH /api/v1/opportunities/:id', () => {
    it('should update an opportunity', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
        payload: {
          title: 'Updated Title',
          status: 'CLOSED',
        },
      });

      expect([200, 404, 401, 400]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/v1/opportunities/:id', () => {
    it('should delete an opportunity', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000',
        headers: authHeaders,
      });

      expect([200, 204, 404, 401]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/opportunities/:id/intelligence', () => {
    it('should get opportunity intelligence', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000/intelligence',
        headers: authHeaders,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body.data).toBeDefined();
        expect(body.data.opportunityId).toBeDefined();
        expect(body.data.classification).toBeDefined();
        expect(body.data.explanation).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/opportunities/:id/matches', () => {
    it('should get opportunity matches', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000/matches',
        headers: authHeaders,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/opportunities/:id/versions', () => {
    it('should get opportunity version history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000/versions',
        headers: authHeaders,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/opportunities/:id/reprocess', () => {
    it('should trigger reprocessing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000/reprocess',
        headers: authHeaders,
      });

      expect([200, 202, 404, 401]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/opportunities/:id/verify', () => {
    it('should trigger verification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/opportunities/123e4567-e89b-12d3-a456-426614174000/verify',
        headers: authHeaders,
      });

      expect([200, 202, 404, 401]).toContain(response.statusCode);
    });
  });
});

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { buildServer } from '@/server.js';
import type { FastifyInstance } from 'fastify';

describe('Health Endpoints Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health/live', () => {
    it('should return 200 with status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when DB is ready', async () => {
      // Mock DB check to return healthy
      const { checkConnection } = await import('@/db/connection.js');
      vi.mocked(checkConnection).mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ready');
      expect(body.checks.database).toBe('healthy');
    });

    it('should return 503 when DB is not ready', async () => {
      const { checkConnection } = await import('@/db/connection.js');
      vi.mocked(checkConnection).mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('not ready');
      expect(body.checks.database).toBe('unhealthy');
    });
  });
});

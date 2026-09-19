import type { FastifyInstance } from 'fastify';
import { checkDatabaseConnection } from '../db/connection.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Liveness probe - simple check that the process is running
  fastify.get('/health/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description: 'Returns 200 if the service is running',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            timestamp: { type: 'string', format: 'date-time' },
            service: { type: 'string' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'automated-opportunity-workflow',
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  // Readiness probe - checks critical dependencies
  fastify.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description: 'Returns 200 if the service is ready to accept traffic',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ready', 'not_ready'] },
            timestamp: { type: 'string', format: 'date-time' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'object', properties: { status: { type: 'string' }, latencyMs: { type: 'number' } } },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['not_ready'] },
            timestamp: { type: 'string', format: 'date-time' },
            checks: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const startTime = Date.now();
    const dbHealthy = await checkDatabaseConnection();
    const dbLatency = Date.now() - startTime;

    const checks = {
      database: {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        latencyMs: dbLatency,
      },
    };

    const allHealthy = dbHealthy;

    if (!allHealthy) {
      reply.code(503);
    }

    return {
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  });
}
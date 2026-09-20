import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/connection.js';
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
            status: { type: 'string', enum: ['ready'] },
            timestamp: { type: 'string', format: 'date-time' },
            checks: {
              type: 'object',
              properties: {
                db: { type: 'boolean' },
                vector: { type: 'boolean' },
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
    let dbReady = false;
    let vectorReady = false;

    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      dbReady = true;
    } catch (error) {
      logger.error({ err: error }, 'Database readiness check failed');
    }

    // Vector check - placeholder for pgvector extension check
    // In production, this could verify pgvector is available
    vectorReady = dbReady;

    const checks = { db: dbReady, vector: vectorReady };
    const allReady = dbReady && vectorReady;

    if (!allReady) {
      reply.code(503);
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks,
      };
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  });
}
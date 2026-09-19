import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { discoveryRoutes } from './discovery.js';
import { opportunityRoutes } from './opportunity.js';
import { matchRoutes } from './match.js';
import { newsRoutes } from './news.js';
import { applicationRoutes } from './application.js';
import { deadlineRoutes } from './deadlines.js';
import { verificationRoutes } from './verification.js';
import { reprocessingRoutes } from './reprocessing.js';
import { webhookRoutes } from './webhook.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health routes (no auth)
  await fastify.register(healthRoutes, { prefix: '' });

  // API v1 routes (with auth)
  await fastify.register(async (fastify) => {
    // Discovery routes
    await fastify.register(discoveryRoutes);
    
    // Opportunity routes
    await fastify.register(opportunityRoutes);
    
    // Match routes
    await fastify.register(matchRoutes);
    
    // News routes
    await fastify.register(newsRoutes);
    
    // Application routes
    await fastify.register(applicationRoutes);
    
    // Deadline routes
    await fastify.register(deadlineRoutes);
    
    // Verification routes
    await fastify.register(verificationRoutes);
    
    // Reprocessing routes
    await fastify.register(reprocessingRoutes);
    
    // Webhook routes (with HMAC verification)
    await fastify.register(webhookRoutes);
  }, { prefix: '' });

  // 404 handler for API routes
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/health')) {
      reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          title: 'Not Found',
          message: `Route ${request.method} ${request.url} not found`,
          status: 404,
          requestId: request.requestId,
          instance: request.url,
        },
      });
    }
  });
}
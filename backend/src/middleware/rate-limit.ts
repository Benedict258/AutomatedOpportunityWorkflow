import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config/index';

export async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  const rateLimitConfig = config.rateLimit;

  await fastify.register((await import('@fastify/rate-limit')).default, {
    max: rateLimitConfig.max,
    timeWindow: rateLimitConfig.windowMs,
    allowList: ['127.0.0.1', '::1'], // Allow localhost
    keyGenerator: (request: FastifyRequest) => {
      // Use API key or IP for rate limiting
      const apiKey = request.headers['x-api-key'];
      if (apiKey && typeof apiKey === 'string') {
        return `apikey:${apiKey}`;
      }
      return request.ip;
    },
    errorResponseBuilder: (opts: { max: number; timeWindow: number }, request: FastifyRequest) => ({
      error: {
        code: 'RATE_LIMITED',
        title: 'Rate Limited',
        message: `Rate limit exceeded. Max ${opts.max} requests per ${opts.timeWindow / 1000}s.`,
        status: 429,
        requestId: (request as any).requestId,
        retryAfter: Math.ceil(opts.timeWindow / 1000),
      },
    }),
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    hook: 'onRequest',
  });
}

// Stricter rate limiting for auth endpoints
export async function authRateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register((await import('@fastify/rate-limit')).default, {
    max: 10,
    timeWindow: 60000, // 10 requests per minute
    keyGenerator: (request: FastifyRequest) => request.ip,
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        title: 'Rate Limited',
        message: 'Too many authentication attempts. Please try again later.',
        status: 429,
      },
    }),
    hook: 'onRequest',
  });
}

// Webhook rate limiting (more permissive)
export async function webhookRateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register((await import('@fastify/rate-limit')).default, {
    max: 1000,
    timeWindow: 60000, // 1000 requests per minute
    keyGenerator: (request: FastifyRequest) => request.ip,
    hook: 'onRequest',
  });
}
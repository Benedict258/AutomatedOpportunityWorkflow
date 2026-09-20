import type { FastifyRequest, FastifyReply, FastifyInstance, FastifyBaseLogger } from 'fastify';
import { logger } from '../utils/logger';

const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';

export function correlationIdMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract or generate correlation ID
    const correlationId = 
      (request.headers[CORRELATION_HEADER] as string) ||
      (request.headers[REQUEST_ID_HEADER] as string) ||
      crypto.randomUUID();

    // Extract or generate request ID
    const requestId = 
      (request.headers[REQUEST_ID_HEADER] as string) ||
      crypto.randomUUID();

    // Store on request for access in handlers
    request.correlationId = correlationId;
    request.requestId = requestId;

    // Set response headers
    reply.header(CORRELATION_HEADER, correlationId);
    reply.header(REQUEST_ID_HEADER, requestId);

    // Create child logger with correlation context
    const childLogger = logger.child({
      correlationId,
      requestId,
      method: request.method,
      url: request.url,
    });
    
    // Cast to satisfy Fastify's logger type requirement
    request.log = childLogger as unknown as FastifyBaseLogger;

    request.log.info({ 
      method: request.method, 
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, 'Request started');
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const durationMs = Date.now() - (request.startTime || Date.now());
    request.log.info({
      statusCode: reply.statusCode,
      durationMs,
      correlationId: request.correlationId,
      requestId: request.requestId,
    }, 'Request completed');
  });

  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const durationMs = Date.now() - (request.startTime || Date.now());
    request.log.error({
      err: error,
      statusCode: reply.statusCode,
      durationMs,
      correlationId: request.correlationId,
      requestId: request.requestId,
    }, 'Request errored');
  });
}

// Extend FastifyRequest type
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    requestId: string;
    startTime: number;
  }
}
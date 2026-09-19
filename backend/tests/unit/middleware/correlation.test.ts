import { describe, it, expect, vi, beforeEach } from 'vitest';
import { correlationIdMiddleware } from '@/middleware/correlation.js';
import { createMockRequest, createMockReply, createMockFastifyInstance } from '@tests/factories.js';

describe('Correlation ID Middleware', () => {
  let fastify: ReturnType<typeof createMockFastifyInstance>;
  let request: ReturnType<typeof createMockRequest>;
  let reply: ReturnType<typeof createMockReply>;

  beforeEach(() => {
    fastify = createMockFastifyInstance();
    request = createMockRequest();
    reply = createMockReply();
    
    correlationIdMiddleware(fastify);
  });

  it('should generate correlation ID when not provided', async () => {
    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    expect(request.correlationId).toBeDefined();
    expect(request.correlationId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(reply._getHeaders()['x-correlation-id']).toBe(request.correlationId);
  });

  it('should propagate existing correlation ID from header', async () => {
    const existingCorrelationId = 'existing-correlation-123';
    request.headers['x-correlation-id'] = existingCorrelationId;

    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    expect(request.correlationId).toBe(existingCorrelationId);
    expect(reply._getHeaders()['x-correlation-id']).toBe(existingCorrelationId);
  });

  it('should propagate existing request ID from header', async () => {
    const existingRequestId = 'existing-request-456';
    request.headers['x-request-id'] = existingRequestId;

    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    expect(request.requestId).toBe(existingRequestId);
    expect(reply._getHeaders()['x-request-id']).toBe(existingRequestId);
  });

  it('should generate request ID when not provided', async () => {
    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    expect(request.requestId).toBeDefined();
    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(reply._getHeaders()['x-request-id']).toBe(request.requestId);
  });

  it('should create child logger with correlation context', async () => {
    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    expect(request.log).toBeDefined();
    expect(request.log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: request.method,
        url: request.url,
        ip: request.ip,
      }),
      'Request started'
    );
  });

  it('should log request completion on response', async () => {
    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    const onResponseHook = fastify._hooks.onResponse[0];
    await onResponseHook(request, reply);

    expect(request.log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        correlationId: request.correlationId,
        requestId: request.requestId,
      }),
      'Request completed'
    );
  });

  it('should log request error', async () => {
    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    const onErrorHook = fastify._hooks.onError[0];
    const testError = new Error('Test error');
    await onErrorHook(request, reply, testError);

    expect(request.log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: testError,
        statusCode: 500,
        correlationId: request.correlationId,
        requestId: request.requestId,
      }),
      'Request errored'
    );
  });

  it('should prefer x-correlation-id over x-request-id for correlationId', async () => {
    request.headers['x-correlation-id'] = 'corr-id';
    request.headers['x-request-id'] = 'req-id';

    const onRequestHook = fastify._hooks.onRequest[0];
    await onRequestHook(request, reply);

    expect(request.correlationId).toBe('corr-id');
    expect(request.requestId).toBe('req-id');
  });
});

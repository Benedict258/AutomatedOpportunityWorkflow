import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { errorHandler, AppError, ProblemDetails } from '@/middleware/error.js';
import { createMockRequest, createMockReply, createMockFastifyInstance } from '@tests/factories.js';

describe('Error Handler Middleware', () => {
  let fastify: ReturnType<typeof createMockFastifyInstance>;
  let request: ReturnType<typeof createMockRequest>;
  let reply: ReturnType<typeof createMockReply>;

  beforeEach(() => {
    fastify = createMockFastifyInstance();
    request = createMockRequest();
    reply = createMockReply();
    vi.clearAllMocks();
    
    errorHandler(fastify);
  });

  const errorHandlerFn = () => {
    return vi.mocked(fastify.setErrorHandler).mock.calls[0][0];
  };

  it('should handle ZodError with validation error format', async () => {
    const zodError = new z.ZodError([
      { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'Required', path: ['name'] },
      { code: 'invalid_type', expected: 'string', received: 'number', message: 'Expected string', path: ['age'] },
    ]);

    request.requestId = 'req-123';
    request.correlationId = 'corr-123';

    const handler = errorHandlerFn();
    await handler(zodError, request, reply);

    expect(reply._getStatusCode()).toBe(400);
    expect(reply._getPayload()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          title: 'Validation Error',
          message: 'Request validation failed',
          status: 400,
          requestId: 'req-123',
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'name', code: 'too_small' }),
            expect.objectContaining({ field: 'age', code: 'invalid_type' }),
          ]),
        }),
      })
    );
  });

  it('should handle Fastify validation errors', async () => {
    const fastifyError = new Error('Validation failed');
    (fastifyError as any).validation = [
      { instancePath: '/body/name', message: 'Required', schemaPath: '#/properties/name/minLength' },
      { instancePath: '/body/email', message: 'Invalid email', schemaPath: '#/properties/email/format' },
    ];
    (fastifyError as any).statusCode = 400;

    request.requestId = 'req-123';

    const handler = errorHandlerFn();
    await handler(fastifyError, request, reply);

    expect(reply._getStatusCode()).toBe(400);
    expect(reply._getPayload()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          status: 400,
          requestId: 'req-123',
        }),
      })
    );
  });

  it('should handle known error codes with RFC 7807 format', async () => {
    const testError = new Error('User not found');
    (testError as any).statusCode = 404;
    (testError as any).code = 'NOT_FOUND';

    request.requestId = 'req-123';
    request.correlationId = 'corr-123';
    request.url = '/api/v1/users/123';

    const handler = errorHandlerFn();
    await handler(testError, request, reply);

    expect(reply._getStatusCode()).toBe(404);
    expect(reply._getPayload()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          type: 'https://automated-opportunity-workflow.com/errors/not_found',
          title: 'Not Found',
          status: 404,
          code: 'NOT_FOUND',
          requestId: 'req-123',
          instance: '/api/v1/users/123',
          detail: 'User not found',
        }),
      })
    );
  });

  it('should not expose internal error details for 5xx errors', async () => {
    const testError = new Error('Database connection failed');
    (testError as any).statusCode = 500;
    (testError as any).code = 'INTERNAL_ERROR';

    request.requestId = 'req-123';
    request.url = '/api/v1/opportunities';

    const handler = errorHandlerFn();
    await handler(testError, request, reply);

    expect(reply._getStatusCode()).toBe(500);
    expect(reply._getPayload()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          type: 'https://automated-opportunity-workflow.com/errors/internal_error',
          title: 'Internal Server Error',
          status: 500,
          code: 'INTERNAL_ERROR',
          requestId: 'req-123',
          instance: '/api/v1/opportunities',
          detail: 'An internal server error occurred',
        }),
      })
    );
  });

  it('should handle errors without statusCode defaulting to 500', async () => {
    const testError = new Error('Unknown error');

    request.requestId = 'req-123';

    const handler = errorHandlerFn();
    await handler(testError, request, reply);

    expect(reply._getStatusCode()).toBe(500);
    expect(reply._getPayload()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          status: 500,
        }),
      })
    );
  });

  it('should handle 404 for unknown routes', async () => {
    const notFoundHandler = vi.mocked(fastify.setNotFoundHandler).mock.calls[0][0];

    request.requestId = 'req-123';
    request.method = 'GET';
    request.url = '/api/v1/unknown';

    await notFoundHandler(request, reply);

    expect(reply._getStatusCode()).toBe(404);
    expect(reply._getPayload()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          title: 'Not Found',
          message: 'Route GET /api/v1/unknown not found',
          status: 404,
          requestId: 'req-123',
          instance: '/api/v1/unknown',
        }),
      })
    );
  });

  it('should log errors with correlation context', async () => {
    const testError = new Error('Test error');
    (testError as any).statusCode = 500;

    request.requestId = 'req-123';
    request.correlationId = 'corr-123';

    const handler = errorHandlerFn();
    await handler(testError, request, reply);

    expect(request.log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: testError,
        statusCode: 500,
        correlationId: 'corr-123',
        requestId: 'req-123',
      }),
      'Request error'
    );
  });
});

describe('AppError', () => {
  it('should create bad request error', () => {
    const error = AppError.badRequest('Invalid input', { field: 'name' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'name' });
  });

  it('should create unauthorized error', () => {
    const error = AppError.unauthorized('Token expired');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Token expired');
  });

  it('should create forbidden error', () => {
    const error = AppError.forbidden('Access denied');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should create not found error', () => {
    const error = AppError.notFound('Resource missing');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should create conflict error', () => {
    const error = AppError.conflict('Duplicate entry', { duplicateField: 'email' });
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ duplicateField: 'email' });
  });

  it('should create internal error', () => {
    const error = AppError.internal('Server error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('should create service unavailable error', () => {
    const error = AppError.serviceUnavailable('Maintenance');
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

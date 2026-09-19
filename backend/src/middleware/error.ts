import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export function errorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId || 'unknown';
    const correlationId = request.correlationId || 'unknown';

    // Log the error
    request.log.error({
      err: error,
      statusCode: error.statusCode || 500,
      correlationId,
      requestId,
    }, 'Request error');

    // Handle validation errors
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          title: 'Validation Error',
          message: 'Request validation failed',
          status: 400,
          requestId,
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        } as ProblemDetails,
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          title: 'Validation Error',
          message: 'Request validation failed',
          status: 400,
          requestId,
          details: error.validation.map((v) => ({
            field: v.instancePath || v.schemaPath,
            message: v.message,
            code: 'VALIDATION_ERROR',
          })),
        } as ProblemDetails,
      });
    }

    // Handle known error codes
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'INTERNAL_ERROR';

    const problemDetails: ProblemDetails = {
      type: `https://automated-opportunity-workflow.com/errors/${errorCode.toLowerCase()}`,
      title: getErrorTitle(errorCode),
      status: statusCode,
      code: errorCode,
      requestId,
      instance: request.url,
    };

    // Add detail for client errors (4xx)
    if (statusCode < 500) {
      problemDetails.detail = error.message;
    } else {
      // Don't expose internal error details for 5xx
      problemDetails.detail = 'An internal server error occurred';
    }

    reply.code(statusCode).send({ error: problemDetails });
  });

  fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        title: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        status: 404,
        requestId: request.requestId,
        instance: request.url,
      } as ProblemDetails,
    });
  });
}

function getErrorTitle(code: string): string {
  const titles: Record<string, string> = {
    VALIDATION_ERROR: 'Validation Error',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    NOT_FOUND: 'Not Found',
    CONFLICT: 'Conflict',
    RATE_LIMITED: 'Rate Limited',
    INTERNAL_ERROR: 'Internal Server Error',
    SERVICE_UNAVAILABLE: 'Service Unavailable',
    BAD_GATEWAY: 'Bad Gateway',
    GATEWAY_TIMEOUT: 'Gateway Timeout',
  };
  return titles[code] || 'Error';
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable'): AppError {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

export function validateBody<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.body = schema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        request.log.warn({ errors: error.errors }, 'Body validation failed');
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
              code: e.code,
            })),
            requestId: request.requestId,
          },
        });
        throw new Error('Validation error');
      }
      throw error;
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.params = schema.parse(request.params);
    } catch (error) {
      if (error instanceof ZodError) {
        request.log.warn({ errors: error.errors }, 'Params validation failed');
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL parameters validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
              code: e.code,
            })),
            requestId: request.requestId,
          },
        });
        throw new Error('Validation error');
      }
      throw error;
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.query = schema.parse(request.query);
    } catch (error) {
      if (error instanceof ZodError) {
        request.log.warn({ errors: error.errors }, 'Query validation failed');
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameters validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
              code: e.code,
            })),
            requestId: request.requestId,
          },
        });
        throw new Error('Validation error');
      }
      throw error;
    }
  };
}

export function validateHeaders<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.headers = schema.parse(request.headers);
    } catch (error) {
      if (error instanceof ZodError) {
        request.log.warn({ errors: error.errors }, 'Headers validation failed');
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Headers validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
              code: e.code,
            })),
            requestId: request.requestId,
          },
        });
        throw new Error('Validation error');
      }
      throw error;
    }
  };
}
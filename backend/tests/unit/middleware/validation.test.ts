import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery, validateHeaders } from '@/middleware/validation.js';
import { createMockRequest, createMockReply } from '@tests/factories.js';

describe('Validation Middleware', () => {
  let request: ReturnType<typeof createMockRequest>;
  let reply: ReturnType<typeof createMockReply>;

  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
    email: z.string().email(),
    tags: z.array(z.string()).optional(),
  });

  const testParamsSchema = z.object({
    id: z.string().uuid(),
    slug: z.string().min(1),
  });

  const testQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    sortBy: z.enum(['name', 'age', 'created']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  });

  const testHeadersSchema = z.object({
    'x-api-key': z.string().min(1),
    'x-correlation-id': z.string().uuid().optional(),
  });

  beforeEach(() => {
    request = createMockRequest();
    reply = createMockReply();
    vi.clearAllMocks();
  });

  describe('validateBody', () => {
    it('should accept valid body', async () => {
      request.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'senior'],
      };

      const middleware = validateBody(testSchema);
      await expect(middleware(request, reply)).resolves.not.toThrow();
      expect(request.body).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'senior'],
      });
    });

    it('should reject missing required field', async () => {
      request.body = {
        age: 30,
        email: 'john@example.com',
      };

      const middleware = validateBody(testSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
      expect(reply._getPayload()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Request body validation failed',
            details: expect.arrayContaining([
              expect.objectContaining({
                field: 'name',
              }),
            ]),
          }),
        })
      );
    });

    it('should reject invalid email format', async () => {
      request.body = {
        name: 'John Doe',
        age: 30,
        email: 'not-an-email',
      };

      const middleware = validateBody(testSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should reject negative age', async () => {
      request.body = {
        name: 'John Doe',
        age: -5,
        email: 'john@example.com',
      };

      const middleware = validateBody(testSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should reject non-array tags', async () => {
      request.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: 'not-an-array',
      };

      const middleware = validateBody(testSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should accept optional field omitted', async () => {
      request.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      const middleware = validateBody(testSchema);
      await expect(middleware(request, reply)).resolves.not.toThrow();
    });
  });

  describe('validateParams', () => {
    it('should accept valid params', async () => {
      request.params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-slug',
      };

      const middleware = validateParams(testParamsSchema);
      await expect(middleware(request, reply)).resolves.not.toThrow();
      expect(request.params).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-slug',
      });
    });

    it('should reject invalid UUID', async () => {
      request.params = {
        id: 'not-a-uuid',
        slug: 'test-slug',
      };

      const middleware = validateParams(testParamsSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should reject missing param', async () => {
      request.params = {
        slug: 'test-slug',
      };

      const middleware = validateParams(testParamsSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });
  });

  describe('validateQuery', () => {
    it('should accept valid query params', async () => {
      request.query = {
        page: '2',
        limit: '50',
        search: 'test',
        sortBy: 'age',
        sortOrder: 'desc',
      };

      const middleware = validateQuery(testQuerySchema);
      await expect(middleware(request, reply)).resolves.not.toThrow();
      expect(request.query).toEqual({
        page: 2,
        limit: 50,
        search: 'test',
        sortBy: 'age',
        sortOrder: 'desc',
      });
    });

    it('should apply defaults for optional params', async () => {
      request.query = {};

      const middleware = validateQuery(testQuerySchema);
      await expect(middleware(request, reply)).resolves.not.toThrow();
      expect(request.query).toEqual({
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      });
    });

    it('should reject invalid page number', async () => {
      request.query = {
        page: '0',
      };

      const middleware = validateQuery(testQuerySchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should reject limit over max', async () => {
      request.query = {
        limit: '200',
      };

      const middleware = validateQuery(testQuerySchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should reject invalid sortBy', async () => {
      request.query = {
        sortBy: 'invalid',
      };

      const middleware = validateQuery(testQuerySchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });
  });

  describe('validateHeaders', () => {
    it('should accept valid headers', async () => {
      request.headers = {
        'x-api-key': 'aow_test_key123',
        'x-correlation-id': '123e4567-e89b-12d3-a456-426614174000',
      };

      const middleware = validateHeaders(testHeadersSchema);
      await expect(middleware(request, reply)).resolves.not.toThrow();
    });

    it('should reject missing required header', async () => {
      request.headers = {
        'x-correlation-id': '123e4567-e89b-12d3-a456-426614174000',
      };

      const middleware = validateHeaders(testHeadersSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });

    it('should reject invalid correlation ID format', async () => {
      request.headers = {
        'x-api-key': 'aow_test_key123',
        'x-correlation-id': 'not-a-uuid',
      };

      const middleware = validateHeaders(testHeadersSchema);
      await expect(middleware(request, reply)).rejects.toThrow('Validation error');
      expect(reply._getStatusCode()).toBe(400);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { createSingleResponse, createListResponse, createErrorResponse } from '@/utils/api-envelope.js';
import { createMockRequest } from '@tests/factories.js';

describe('API Envelope Utilities', () => {
  describe('createSingleResponse', () => {
    it('should wrap data in envelope', () => {
      const data = { id: '123', name: 'Test' };
      const result = createSingleResponse(data);
      expect(result).toEqual({ data });
    });

    it('should handle null data', () => {
      const result = createSingleResponse(null);
      expect(result).toEqual({ data: null });
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const result = createSingleResponse(data);
      expect(result).toEqual({ data });
    });
  });

  describe('createListResponse', () => {
    const request = createMockRequest({
      url: '/api/test?filter=active',
      query: { filter: 'active' },
    });
    request.headers.host = 'localhost:3000';

    it('should create paginated response with links', () => {
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const result = createListResponse(data, 1, 2, 5, '/api/test', request);

      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
      expect(result.links).toEqual({
        first: 'http://localhost:3000/api/test?filter=active&page=1&limit=2',
        last: 'http://localhost:3000/api/test?filter=active&page=3&limit=2',
        next: 'http://localhost:3000/api/test?filter=active&page=2&limit=2',
      });
    });

    it('should include prev link on page > 1', () => {
      const data = [{ id: '3' }, { id: '4' }];
      const result = createListResponse(data, 2, 2, 5, '/api/test', request);

      expect(result.links?.prev).toBe('http://localhost:3000/api/test?filter=active&page=1&limit=2');
      expect(result.links?.next).toBe('http://localhost:3000/api/test?filter=active&page=3&limit=2');
    });

    it('should not include prev link on first page', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = createListResponse(data, 1, 2, 5, '/api/test', request);

      expect(result.links?.prev).toBeUndefined();
    });

    it('should not include next link on last page', () => {
      const data = [{ id: '5' }];
      const result = createListResponse(data, 3, 2, 5, '/api/test', request);

      expect(result.links?.next).toBeUndefined();
    });

    it('should handle single page', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const result = createListResponse(data, 1, 10, 2, '/api/test', request);

      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrev).toBe(false);
      expect(result.links?.next).toBeUndefined();
      expect(result.links?.prev).toBeUndefined();
    });

    it('should preserve other query params', () => {
      const requestWithParams = createMockRequest({
        url: '/api/test?filter=active&sort=desc',
        query: { filter: 'active', sort: 'desc' },
      });
      requestWithParams.headers.host = 'localhost:3000';

      const data = [{ id: '1' }];
      const result = createListResponse(data, 1, 10, 1, '/api/test', requestWithParams);

      expect(result.links?.first).toContain('filter=active');
      expect(result.links?.first).toContain('sort=desc');
    });

    it('should handle zero total', () => {
      const data: any[] = [];
      const result = createListResponse(data, 1, 20, 0, '/api/test', request);

      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(result.meta.hasNext).toBe(false);
    });
  });

  describe('createErrorResponse', () => {
    it('should create RFC 7807 compliant error response', () => {
      const result = createErrorResponse(
        'VALIDATION_ERROR',
        'Validation Error',
        'Invalid input',
        400,
        'req-123',
        '/api/test',
        [{ field: 'name', message: 'Required', code: 'too_small' }]
      );

      expect(result).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          title: 'Validation Error',
          message: 'Invalid input',
          status: 400,
          requestId: 'req-123',
          instance: '/api/test',
          details: [{ field: 'name', message: 'Required', code: 'too_small' }],
        },
      });
    });

    it('should handle optional details', () => {
      const result = createErrorResponse(
        'NOT_FOUND',
        'Not Found',
        'Resource not found',
        404,
        'req-123'
      );

      expect(result.error.details).toBeUndefined();
      expect(result.error.instance).toBeUndefined();
    });
  });
});

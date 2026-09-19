import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimitPlugin, authRateLimitPlugin, webhookRateLimitPlugin } from '@/middleware/rate-limit.js';
import { createMockFastifyInstance } from '@tests/factories.js';

describe('Rate Limit Middleware', () => {
  let fastify: ReturnType<typeof createMockFastifyInstance>;

  beforeEach(() => {
    fastify = createMockFastifyInstance();
    vi.clearAllMocks();
  });

  describe('rateLimitPlugin', () => {
    it('should register rate limiter with default config', async () => {
      await rateLimitPlugin(fastify);

      expect(fastify.register).toHaveBeenCalled();
      const registerCall = vi.mocked(fastify.register).mock.calls[0];
      expect(registerCall[0]).toBeDefined(); // The imported module
      
      const options = registerCall[1];
      expect(options.max).toBeDefined();
      expect(options.timeWindow).toBeDefined();
      expect(options.allowList).toContain('127.0.0.1');
      expect(options.allowList).toContain('::1');
      expect(options.keyGenerator).toBeDefined();
      expect(options.errorResponseBuilder).toBeDefined();
      expect(options.addHeaders).toEqual({
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'retry-after': true,
      });
      expect(options.hook).toBe('onRequest');
    });

    it('should use API key for rate limiting when present', async () => {
      await rateLimitPlugin(fastify);
      
      const options = vi.mocked(fastify.register).mock.calls[0][1];
      const mockRequest = { headers: { 'x-api-key': 'test-key' }, ip: '192.168.1.1' };
      
      const key = options.keyGenerator(mockRequest);
      expect(key).toBe('apikey:test-key');
    });

    it('should use IP for rate limiting when no API key', async () => {
      await rateLimitPlugin(fastify);
      
      const options = vi.mocked(fastify.register).mock.calls[0][1];
      const mockRequest = { headers: {}, ip: '192.168.1.1' };
      
      const key = options.keyGenerator(mockRequest);
      expect(key).toBe('192.168.1.1');
    });

    it('should build error response with RFC 7807 format', async () => {
      await rateLimitPlugin(fastify);
      
      const options = vi.mocked(fastify.register).mock.calls[0][1];
      const mockRequest = { requestId: 'req-123' };
      const opts = { max: 100, timeWindow: 60000 };
      
      const errorResponse = options.errorResponseBuilder(opts, mockRequest);
      expect(errorResponse).toEqual({
        error: {
          code: 'RATE_LIMITED',
          title: 'Rate Limited',
          message: 'Rate limit exceeded. Max 100 requests per 60s.',
          status: 429,
          requestId: 'req-123',
          retryAfter: 60,
        },
      });
    });
  });

  describe('authRateLimitPlugin', () => {
    it('should register stricter rate limiter for auth endpoints', async () => {
      await authRateLimitPlugin(fastify);

      expect(fastify.register).toHaveBeenCalled();
      const options = vi.mocked(fastify.register).mock.calls[0][1];
      expect(options.max).toBe(10);
      expect(options.timeWindow).toBe(60000);
      expect(options.keyGenerator).toBeDefined();
    });

    it('should use IP as key for auth rate limiting', async () => {
      await authRateLimitPlugin(fastify);
      
      const options = vi.mocked(fastify.register).mock.calls[0][1];
      const mockRequest = { ip: '192.168.1.1' };
      
      const key = options.keyGenerator(mockRequest);
      expect(key).toBe('192.168.1.1');
    });
  });

  describe('webhookRateLimitPlugin', () => {
    it('should register permissive rate limiter for webhooks', async () => {
      await webhookRateLimitPlugin(fastify);

      expect(fastify.register).toHaveBeenCalled();
      const options = vi.mocked(fastify.register).mock.calls[0][1];
      expect(options.max).toBe(1000);
      expect(options.timeWindow).toBe(60000);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkIdempotency, storeIdempotency, hashRequest, idempotencyMiddleware } from '@/utils/idempotency.js';
import { createMockRequest, createMockReply } from '@tests/factories.js';
import { getPool } from '@/db/connection.js';

vi.mock('@/db/connection.js');
vi.mock('@/config/index.js', () => ({
  config: {
    idempotency: { ttlMs: 86400000 },
  },
}));
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Idempotency Utilities', () => {
  let mockPool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = {
      query: vi.fn(),
    };
    vi.mocked(getPool).mockReturnValue(mockPool);
  });

  describe('hashRequest', () => {
    it('should generate consistent hash for same input', () => {
      const hash1 = hashRequest('POST', '/api/test', { name: 'test' });
      const hash2 = hashRequest('POST', '/api/test', { name: 'test' });
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex
    });

    it('should generate different hash for different method', () => {
      const hash1 = hashRequest('POST', '/api/test', { name: 'test' });
      const hash2 = hashRequest('PUT', '/api/test', { name: 'test' });
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different URL', () => {
      const hash1 = hashRequest('POST', '/api/test', { name: 'test' });
      const hash2 = hashRequest('POST', '/api/other', { name: 'test' });
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different body', () => {
      const hash1 = hashRequest('POST', '/api/test', { name: 'test1' });
      const hash2 = hashRequest('POST', '/api/test', { name: 'test2' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('checkIdempotency', () => {
    it('should return null when no matching key', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await checkIdempotency('key-123', 'POST', '/api/test', { name: 'test' });

      expect(result).toBeNull();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT response_status, response_body'),
        ['key-123', expect.any(String)]
      );
    });

    it('should return cached response when key matches', async () => {
      const cachedResponse = { status: 201, body: { id: 'created-123' } };
      mockPool.query.mockResolvedValue({
        rows: [{
          response_status: 201,
          response_body: JSON.stringify(cachedResponse.body),
        }],
      });

      const result = await checkIdempotency('key-123', 'POST', '/api/test', { name: 'test' });

      expect(result).toEqual(cachedResponse);
    });

    it('should return null on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const result = await checkIdempotency('key-123', 'POST', '/api/test', { name: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('storeIdempotency', () => {
    it('should store idempotency key with TTL', async () => {
      mockPool.query.mockResolvedValue({});

      await storeIdempotency('key-123', 'POST', '/api/test', { name: 'test' }, 201, { id: 'created' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO idempotency_keys'),
        [
          'key-123',
          expect.any(String), // request hash
          201,
          JSON.stringify({ id: 'created' }),
          expect.any(Date), // expires_at
        ]
      );
    });

    it('should handle database error gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(storeIdempotency('key-123', 'POST', '/api/test', {}, 201, {})).resolves.not.toThrow();
    });
  });

  describe('idempotencyMiddleware', () => {
    it('should skip non-mutating methods', async () => {
      const request = createMockRequest({ method: 'GET' });
      const reply = createMockReply();
      
      const middleware = idempotencyMiddleware();
      await middleware(request, reply);
      
      // Should not check or store idempotency
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should skip when no idempotency key', async () => {
      const request = createMockRequest({ method: 'POST', headers: {} });
      const reply = createMockReply();
      
      const middleware = idempotencyMiddleware();
      await middleware(request, reply);
      
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should return cached response when key exists', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'idempotency-key': 'key-123' },
        body: { name: 'test' },
      });
      const reply = createMockReply();
      
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            response_status: 201,
            response_body: JSON.stringify({ id: 'created' }),
          }],
        }); // checkIdempotency
      
      const middleware = idempotencyMiddleware();
      await middleware(request, reply);
      
      expect(reply._getStatusCode()).toBe(201);
      expect(reply._getHeaders()['x-idempotency-replay']).toBe('true');
    });

    it('should store response after successful request', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'idempotency-key': 'key-123' },
        body: { name: 'test' },
      });
      const reply = createMockReply();
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - no cache
        .mockResolvedValueOnce({}); // storeIdempotency
      
      const middleware = idempotencyMiddleware();
      await middleware(request, reply);
      
      // Simulate response
      reply._getPayload(); // Get the send function
      reply.send({ id: 'created' });
      
      // Give time for the async store to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should not store on 5xx errors', async () => {
      const request = createMockRequest({
        method: 'POST',
        headers: { 'idempotency-key': 'key-123' },
        body: { name: 'test' },
      });
      const reply = createMockReply();
      
      mockPool.query.mockResolvedValue({ rows: [] }); // checkIdempotency
      
      const middleware = idempotencyMiddleware();
      await middleware(request, reply);
      
      // Simulate 500 response
      reply.code(500).send({ error: 'Internal error' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should only have called check, not store
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });
});

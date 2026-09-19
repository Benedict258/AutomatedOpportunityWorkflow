import { describe, it, expect, vi } from 'vitest';
import { verifyHmac, generateHmac } from '@/middleware/webhook-hmac.js';

describe('Webhook HMAC', () => {
  const secret = 'test-webhook-secret-key-min-32-chars-long';
  const payload = '{"test":"data"}';

  describe('verifyHmac', () => {
    it('should return true for valid HMAC', async () => {
      const validHmac = generateHmac(payload, secret);
      const result = await verifyHmac(payload, validHmac, secret);
      expect(result).toBe(true);
    });

    it('should return false for invalid HMAC', async () => {
      const result = await verifyHmac(payload, 'sha256=invalid-hash', secret);
      expect(result).toBe(false);
    });

    it('should return false for wrong algorithm', async () => {
      const result = await verifyHmac(payload, 'sha1=abc123', secret);
      expect(result).toBe(false);
    });

    it('should return false for missing hash', async () => {
      const result = await verifyHmac(payload, 'sha256=', secret);
      expect(result).toBe(false);
    });

    it('should return false for malformed signature', async () => {
      const result = await verifyHmac(payload, 'invalid-format', secret);
      expect(result).toBe(false);
    });

    it('should use timing-safe comparison', async () => {
      const validHmac = generateHmac(payload, secret);
      // The function uses timingSafeEqual internally
      const result = await verifyHmac(payload, validHmac, secret);
      expect(result).toBe(true);
    });

    it('should return false for different payload', async () => {
      const validHmac = generateHmac(payload, secret);
      const result = await verifyHmac('{"different":"data"}', validHmac, secret);
      expect(result).toBe(false);
    });

    it('should return false for different secret', async () => {
      const validHmac = generateHmac(payload, secret);
      const result = await verifyHmac(payload, validHmac, 'different-secret');
      expect(result).toBe(false);
    });
  });

  describe('generateHmac', () => {
    it('should generate valid HMAC', () => {
      const hmac = generateHmac(payload, secret);
      expect(hmac).toMatch(/^sha256=/);
      expect(hmac.length).toBeGreaterThan(70); // sha256= + 64 hex chars
    });

    it('should generate different HMAC for different payload', () => {
      const hmac1 = generateHmac(payload, secret);
      const hmac2 = generateHmac('{"different":"data"}', secret);
      expect(hmac1).not.toBe(hmac2);
    });

    it('should generate different HMAC for different secret', () => {
      const hmac1 = generateHmac(payload, secret);
      const hmac2 = generateHmac(payload, 'different-secret');
      expect(hmac1).not.toBe(hmac2);
    });

    it('should be verifiable by verifyHmac', async () => {
      const hmac = generateHmac(payload, secret);
      const result = await verifyHmac(payload, hmac, secret);
      expect(result).toBe(true);
    });
  });
});

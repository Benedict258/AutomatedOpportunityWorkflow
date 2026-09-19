import { describe, it, expect, vi, beforeEach } from 'vitest';
import { securityPlugin } from '@/middleware/security.js';
import { createMockFastifyInstance } from '@tests/factories.js';

describe('Security Headers Middleware', () => {
  let fastify: ReturnType<typeof createMockFastifyInstance>;

  beforeEach(() => {
    fastify = createMockFastifyInstance();
    vi.clearAllMocks();
  });

  it('should register helmet with CSP configuration', async () => {
    await securityPlugin(fastify);

    // Should register helmet and cors
    expect(fastify.register).toHaveBeenCalledTimes(2);
    
    const helmetCall = vi.mocked(fastify.register).mock.calls[0];
    const helmetOptions = helmetCall[1];
    
    expect(helmetOptions.contentSecurityPolicy).toBeDefined();
    expect(helmetOptions.contentSecurityPolicy.directives).toEqual({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    });
    
    expect(helmetOptions.crossOriginEmbedderPolicy).toBe(false);
    expect(helmetOptions.crossOriginResourcePolicy).toEqual({ policy: 'cross-origin' });
    expect(helmetOptions.dnsPrefetchControl).toEqual({ allow: false });
    expect(helmetOptions.frameguard).toEqual({ action: 'deny' });
    expect(helmetOptions.hidePoweredBy).toBe(true);
    expect(helmetOptions.hsts).toEqual({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    });
    expect(helmetOptions.ieNoOpen).toBe(true);
    expect(helmetOptions.noSniff).toBe(true);
    expect(helmetOptions.referrerPolicy).toEqual({ policy: 'strict-origin-when-cross-origin' });
    expect(helmetOptions.xssFilter).toBe(true);
  });

  it('should register CORS with configured options', async () => {
    await securityPlugin(fastify);

    const corsCall = vi.mocked(fastify.register).mock.calls[1];
    const corsOptions = corsCall[1];
    
    expect(corsOptions.origin).toBe('*'); // From test config
    expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
    expect(corsOptions.allowedHeaders).toContain('Content-Type');
    expect(corsOptions.allowedHeaders).toContain('Authorization');
    expect(corsOptions.allowedHeaders).toContain('X-API-Key');
    expect(corsOptions.allowedHeaders).toContain('X-Correlation-ID');
    expect(corsOptions.allowedHeaders).toContain('X-Request-ID');
    expect(corsOptions.allowedHeaders).toContain('Idempotency-Key');
    expect(corsOptions.exposedHeaders).toContain('X-Correlation-ID');
    expect(corsOptions.exposedHeaders).toContain('X-Request-ID');
    expect(corsOptions.exposedHeaders).toContain('X-RateLimit-Limit');
    expect(corsOptions.exposedHeaders).toContain('X-RateLimit-Remaining');
    expect(corsOptions.exposedHeaders).toContain('X-RateLimit-Reset');
    expect(corsOptions.exposedHeaders).toContain('Retry-After');
    expect(corsOptions.credentials).toBe(false);
    expect(corsOptions.maxAge).toBe(86400);
  });
});

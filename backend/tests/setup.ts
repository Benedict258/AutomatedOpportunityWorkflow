import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { config } from '../src/config/index.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.LOG_PRETTY = 'false';

// Mock environment variables for testing
vi.mock('../src/config/env.js', () => ({
  loadEnv: vi.fn(),
  getEnv: () => ({
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3000,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    DATABASE_POOL_SIZE: 5,
    DATABASE_SSL: 'false',
    JWT_SECRET: 'test-secret-key-for-testing-only-min-32-chars',
    JWT_ISSUER: 'test-issuer',
    JWT_AUDIENCE: 'test-audience',
    JWT_EXPIRES_IN: '1h',
    API_KEY_HEADER: 'X-API-Key',
    API_KEY_PREFIX: 'aow_',
    WEBHOOK_HMAC_SECRET: 'test-webhook-secret-key-min-32-chars-long',
    WEBHOOK_HMAC_HEADER: 'X-Webhook-Signature',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'silent',
    LOG_PRETTY: 'false',
    SWAGGER_ENABLED: 'false',
    SWAGGER_PATH: '/docs',
    IDEMPOTENCY_TTL_MS: 86400000,
    HEALTH_CHECK_TIMEOUT_MS: 5000,
  }),
}));

// Mock database pool for unit tests
vi.mock('../src/db/connection.js', () => {
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    getPool: () => mockPool,
    executeQuery: vi.fn(),
    executeTransaction: vi.fn(),
    closePool: vi.fn(),
    checkConnection: vi.fn().mockResolvedValue(true),
    runMigrations: vi.fn().mockResolvedValue(undefined),
  };
});

// Also mock the @ alias version
vi.mock('@/db/connection.js', () => {
  const mockPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };

  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  return {
    getPool: () => mockPool,
    executeQuery: vi.fn(),
    executeTransaction: vi.fn(),
    closePool: vi.fn(),
    checkConnection: vi.fn().mockResolvedValue(true),
    runMigrations: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock pino logger to reduce noise in tests
vi.mock('../src/utils/logger.js', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return {
    logger: mockLogger,
    createChildLogger: vi.fn().mockReturnValue(mockLogger),
  };
});

// Global test utilities
declare global {
  namespace Vi {
    interface Jest {
      mockReset(): void;
    }
  }
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
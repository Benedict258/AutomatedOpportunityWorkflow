import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createChildLogger } from '@/utils/logger.js';

vi.mock('@/config/index.js', () => ({
  config: {
    logging: {
      level: 'silent',
      pretty: false,
    },
    server: {
      nodeEnv: 'test',
    },
  },
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have standard log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('should have child method', () => {
    expect(typeof logger.child).toBe('function');
  });

  it('should create child logger with bindings', () => {
    const child = logger.child({ correlationId: 'test-123', userId: 'user-456' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('createChildLogger should return child logger', () => {
    const child = createChildLogger({ requestId: 'req-123' });
    expect(child).toBeDefined();
  });
});

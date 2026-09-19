import { describe, it, expect, vi, beforeEach } from 'vitest';

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('@/utils/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('@/db/connection.js', () => ({
  closePool: vi.fn().mockResolvedValue(undefined),
}));

const { setupGracefulShutdown, isShutdownInProgress } = await import('@/utils/graceful-shutdown.js');

describe('Graceful Shutdown', () => {
  let mockServer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {
      close: vi.fn((callback: (err?: Error) => void) => callback()),
      listening: true,
    };
  });

  it('should export setupGracefulShutdown', () => {
    expect(typeof setupGracefulShutdown).toBe('function');
  });

  it('should export isShutdownInProgress', () => {
    expect(typeof isShutdownInProgress).toBe('function');
  });

  it('should register signal handlers when setup called', () => {
    const onSpy = vi.spyOn(process, 'on');
    setupGracefulShutdown(mockServer);
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('should report not in shutdown initially', () => {
    expect(isShutdownInProgress()).toBe(false);
  });
});

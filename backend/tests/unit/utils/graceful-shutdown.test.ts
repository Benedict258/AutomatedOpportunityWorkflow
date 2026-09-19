import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupGracefulShutdown, isShutdownInProgress } from '@/utils/graceful-shutdown.js';
import { closePool } from '@/db/connection.js';

vi.mock('@/db/connection.js');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

describe('Graceful Shutdown', () => {
  let mockServer: any;
  let originalExit: typeof process.exit;
  let exitMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {
      close: vi.fn((callback: (err?: Error) => void) => callback()),
    };
    vi.mocked(closePool).mockResolvedValue(undefined);
    
    originalExit = process.exit;
    exitMock = vi.fn();
    process.exit = exitMock as any;
  });

  afterEach(() => {
    process.exit = originalExit;
    // Reset the module state
    vi.resetModules();
  });

  it('should setup signal handlers', () => {
    setupGracefulShutdown(mockServer);
    
    // Check that handlers are registered
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
    expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);
    expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
  });

  it('should return false initially for shutdown status', () => {
    expect(isShutdownInProgress()).toBe(false);
  });

  it('should initiate shutdown on SIGTERM', async () => {
    setupGracefulShutdown(mockServer);
    
    // Emit SIGTERM
    process.emit('SIGTERM');
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockServer.close).toHaveBeenCalled();
    expect(closePool).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should initiate shutdown on SIGINT', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('SIGINT');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockServer.close).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should handle server close error', async () => {
    mockServer.close = vi.fn((callback: (err?: Error) => void) => callback(new Error('Close failed')));
    setupGracefulShutdown(mockServer);
    
    process.emit('SIGTERM');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(exitMock).toHaveBeenCalledWith(0); // Still exits 0 after logging error
  });

  it('should force exit on second shutdown signal', async () => {
    setupGracefulShutdown(mockServer);
    
    // First signal
    process.emit('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Second signal during shutdown
    process.emit('SIGTERM');
    
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle uncaughtException', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('uncaughtException', new Error('Uncaught'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle unhandledRejection', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('unhandledRejection', new Error('Rejection'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});

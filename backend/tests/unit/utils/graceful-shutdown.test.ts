import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupGracefulShutdown, shutdown } from '@/utils/graceful-shutdown.js';

describe('Graceful Shutdown', () => {
  let mockServer: any;
  let exitMock: any;
  let loggerMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockServer = {
      close: vi.fn((callback: (err?: Error) => void) => callback()),
      listening: true,
    };

    loggerMock = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    vi.mock('@/utils/logger.js', () => ({
      logger: loggerMock,
    }));

    exitMock = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register signal handlers', () => {
    setupGracefulShutdown(mockServer);
    
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
    expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);
    expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
  });

  it('should handle SIGTERM', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('SIGTERM');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(loggerMock.info).toHaveBeenCalledWith({ signal: 'SIGTERM' }, 'Received signal, starting graceful shutdown');
    expect(mockServer.close).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should handle SIGINT', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('SIGINT');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(loggerMock.info).toHaveBeenCalledWith({ signal: 'SIGINT' }, 'Received signal, starting graceful shutdown');
  });

  it('should handle server close error', async () => {
    const errorServer = {
      close: vi.fn((callback: (err?: Error) => void) => callback(new Error('Close failed'))),
      listening: true,
    };
    
    setupGracefulShutdown(errorServer);
    
    process.emit('SIGTERM');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Error closing server'
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle uncaughtException', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('uncaughtException', new Error('Uncaught'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Uncaught exception'
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle unhandledRejection', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('unhandledRejection', new Error('Rejection'));
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Unhandled rejection'
    );
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should not double shutdown', async () => {
    setupGracefulShutdown(mockServer);
    
    process.emit('SIGTERM');
    process.emit('SIGINT');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockServer.close).toHaveBeenCalledTimes(1);
  });
});
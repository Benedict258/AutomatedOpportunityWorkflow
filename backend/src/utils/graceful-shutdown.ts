import { closePool } from '../db/connection.js';
import { logger } from './logger.js';

let isShuttingDown = false;
let server: { close: (callback: (err?: Error) => void) => void } | null = null;

export function setupGracefulShutdown(
  httpServer: { close: (callback: (err?: Error) => void) => void }
): void {
  server = httpServer;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown initiated');

    // Stop accepting new connections
    if (server) {
      logger.info('Closing HTTP server');
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) {
            logger.error({ err }, 'Error closing HTTP server');
            reject(err);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }

    // Close database connections
    logger.info('Closing database pool');
    await closePool();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    shutdown('unhandledRejection').catch(() => process.exit(1));
  });
}

export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}
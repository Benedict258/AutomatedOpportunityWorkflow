import pino from 'pino';
import { config } from '../config/index.js';

const logConfig = config.logging;

const transport = logConfig.pretty
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: logConfig.level,
  transport,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'automated-opportunity-workflow',
    environment: config.server.nodeEnv,
  },
});

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
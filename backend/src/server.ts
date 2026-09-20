import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { runMigrations } from './db/migrations.js';
import { registerRoutes } from './routes/index.js';
import { correlationIdMiddleware } from './middleware/correlation.js';
import { errorHandler } from './middleware/error.js';
import { securityPlugin } from './middleware/security.js';
import { rateLimitPlugin } from './middleware/rate-limit.js';
import { idempotencyMiddleware } from './utils/idempotency.js';
import { setupGracefulShutdown } from './utils/graceful-shutdown.js';

export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
    disableRequestLogging: true,
    bodyLimit: 1048576, // 1MB
  });

  // Register core plugins
  await fastify.register(securityPlugin);
  await fastify.register(rateLimitPlugin);

  // Register middleware
  correlationIdMiddleware(fastify);
  errorHandler(fastify);
  
  // Idempotency middleware for mutating endpoints
  fastify.addHook('onRequest', idempotencyMiddleware());

  // Request timing
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  // Register routes
  await registerRoutes(fastify);

  // Swagger documentation
  if (config.swagger.enabled) {
    await fastify.register(import('@fastify/swagger'), {
      openapi: {
        info: {
          title: 'Automated Opportunity Workflow API',
          description: 'REST API for Automated Opportunity Intelligence System',
          version: '1.0.0',
        },
        servers: [
          { url: `http://${config.server.host}:${config.server.port}`, description: 'Development server' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
            apiKey: {
              type: 'apiKey',
              in: 'header',
              name: config.apiKey.header,
            },
          },
        },
        security: [
          { bearerAuth: [] },
          { apiKey: [] },
        ],
      },
    });

    await fastify.register(import('@fastify/swagger-ui'), {
      routePrefix: config.swagger.path,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  }

  return fastify;
}

export async function startServer(): Promise<FastifyInstance> {
  const fastify = await buildServer();

  // Run database migrations on startup
  logger.info('Running database migrations...');
  await runMigrations();
  logger.info('Migrations completed');

  // Setup graceful shutdown
  setupGracefulShutdown(fastify.server);

  // Start server
  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    logger.info({ 
      port: config.server.port, 
      host: config.server.host,
      env: config.server.nodeEnv,
    }, 'Server started successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }

  return fastify;
}

// Start if this is the main module
const isMainModule = require.main === module;
if (isMainModule) {
  startServer().catch((err) => {
    logger.error({ err }, 'Server startup failed');
    process.exit(1);
  });
}
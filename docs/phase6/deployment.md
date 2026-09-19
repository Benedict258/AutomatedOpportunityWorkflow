# Phase 6 Deployment & Runtime Audit

**Audit Date:** 2026-09-18  
**Auditor:** Subagent F - Deployment & Runtime Auditor  
**Project:** Automated Opportunity Workflow  
**Current Phase:** Phase 1, Step 1 (Foundation Only)

---

## Executive Summary

The backend **does not have a deployable server entrypoint**. The `backend/src/` directory contains only intelligence modules (matching, explanation, embedding, evaluation) with no HTTP server, no API routes, no health/readiness endpoints, no graceful shutdown handling, and no production build configuration.

This document serves as both an audit of the current state and a specification for what must be implemented before the backend can be deployed to production.

---

## 1. Server Entrypoint (`backend/src/index.ts`)

### Current State: ❌ **MISSING**

No `backend/src/index.ts` exists. The backend workspace has no `package.json`, no dependencies, and no scripts.

### Required Implementation

```typescript
// backend/src/index.ts
import 'dotenv/config';
import { createServer } from './server';
import { logger } from './utils/logger';
import { shutdown } from './utils/graceful-shutdown';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  try {
    const server = await createServer();
    
    // Graceful shutdown handling
    const shutdownHandler = shutdown(server);
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    
    server.listen({ port: PORT, host: HOST }, (err, address) => {
      if (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
      }
      logger.info({ address }, 'Server listening');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize server');
    process.exit(1);
  }
}

main();
```

### Required Dependencies

```json
// backend/package.json
{
  "name": "backend",
  "private": true,
  "version": "0.1.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/helmet": "^11.1.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/rate-limit": "^8.0.0",
    "@fastify/sensible": "^5.5.0",
    "pino": "^8.16.0",
    "pino-pretty": "^10.2.0",
    "zod": "^3.22.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "tsx": "^4.6.0",
    "eslint": "^8.56.0"
  }
}
```

---

## 2. Process Startup & Port Configuration

### Current State: ⚠️ **PARTIAL** (Defined in `.env.example` only)

| Config | Current Value | Source |
|--------|---------------|--------|
| PORT | 3001 | `.env.example` |
| HOST | Not configured | — |
| NODE_ENV | development | `.env.example` |

### Required Configuration

```typescript
// backend/src/config/index.ts
import { z } from 'zod';

const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Frontend URL for CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  
  // Shutdown
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(30000),
});

export const config = configSchema.parse(process.env);
export type Config = z.infer<typeof configSchema>;
```

---

## 3. Health & Readiness Endpoints

### Current State: ❌ **MISSING**

No health or readiness endpoints exist.

### Required Implementation

```typescript
// backend/src/routes/health.ts
import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { checkDatabaseConnection } from '../db/connection';

export async function healthRoutes(app: FastifyInstance) {
  // Liveness probe - process is alive
  app.get('/health/live', async () => ({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
  }));

  // Readiness probe - ready to serve traffic
  app.get('/health/ready', async (request, reply) => {
    const checks = {
      database: false,
      memory: false,
    };
    
    try {
      checks.database = await checkDatabaseConnection();
      checks.memory = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9;
      
      const ready = Object.values(checks).every(v => v);
      
      return reply.code(ready ? 200 : 503).send({
        status: ready ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    } catch (error) {
      return reply.code(503).send({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Detailed health info (protected in production)
  app.get('/health', { 
    config: { 
      rateLimit: { max: 10, timeWindow: 60000 } 
    } 
  }, async () => ({
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '0.1.0',
    nodeVersion: process.version,
  }));
}
```

### Kubernetes Probe Configuration

```yaml
# k8s/deployment.yaml (reference)
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## 4. Graceful Shutdown Handling

### Current State: ❌ **MISSING**

No graceful shutdown implementation exists.

### Required Implementation

```typescript
// backend/src/utils/graceful-shutdown.ts
import { FastifyInstance } from 'fastify';
import { logger } from './logger';
import { config } from '../config';

interface ShutdownContext {
  server: FastifyInstance;
  startTime: number;
  connections: Set<any>;
}

const shutdownContext: ShutdownContext = {
  server: null as any,
  startTime: Date.now(),
  connections: new Set(),
};

export function registerConnection(socket: any) {
  shutdownContext.connections.add(socket);
  socket.on('close', () => shutdownContext.connections.delete(socket));
}

export function createGracefulShutdown(server: FastifyInstance) {
  shutdownContext.server = server;
  shutdownContext.startTime = Date.now();
  
  return async (signal: string) => {
    const shutdownStart = Date.now();
    logger.info({ signal, uptime: process.uptime() }, 'Shutdown signal received');
    
    // Stop accepting new connections
    await server.close();
    logger.info('HTTP server closed');
    
    // Close existing connections with timeout
    const forceCloseTimeout = setTimeout(() => {
      logger.warn('Forced shutdown timeout reached, closing remaining connections');
      shutdownContext.connections.forEach(socket => socket.destroy());
    }, config.SHUTDOWN_TIMEOUT_MS);
    
    // Wait for connections to drain
    while (shutdownContext.connections.size > 0) {
      logger.info({ remaining: shutdownContext.connections.size }, 'Waiting for connections to close');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    clearTimeout(forceCloseTimeout);
    
    // Close database connections
    await closeDatabaseConnections();
    logger.info('Database connections closed');
    
    // Close model services
    await closeModelServices();
    logger.info('Model services closed');
    
    const shutdownDuration = Date.now() - shutdownStart;
    logger.info({ shutdownDurationMs: shutdownDuration }, 'Graceful shutdown complete');
    
    process.exit(0);
  };
}

async function closeDatabaseConnections() {
  // Implement based on database client (pg, prisma, etc.)
  // await pool.end();
}

async function closeModelServices() {
  // Implement model service cleanup
  // await modelService.shutdown();
}
```

### Server Connection Tracking

```typescript
// In server.ts
import { registerConnection } from './utils/graceful-shutdown';

server.addHook('onRequest', (request, reply, done) => {
  registerConnection(request.raw);
  done();
});
```

---

## 5. Environment Configuration

### Current State: ⚠️ **PARTIAL** (`.env.example` exists)

### Current `.env.example` Analysis

| Variable | Status | Notes |
|----------|--------|-------|
| NODE_ENV | ✅ | Default: development |
| PORT | ✅ | Default: 3001 |
| FRONTEND_URL | ✅ | For CORS |
| DATABASE_URL | ✅ | PostgreSQL connection string |
| POSTGRES_USER/PASSWORD/DB | ✅ | For docker-compose |
| LOG_LEVEL | ✅ | Default: info |
| LLM Model Slots | ✅ | Placeholders for future phases |
| AWS/OPENAI Keys | ⚠️ | Commented out |

### Required Production `.env` Template

```bash
# ===========================================
# PRODUCTION ENVIRONMENT VARIABLES
# ===========================================
# Copy to .env.production and fill ALL values
# NEVER commit .env.production to version control
# ===========================================

# Application
NODE_ENV=production
APP_NAME=AutomatedOpportunityWorkflow
PORT=3001
HOST=0.0.0.0
FRONTEND_URL=https://app.yourdomain.com

# Database - REQUIRED
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
POSTGRES_USER=prod_user
POSTGRES_PASSWORD=CHANGE_ME_SECURE_PASSWORD
POSTGRES_DB=opportunity_intelligence

# Logging
LOG_LEVEL=info
LOG_PRETTY=false

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
SHUTDOWN_TIMEOUT_MS=30000

# LLM Models - REQUIRED for intelligence pipeline
EXTRACTION_MODEL=nemotron-3-ultra
CLASSIFICATION_MODEL=nemotron-3-ultra
MATCHING_MODEL=nemotron-3-ultra
REASONING_MODEL=nemotron-3-ultra
EMBEDDING_MODEL=text-embedding-3-large
RERANKING_MODEL=nemotron-3-ultra

# API Keys - REQUIRED
NVIDIA_API_KEY=your_nvidia_key
OPENAI_API_KEY=your_openai_key

# Optional: Cloud Provider
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1

# Optional: Monitoring
# SENTRY_DSN=
# DATADOG_API_KEY=
```

### Configuration Validation

```typescript
// backend/src/config/validation.ts
import { config } from './index';

export function validateProductionConfig(): void {
  if (config.NODE_ENV === 'production') {
    const required = [
      'DATABASE_URL',
      'POSTGRES_PASSWORD',
      'NVIDIA_API_KEY',
      'OPENAI_API_KEY',
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(
        `Production deployment missing required environment variables: ${missing.join(', ')}`
      );
    }
    
    // Warn about defaults
    if (process.env.POSTGRES_PASSWORD === 'changeme') {
      console.warn('⚠️  WARNING: Using default POSTGRES_PASSWORD in production!');
    }
  }
}
```

---

## 6. Docker Configuration

### Current State: ⚠️ **PARTIAL** (docker-compose.yml for PostgreSQL only)

### Current `docker-compose.yml`

```yaml
# Only PostgreSQL service defined
services:
  postgres:
    image: pgvector/pgvector:pg16
    # ... healthcheck configured
```

### Required Multi-Service Docker Setup

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/

RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build --workspace=backend

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/node_modules ./shared/node_modules

USER fastify

EXPOSE 3001

ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml (production)
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: opportunity_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    container_name: opportunity_backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      PORT: 3001
      HOST: 0.0.0.0
      FRONTEND_URL: ${FRONTEND_URL}
      LOG_LEVEL: info
      # LLM Keys
      NVIDIA_API_KEY: ${NVIDIA_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      # Model configuration
      EXTRACTION_MODEL: ${EXTRACTION_MODEL}
      CLASSIFICATION_MODEL: ${CLASSIFICATION_MODEL}
      MATCHING_MODEL: ${MATCHING_MODEL}
      REASONING_MODEL: ${REASONING_MODEL}
      EMBEDDING_MODEL: ${EMBEDDING_MODEL}
      RERANKING_MODEL: ${RERANKING_MODEL}
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/health/ready"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
    restart: unless-stopped

volumes:
  pgdata:
```

### Docker Ignore

```dockerignore
# backend/.dockerignore
node_modules
dist
*.log
.env
.env.*
!.env.example
*.test.ts
*.spec.ts
coverage
.nyc_output
.git
.github
.vscode
*.md
!README.md
```

---

## 7. Production Build Script

### Current State: ❌ **MISSING**

No backend build script exists. Root `package.json` has `"build": "npm run build --workspaces"` but backend has no package.json.

### Required Build Configuration

```json
// backend/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

```json
// Root package.json - updated scripts
{
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=backend\" \"npm run dev --workspace=frontend\"",
    "build": "npm run build --workspaces --if-present",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "start": "npm run start --workspace=backend",
    "start:prod": "NODE_ENV=production node backend/dist/index.js"
  }
}
```

### Build Verification Script

```bash
#!/bin/bash
# scripts/verify-build.sh
set -e

echo "🔨 Building backend..."
npm run build:backend

echo "🔨 Building frontend..."
npm run build:frontend

echo "📦 Verifying build outputs..."
[ -f "backend/dist/index.js" ] || { echo "❌ backend/dist/index.js missing"; exit 1; }
[ -f "frontend/dist/index.html" ] || { echo "❌ frontend/dist/index.html missing"; exit 1; }

echo "✅ Build verification passed"
```

---

## 8. Logging Setup

### Current State: ❌ **MISSING**

No logging infrastructure exists in backend.

### Required Implementation

```typescript
// backend/src/utils/logger.ts
import pino from 'pino';
import { config } from '../config';

const isDevelopment = config.NODE_ENV !== 'production';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport: isDevelopment && config.LOG_PRETTY ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'opportunity-backend',
    version: process.env.npm_package_version || '0.1.0',
    environment: config.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.secret',
      '*.token',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
});

// Child logger factory for modules
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

// Request logging middleware
export function requestLogger() {
  return (request: any, reply: any, done: () => void) => {
    const start = Date.now();
    const requestId = request.headers['x-request-id'] || crypto.randomUUID();
    
    request.id = requestId;
    reply.header('x-request-id', requestId);
    
    reply.raw.on('finish', () => {
      const duration = Date.now() - start;
      const log = reply.statusCode >= 400 ? logger.warn : logger.info;
      log({
        req: {
          method: request.method,
          url: request.url,
          headers: request.headers,
        },
        res: {
          statusCode: reply.statusCode,
          durationMs: duration,
        },
        requestId,
      }, `${request.method} ${request.url} ${reply.statusCode} ${duration}ms`);
    });
    
    done();
  };
}
```

### Structured Log Output Example

```json
{
  "level": 30,
  "time": "2026-09-18T10:30:00.000Z",
  "service": "opportunity-backend",
  "version": "0.1.0",
  "environment": "production",
  "module": "matching-engine",
  "requestId": "abc-123",
  "msg": "Semantic match computed",
  "candidateId": "cand-456",
  "opportunityId": "opp-789",
  "score": 0.87,
  "durationMs": 45
}
```

---

## 9. Database Connectivity

### Current State: ⚠️ **PARTIAL** (PostgreSQL in docker-compose, no client code)

### Required Database Layer

```typescript
// backend/src/db/connection.ts
import pg from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected database pool error');
    });
    
    pool.on('connect', () => {
      logger.debug('New database connection established');
    });
  }
  return pool;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database health check failed');
    return false;
  }
}

export async function closeDatabaseConnections(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

// Query helper with automatic retry
export async function query<T>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Query executed');
    return result;
  } catch (error) {
    logger.error({ err: error, query: text.substring(0, 100) }, 'Query failed');
    throw error;
  }
}

// Transaction helper
export async function transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Database Migration Strategy

```typescript
// backend/src/db/migrate.ts
import { getPool, query } from './connection';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  
  // Create migrations table if not exists
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      checksum VARCHAR(64) NOT NULL
    )
  `);
  
  // Migration files would be in ./migrations/
  // This is a placeholder for the migration runner
  logger.info('Migration system initialized');
}

// Expand-and-contract migration pattern example:
// 1. ADD column (expand)
// 2. Deploy code that writes to both old and new
// 3. Backfill data
// 4. Deploy code that reads from new
// 5. DROP old column (contract)
```

---

## 10. Server Implementation (Fastify)

```typescript
// backend/src/server.ts
import Fastify from 'fastify';
import { config } from './config';
import { logger, requestLogger } from './utils/logger';
import { registerConnection } from './utils/graceful-shutdown';
import { healthRoutes } from './routes/health';
import { apiRoutes } from './routes/api';

export async function createServer() {
  const app = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
    disableRequestLogging: true,
    bodyLimit: 1048576, // 1MB
  });
  
  // Core plugins
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false, // Configure for your needs
  });
  
  await app.register(import('@fastify/cors'), {
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  
  await app.register(import('@fastify/rate-limit'), {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (req) => req.ip,
  });
  
  await app.register(import('@fastify/sensible'));
  
  // Request tracking
  app.addHook('onRequest', requestLogger());
  app.addHook('onRequest', (request, reply, done) => {
    registerConnection(request.raw);
    done();
  });
  
  // Error handling
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    logger.error({ 
      err: error, 
      requestId: request.id,
      path: request.url,
      method: request.method,
    }, 'Request error');
    
    return reply.code(statusCode).send({
      error: {
        message: statusCode === 500 ? 'Internal server error' : error.message,
        code: error.code || 'INTERNAL_ERROR',
        requestId: request.id,
      },
    });
  });
  
  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND',
        requestId: request.id,
      },
    });
  });
  
  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(apiRoutes, { prefix: '/api/v1' });
  
  return app;
}
```

---

## 11. API Routes Structure

```typescript
// backend/src/routes/api.ts
import { FastifyInstance } from 'fastify';
import { intelligenceRoutes } from './intelligence';

export async function apiRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    name: 'Automated Opportunity Workflow API',
    version: '0.1.0',
    documentation: '/api/v1/docs',
  }));
  
  await app.register(intelligenceRoutes, { prefix: '/intelligence' });
  
  // Future routes:
  // await app.register(opportunityRoutes, { prefix: '/opportunities' });
  // await app.register(candidateRoutes, { prefix: '/candidates' });
  // await app.register(matchRoutes, { prefix: '/matches' });
}
```

```typescript
// backend/src/routes/intelligence.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createIntelligencePipeline } from '../intelligence/pipeline';
import { UnifiedModelService } from '../../shared/src/models/unified-service';

const runPipelineSchema = z.object({
  rawDocument: z.object({
    externalId: z.string(),
    rawData: z.string(),
  }),
  candidateProfile: z.object({
    id: z.string(),
    citizenship: z.string(),
    education: z.array(z.any()),
    skills: z.array(z.any()),
    experience: z.array(z.any()),
    locationPreferences: z.array(z.string()),
    remotePreference: z.boolean(),
    careerGoals: z.array(z.string()),
    domains: z.array(z.string()),
    certifications: z.array(z.any()),
    projects: z.array(z.any()),
  }),
  opportunityId: z.string(),
  candidateId: z.string(),
});

let pipeline: ReturnType<typeof createIntelligencePipeline> | null = null;
let modelService: UnifiedModelService | null = null;

export async function intelligenceRoutes(app: FastifyInstance) {
  // Initialize pipeline on first request (or at startup)
  app.addHook('onReady', async () => {
    try {
      modelService = new UnifiedModelService();
      await modelService.initialize();
      pipeline = createIntelligencePipeline(modelService);
      await pipeline.initialize();
      app.log.info('Intelligence pipeline initialized');
    } catch (error) {
      app.log.error({ err: error }, 'Failed to initialize intelligence pipeline');
    }
  });
  
  app.post('/match', {
    schema: {
      body: runPipelineSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          data: z.any(),
          requestId: z.string(),
        }),
        400: z.object({
          error: z.object({
            message: z.string(),
            code: z.string(),
            requestId: z.string(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    if (!pipeline) {
      return reply.code(503).send({
        error: {
          message: 'Intelligence pipeline not initialized',
          code: 'SERVICE_UNAVAILABLE',
          requestId: request.id,
        },
      });
    }
    
    try {
      const result = await pipeline.run(request.body);
      return reply.send({
        success: true,
        data: result,
        requestId: request.id,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Pipeline execution failed');
      return reply.code(500).send({
        error: {
          message: 'Pipeline execution failed',
          code: 'PIPELINE_ERROR',
          requestId: request.id,
        },
      });
    }
  });
}
```

---

## 12. Deployment Checklist

### Pre-Deployment Requirements

| Item | Status | Notes |
|------|--------|-------|
| Server entrypoint (`index.ts`) | ❌ | Must create |
| Package.json with scripts | ❌ | Must create |
| TypeScript config | ❌ | Must create |
| Health/readiness endpoints | ❌ | Must implement |
| Graceful shutdown | ❌ | Must implement |
| Structured logging | ❌ | Must implement |
| Database connection pool | ❌ | Must implement |
| Environment validation | ⚠️ | Partial (.env.example exists) |
| Dockerfile | ❌ | Must create |
| Docker-compose (full stack) | ⚠️ | Only PostgreSQL exists |
| Production build script | ❌ | Must create |
| CI/CD pipeline | ❌ | Not configured |
| Kubernetes manifests | ❌ | Not created |
| Monitoring/alerting | ❌ | Not configured |
| Backup strategy | ❌ | Not defined |

### Security Hardening (Production)

- [ ] Helmet.js for security headers
- [ ] CORS restricted to known origins
- [ ] Rate limiting configured
- [ ] Request body size limits
- [ ] Input validation with Zod on all endpoints
- [ ] Secrets management (no secrets in code/env files)
- [ ] Database SSL/TLS required
- [ ] Non-root Docker user
- [ ] Read-only root filesystem in container
- [ ] Security scanning in CI/CD

### Observability Requirements

- [ ] Structured JSON logging (Pino)
- [ ] Request IDs propagated through all services
- [ ] Health endpoints for k8s probes
- [ ] Metrics endpoint (Prometheus format)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Error tracking (Sentry or similar)
- [ ] Custom business metrics

---

## 13. Recommended Next Steps

### Immediate (Before Any Deployment)

1. **Create `backend/package.json`** with all dependencies
2. **Create `backend/tsconfig.json`** extending root config
3. **Implement `backend/src/index.ts`** as server entrypoint
4. **Implement `backend/src/server.ts`** with Fastify setup
5. **Implement `backend/src/config/index.ts`** with Zod validation
6. **Implement `backend/src/utils/logger.ts`** with Pino
7. **Implement `backend/src/utils/graceful-shutdown.ts`**
8. **Implement `backend/src/db/connection.ts`** with pg Pool
9. **Implement `backend/src/routes/health.ts`** with live/ready endpoints
10. **Implement `backend/src/routes/api.ts`** with intelligence routes

### Short-term (Week 1-2)

11. **Create `backend/Dockerfile`** multi-stage build
12. **Update `docker-compose.yml`** with backend service
13. **Add production build verification script**
14. **Configure GitHub Actions CI/CD** for build, test, deploy
15. **Create Kubernetes manifests** (Deployment, Service, Ingress, HPA)

### Medium-term (Month 1)

16. **Add Prometheus metrics** endpoint
17. **Integrate OpenTelemetry** for distributed tracing
18. **Set up log aggregation** (Loki/Datadog/CloudWatch)
19. **Configure alerting** on SLIs (latency, error rate, saturation)
20. **Implement database migration system** with expand-contract pattern
21. **Add integration tests** for deployment pipeline
22. **Document runbooks** for common operations

---

## 14. Architecture Decision Records (ADRs)

### ADR-001: Fastify over Express
**Decision:** Use Fastify for the HTTP server  
**Rationale:** Better performance, built-in validation, TypeScript-first, plugin ecosystem  
**Status:** Accepted

### ADR-002: Pino for Logging
**Decision:** Use Pino for structured logging  
**Rationale:** Low overhead, JSON output, child loggers, redaction support  
**Status:** Accepted

### ADR-003: pg (node-postgres) for Database
**Decision:** Use native pg driver with connection pooling  
**Rationale:** No ORM overhead, full SQL control, mature, supports prepared statements  
**Status:** Accepted

### ADR-004: Zod for Configuration Validation
**Decision:** Use Zod for runtime config validation  
**Rationale:** Type-safe, composable, excellent error messages, integrates with TypeScript  
**Status:** Accepted

---

## 15. Rollback Strategy

```bash
# Quick rollback procedure
# 1. Revert Docker image tag in deployment
kubectl set image deployment/backend backend=yourregistry/opportunity-backend:previous-tag

# 2. Or rollback via helm
helm rollback opportunity-backend 1

# 3. Database migrations - expand-contract pattern allows instant rollback
#    No destructive changes until contraction phase
```

---

## Appendix: File Structure After Implementation

```
backend/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .dockerignore
├── src/
│   ├── index.ts                 # Entrypoint
│   ├── server.ts                # Fastify setup
│   ├── config/
│   │   ├── index.ts             # Zod config schema
│   │   └── validation.ts        # Production validation
│   ├── utils/
│   │   ├── logger.ts            # Pino logger
│   │   └── graceful-shutdown.ts # Signal handling
│   ├── db/
│   │   ├── connection.ts        # pg Pool + helpers
│   │   └── migrate.ts           # Migration runner
│   ├── routes/
│   │   ├── health.ts            # /health/live, /health/ready
│   │   ├── api.ts               # /api/v1 router
│   │   └── intelligence.ts      # /api/v1/intelligence/*
│   └── intelligence/            # Existing modules
│       ├── pipeline.ts
│       ├── matching/
│       ├── explanation/
│       ├── embedding/
│       └── evaluation/
└── dist/                        # Build output (gitignored)
```

---

*This document should be updated as implementation progresses. All items marked ❌ must be completed before the backend can be deployed to any environment beyond local development.*
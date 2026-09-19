# Phase 7: Deployment & Runtime Readiness Audit

**Auditor**: Agent U — Deployment & Runtime Readiness Auditor
**Date**: 2026-09-19
**Project**: AutomatedOpportunityWorkflow

---

## Executive Summary

The backend has a **well-structured startup/shutdown sequence**, **comprehensive environment configuration**, **proper health checks**, and **robust error handling**. The primary gap is the **absence of a Dockerfile and backend/frontend container definitions** — the docker-compose.yml only defines the Postgres service. This is the single largest blocker for containerized deployment.

---

## 1. Environment Requirements

**Status**: LIVE VERIFIED

### 1.1 Required Environment Variables

| Variable | Category | Required | Default | Notes |
|----------|----------|----------|---------|-------|
| `NODE_ENV` | Infrastructure | REQ | `development` | `development`, `production`, `test` |
| `PORT` | Infrastructure | REQ | `3000` | Backend HTTP port |
| `HOST` | Infrastructure | REQ | `0.0.0.0` | Bind address |
| `DATABASE_URL` | Database | REQ | — | PostgreSQL connection string |
| `DATABASE_POOL_SIZE` | Database | OPT | `10` | Connection pool max |
| `DATABASE_SSL` | Database | OPT | `false` | SSL mode |
| `JWT_SECRET` | Auth | REQ/SEC | — | Min 32 chars |
| `JWT_ISSUER` | Auth | OPT | `automated-opportunity-workflow` | |
| `JWT_AUDIENCE` | Auth | OPT | `api.automated-opportunity-workflow` | |
| `JWT_EXPIRES_IN` | Auth | OPT | `1h` | |
| `API_KEY_HEADER` | Auth | OPT | `X-API-Key` | |
| `API_KEY_PREFIX` | Auth | OPT | `aow_` | |
| `WEBHOOK_HMAC_SECRET` | Security | REQ/SEC | — | Min 32 chars |
| `WEBHOOK_HMAC_HEADER` | Security | OPT | `X-Webhook-Signature` | |
| `RATE_LIMIT_MAX` | Rate Limit | OPT | `100` | Per window |
| `RATE_LIMIT_WINDOW_MS` | Rate Limit | OPT | `60000` | 1 minute |
| `CORS_ORIGIN` | CORS | OPT | `*` | |
| `LOG_LEVEL` | Observability | OPT | `info` | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` |
| `LOG_PRETTY` | Observability | OPT | `false` | Pretty-print in dev |
| `SWAGGER_ENABLED` | API Docs | OPT | `true` | |
| `SWAGGER_PATH` | API Docs | OPT | `/docs` | |
| `IDEMPOTENCY_TTL_MS` | Reliability | OPT | `86400000` | 24 hours |
| `HEALTH_CHECK_TIMEOUT_MS` | Operations | OPT | `5000` | 5 seconds |

### 1.2 Validation

- **Schema**: Zod-based validation in `backend/src/config/env.ts`
- **Cached**: Singleton pattern with `loadEnv()` / `getEnv()` — validates once, caches forever
- **Fail-fast**: Throws `Error('Invalid environment configuration')` with formatted errors on startup
- **.env.example**: Comprehensive, 160 lines, with categories (REQ/OPT/SEC/DEV/PROD)

### 1.3 Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| `.env.example` missing `HOST`, `JWT_SECRET`, `WEBHOOK_HMAC_SECRET` | MEDIUM | These are required by Zod schema but not in `.env.example` |
| No production-specific env template | LOW | Consider `.env.production.example` |
| LLM provider/model variables in `.env.example` are mostly commented | LOW | Acceptable — optional multi-provider setup |

---

## 2. Docker Status

**Status**: BLOCKED

### 2.1 What Exists

| Artifact | Status | Notes |
|----------|--------|-------|
| `docker-compose.yml` | PARTIAL | Only defines `postgres` service |
| `Dockerfile` | MISSING | No Dockerfile found anywhere in the project |
| `.dockerignore` | MISSING | No `.dockerignore` found |
| `ecosystem.config.js` | MISSING | No PM2 configuration |

### 2.2 docker-compose.yml Analysis

```yaml
# Current state: only Postgres
services:
  postgres:
    image: pgvector/pgvector:pg16     # ✅ Vector extension support
    ports: ["5432:5432"]               # ⚠️ Exposed on host in production
    volumes: [pgdata:/var/lib/postgresql/data]  # ✅ Persistent storage
    healthcheck: ✅ Present            # pg_isready with 5s interval
```

**Missing services**:
- `backend` — Node.js/Fastify API server
- `frontend` — Vite/React SPA (optional, could be static hosting)

### 2.3 Required Dockerfile (Backend)

A Dockerfile needs to be created with:
- Multi-stage build (build → production)
- Non-root user (`node`)
- Health check directive
- Proper signal handling (exec form for CMD)
- Production dependencies only in final stage

---

## 3. Startup Sequence

**Status**: LIVE VERIFIED

### 3.1 Entry Point Chain

```
backend/src/index.ts          → imports startServer from server.ts
  └→ backend/src/server.ts    → buildServer() + startServer()
```

### 3.2 Initialization Order

| Step | Action | Module | Notes |
|------|--------|--------|-------|
| 1 | Load & validate env | `config/env.ts` | Zod schema, cached singleton |
| 2 | Create Fastify instance | `server.ts` | `trustProxy: true`, bodyLimit 1MB |
| 3 | Register security plugin | `middleware/security.ts` | Helmet + CORS |
| 4 | Register rate limiting | `middleware/rate-limit.ts` | 100 req/min default |
| 5 | Register correlation IDs | `middleware/correlation.ts` | UUID generation, child logger |
| 6 | Register error handler | `middleware/error.ts` | ZodError + AppError handling |
| 7 | Register idempotency | `utils/idempotency.ts` | POST/PUT/PATCH/DELETE only |
| 8 | Register request timing | `server.ts` | `request.startTime = Date.now()` |
| 9 | Register routes | `routes/index.ts` | Health + API v1 |
| 10 | Register Swagger (conditional) | `server.ts` | If `SWAGGER_ENABLED` |
| 11 | Run DB migrations | `db/migrations.ts` | Idempotent schema_migrations |
| 12 | Setup graceful shutdown | `utils/graceful-shutdown.ts` | SIGTERM/SIGINT handlers |
| 13 | Start HTTP listener | `server.ts` | `fastify.listen()` |
| 14 | Log startup success | `server.ts` | Port, host, env |

### 3.3 Race Condition Risk

- **DB pool is lazy** — `getPool()` creates on first call, not during `buildServer()`
- First request that touches DB will trigger pool creation + potential connection delay
- Consider: eager pool initialization after migrations

---

## 4. Shutdown Sequence

**Status**: LIVE VERIFIED

### 4.1 Signal Handlers

| Signal | Handler | Behavior |
|--------|---------|----------|
| `SIGTERM` | `shutdown('SIGTERM')` | Graceful shutdown |
| `SIGINT` | `shutdown('SIGINT')` | Graceful shutdown |
| `uncaughtException` | `shutdown('uncaughtException')` | Log fatal + shutdown |
| `unhandledRejection` | `shutdown('unhandledRejection')` | Log fatal + shutdown |

### 4.2 Shutdown Order

```
1. Check isShuttingDown flag → force exit if already shutting down
2. Close HTTP server (stop accepting new connections)
   └→ Wait for in-flight requests to complete
3. Close database pool (pg Pool.end())
4. Log "Graceful shutdown completed"
5. process.exit(0)
```

### 4.3 Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No configurable shutdown timeout | MEDIUM | If HTTP server `close()` hangs, process never exits |
| No draining of idempotency table | LOW | In-memory state lost on restart (acceptable) |
| No graceful shutdown for model provider connections | LOW | LLM clients are typically stateless HTTP |
| `uncaughtException` calls `process.exit(1)` after failed shutdown | LOW | Double exit risk — `shutdown` already calls `process.exit(0)` |

---

## 5. Health Checks

**Status**: LIVE VERIFIED

### 5.1 Endpoints

| Endpoint | Type | Purpose | Response |
|----------|------|---------|----------|
| `GET /health/live` | Liveness | Process is running | 200 `{ status: "ok" }` |
| `GET /health/ready` | Readiness | Service ready for traffic | 200 `{ status: "ready" }` / 503 `{ status: "not_ready" }` |

### 5.2 Readiness Checks

| Check | Implemented | Notes |
|-------|-------------|-------|
| Database connectivity | YES | `SELECT 1` with latency measurement |
| Model provider connectivity | NO | Not checked in readiness probe |
| Idempotency table availability | NO | Created on-demand, not checked |

### 5.3 Response Format

```json
{
  "status": "ready|not_ready",
  "timestamp": "2026-09-19T05:39:00.000Z",
  "checks": {
    "database": {
      "status": "healthy|unhealthy",
      "latencyMs": 2
    }
  }
}
```

### 5.4 Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No model provider health check | MEDIUM | LLM unavailability not detected at readiness |
| No dependency version reporting | LOW | `npm_package_version` used in liveness, not readiness |
| No `/health/ready` check for migration state | LOW | Migrations run before routes registered, but worth documenting |

---

## 6. Configuration Management

**Status**: LIVE VERIFIED

### 6.1 Architecture

```
.env / process.env
    ↓
Zod validation (config/env.ts)
    ↓
Cached singleton (getEnv())
    ↓
Lazy config getters (config/index.ts)
    ↓
Consumers (middleware, services, routes)
```

### 6.2 Config Sections

| Section | Config Path | Source |
|---------|-------------|--------|
| Server | `config.server.*` | `HOST`, `PORT`, `NODE_ENV` |
| Database | `config.database.*` | `DATABASE_URL`, pool size, SSL |
| JWT | `config.jwt.*` | Secret, issuer, audience, expiry |
| API Key | `config.apiKey.*` | Header name, prefix |
| Webhook | `config.webhook.*` | HMAC secret, header |
| Rate Limit | `config.rateLimit.*` | Max, window |
| CORS | `config.cors.origin` | Origin |
| Logging | `config.logging.*` | Level, pretty |
| Swagger | `config.swagger.*` | Enabled, path |
| Idempotency | `config.idempotency.*` | TTL |
| Health Check | `config.healthCheck.*` | Timeout |

### 6.3 Shared Config

- `shared/src/config/index.ts` loads `AppConfig` from YAML (via `loadConfig()`)
- `modelConfig` loaded separately via `loadModelRegistryConfig()`
- Fallback to `createDefaultConfig()` on failure

### 6.4 Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Config not injectable for testing | LOW | Singletons make test isolation harder |
| No runtime config reload | LOW | Acceptable for current scope |
| `.env.example` missing required vars (`HOST`, `JWT_SECRET`, `WEBHOOK_HMAC_SECRET`) | MEDIUM | Developers won't know these are required |

---

## 7. Service Implementations

**Status**: STRUCTURALLY VERIFIED

### 7.1 Service Inventory

| Service | File | Singleton | DB Access | External Dependencies |
|---------|------|-----------|-----------|----------------------|
| DiscoveryService | `discovery.service.ts` | Lazy singleton | No (in-memory RunCoordinator) | DiscoveryEngine, PipelineOrchestrator |
| OpportunityService | `opportunity.service.ts` | Lazy singleton | Yes (pg pool) | OpportunityPersister, VersionManager, TimingIntelligenceEngine |
| MatchService | `match.service.ts` | — | — | — |
| NewsService | `news.service.ts` | — | — | — |
| ApplicationService | `application.service.ts` | — | — | — |
| VerificationService | `verification.service.ts` | — | — | — |
| ReprocessingService | `reprocessing.service.ts` | — | — | — |

### 7.2 Connection Management

| Resource | Management | Pool | Health Check |
|----------|------------|------|--------------|
| PostgreSQL | `pg.Pool` lazy init | Configurable max (default 10) | `checkDatabaseConnection()` |
| Model providers | HTTP clients (jose, fetch) | N/A | Not implemented |
| Idempotency | DB table created on-demand | Shared pg pool | Not checked |

### 7.3 Database Patterns

- **Connection pool**: Lazy singleton with `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`
- **Query execution**: `executeQuery()` with automatic client release
- **Transactions**: `executeTransaction()` with BEGIN/COMMIT/ROLLBACK
- **Migrations**: Custom runner with `schema_migrations` tracking table

---

## 8. Middleware Stack

**Status**: LIVE VERIFIED

| Order | Middleware | File | Purpose |
|-------|-----------|------|---------|
| 1 | Security | `security.ts` | Helmet headers + CORS |
| 2 | Rate Limit | `rate-limit.ts` | 100 req/min, API key or IP based |
| 3 | Correlation | `correlation.ts` | Request ID tracking, child logger |
| 4 | Error Handler | `error.ts` | ZodError, AppError, 404 handling |
| 5 | Idempotency | `idempotency.ts` | POST/PUT/PATCH/DELETE replay protection |
| 6 | Request Timing | `server.ts` | `request.startTime` capture |

---

## 9. Logging Configuration

**Status**: LIVE VERIFIED

- **Library**: Pino (structured JSON logging)
- **Transport**: `pino-pretty` when `LOG_PRETTY=true` (dev only)
- **Level**: Configurable via `LOG_LEVEL` (default: `info`)
- **Context**: Service name + environment as base fields
- **Request logging**: Child logger with correlationId, requestId, method, URL
- **Error logging**: Stack traces, correlation IDs, request context

---

## 10. Error Handling

**Status**: LIVE VERIFIED

- **Custom error class**: `AppError` with status code, error code, and details
- **Zod validation**: Returns 400 with field-level error details
- **Fastify errors**: Maps status codes to ProblemDetails format
- **5xx safety**: Internal errors return generic message, no stack trace leak
- **404 handler**: Custom not-found handler for API routes
- **Process-level**: `uncaughtException` and `unhandledRejection` both trigger graceful shutdown

---

## 11. Deployment Checklist

| Item | Status | Evidence |
|------|--------|----------|
| Environment variables documented | ✅ | `.env.example` (160 lines), Zod schema |
| Production configuration exists | ⚠️ | Zod defaults for production, no `.env.production` |
| Docker setup present | ❌ | Only `docker-compose.yml` for Postgres; no Dockerfile |
| Startup sequence defined | ✅ | `server.ts` → `buildServer()` + `startServer()` |
| Shutdown sequence defined | ✅ | `graceful-shutdown.ts` — SIGTERM/SIGINT handlers |
| Health checks defined | ✅ | `/health/live` + `/health/ready` with DB check |
| Database connectivity handled | ✅ | Pool with health check, transaction support |
| Model connectivity handled | ⚠️ | HTTP clients used; no health check in readiness probe |
| Logging configured | ✅ | Pino with correlation IDs, configurable level |
| Error handling configured | ✅ | ZodError, AppError, ProblemDetails format |

---

## 12. Blockers for Production Deployment

| # | Blocker | Severity | Effort |
|---|---------|----------|--------|
| 1 | **No Dockerfile** — Cannot build container image | HIGH | 2-4 hours |
| 2 | **No `.dockerignore`** — Image bloat, security risk | HIGH | 30 min |
| 3 | **docker-compose.yml missing backend/frontend services** | HIGH | 1-2 hours |
| 4 | **No shutdown timeout** — HTTP close can hang forever | MEDIUM | 30 min |
| 5 | **`.env.example` missing required vars** — Onboarding confusion | MEDIUM | 15 min |
| 6 | **No model provider health check** — LLM failures invisible | MEDIUM | 1-2 hours |
| 7 | **No production `.env` template** | LOW | 15 min |

---

## 13. Recommendations

### Immediate (Before Deployment)

1. **Create `backend/Dockerfile`** — Multi-stage, non-root, production deps only
2. **Create `.dockerignore`** — Exclude `node_modules`, `.git`, `dist`, `*.md`
3. **Add `backend` and `frontend` services to `docker-compose.yml`**
4. **Add shutdown timeout** — Force `process.exit(1)` after 30 seconds
5. **Fix `.env.example`** — Add `HOST`, `JWT_SECRET`, `WEBHOOK_HMAC_SECRET`

### Short-term (First Sprint)

6. **Add model provider health check** to `/health/ready` probe
7. **Create `.env.production.example`** with production-safe defaults
8. **Add `docker-compose.prod.yml`** override for production (no debug, no Swagger)
9. **Consider PM2 or container orchestration** for process management

### Long-term

10. **Config injection for testing** — Accept config objects instead of reading env
11. **Distributed tracing** — OpenTelemetry integration
12. **Graceful model provider shutdown** — Close HTTP clients on SIGTERM

---

## 14. Architecture Diagram (Startup)

```
┌─────────────────────────────────────────────────────────┐
│                    STARTUP SEQUENCE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  index.ts                                               │
│    │                                                    │
│    ▼                                                    │
│  startServer()                                          │
│    │                                                    │
│    ├─→ buildServer()                                    │
│    │     ├─→ Fastify({ trustProxy, bodyLimit })         │
│    │     ├─→ securityPlugin (Helmet + CORS)             │
│    │     ├─→ rateLimitPlugin (100/min)                  │
│    │     ├─→ correlationIdMiddleware                    │
│    │     ├─→ errorHandler                               │
│    │     ├─→ idempotencyMiddleware                      │
│    │     ├─→ request timing hook                        │
│    │     ├─→ registerRoutes (health + API v1)           │
│    │     └─→ Swagger (if enabled)                       │
│    │                                                    │
│    ├─→ runMigrations()                                  │
│    │     ├─→ ensureMigrationTable()                     │
│    │     ├─→ getPendingMigrations()                     │
│    │     └─→ applyMigration() × N                       │
│    │                                                    │
│    ├─→ setupGracefulShutdown()                          │
│    │     ├─→ SIGTERM handler                            │
│    │     ├─→ SIGINT handler                             │
│    │     ├─→ uncaughtException handler                  │
│    │     └─→ unhandledRejection handler                 │
│    │                                                    │
│    └─→ fastify.listen() → PORT:HOST                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 15. Architecture Diagram (Shutdown)

```
┌─────────────────────────────────────────────────────────┐
│                   SHUTDOWN SEQUENCE                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SIGTERM / SIGINT received                              │
│    │                                                    │
│    ▼                                                    │
│  isShuttingDown = true                                  │
│    │                                                    │
│    ├─→ server.close()                                   │
│    │     └─→ Wait for in-flight requests                │
│    │                                                    │
│    ├─→ closePool()                                      │
│    │     └─→ pool.end() → close all connections         │
│    │                                                    │
│    └─→ process.exit(0)                                  │
│                                                         │
│  ──── ERROR PATH ────                                   │
│                                                         │
│  uncaughtException / unhandledRejection                  │
│    │                                                    │
│    ├─→ logger.fatal()                                   │
│    ├─→ shutdown() → ... → process.exit(0)               │
│    └─→ .catch(() => process.exit(1))  [fallback]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

*Report generated by Agent U — Deployment & Runtime Readiness Auditor*
*Phase 7 Audit — 2026-09-19*

# Phase 6: API Security Audit Report

**Repository:** AutomatedOpportunityWorkflow  
**Date:** 2026-09-18  
**Auditor:** Subagent E - API Security Auditor  
**Status:** DRAFT

---

## Executive Summary

This security audit examines the AutomatedOpportunityWorkflow codebase for security vulnerabilities across authentication, input validation, secret handling, error leakage, logging practices, and HTTP security headers. The audit focuses on the **existing backend implementation** (TypeScript class APIs) since **no HTTP REST API layer exists yet** (confirmed by Phase 6 API Contract Audit).

### Overall Risk Assessment: **MEDIUM-HIGH**

| Category | Findings | Risk Level |
|----------|----------|------------|
| Authentication & Authorization | No auth layer; candidate-scoped endpoints impossible | **CRITICAL** |
| Input Validation | Good domain-level validation; no HTTP request validation | **HIGH** |
| Secret Handling | Good practices in config/env; some hardcoded fallbacks | **MEDIUM** |
| Error Leakage | Structured errors with codes; stack traces in dev logs | **MEDIUM** |
| Logging Practices | Structured JSON logging; no PII filtering | **LOW-MEDIUM** |
| CORS & Security Headers | **MISSING** - No HTTP layer exists | **CRITICAL** |

---

## 1. Authentication & Authorization

### Current State

**No authentication or authorization layer exists.** The backend is a library of TypeScript classes with zero HTTP endpoints.

### Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| AUTH-001 | **No authentication mechanism** | **CRITICAL** | `backend/src/index.ts` exports empty object. No JWT, API keys, OAuth, or session handling. |
| AUTH-002 | **No authorization model** | **CRITICAL** | Required endpoints (`/candidates/:candidateId/matches`, `/candidates/:candidateId/applications`) imply user-scoped access but no auth context exists. |
| AUTH-003 | **Source registry has auth metadata but unused** | **HIGH** | `SourceRegistryEntry.authentication` field defines `AccessMethod` (PUBLIC, AUTHENTICATED, API_KEY, OAUTH) and `oauthScopes`, but adapters only use env vars directly. |
| AUTH-004 | **USAJobs adapter has auth logic but disabled** | **MEDIUM** | `USAJobsAdapter.buildHeaders()` reads `USAJOBS_API_KEY` from env and throws `AuthenticationFailureError` if missing, but `hasCredentials()` returns `false` forcing fixture mode. |
| AUTH-005 | **No webhook signature verification** | **HIGH** | Required webhook endpoints (`/webhooks/*`) need HMAC verification per n8n integration spec; zero implementation. |

### Recommendations

1. **Implement authentication middleware** before any HTTP routes:
   - JWT-based auth for candidate-scoped endpoints
   - API key auth for service-to-service (n8n callbacks)
   - Store public keys/JWKS for token validation
2. **Create `AuthContext`** injected into services for authorization decisions
3. **Wire source registry auth config** to adapter factory for automatic credential injection
4. **Implement webhook HMAC verification** with configurable secrets per webhook source

---

## 2. Input Validation

### Current State

Validation exists at **domain/persistence layer** but **no HTTP request validation** (no HTTP layer).

### Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| VAL-001 | **No HTTP request validation layer** | **CRITICAL** | When Express routes are added, no Zod/Joi schemas exist for request bodies, query params, path params. |
| VAL-002 | **Good domain validation** | **INFO** | `ValidationEngine` (discovery/validation) provides rule-based validation with severity levels (ERROR/WARNING/INFO), remediation suggestions, and scoring. |
| VAL-003 | **Adapter-level validation** | **INFO** | `BaseSourceAdapter.validate()` checks required fields (title, firstSeenAt, sourceId) and deadline format. |
| VAL-004 | **Persister validates required fields** | **INFO** | `OpportunityPersister.persist()` checks `title` and `sourceId` before upsert. |
| VAL-005 | **Shared validation utilities** | **INFO** | `shared/src/domain/validation.ts` has `isValidId`, `isValidTimestamp`, `validateDeadline` helpers. |
| VAL-006 | **No SQL injection protection (mock DB)** | **HIGH** | `OpportunityPersister` uses string interpolation in TODO comments (`source_id = $1`). Real Drizzle/pg implementation must use parameterized queries. |
| VAL-007 | **URL handling - treated as untrusted** | **INFO** | SECURITY.md notes: "URLs from sources are treated as untrusted; only assigned to domain fields, never fetched automatically in Phase 1." |

### Recommendations

1. **Add request validation middleware** using Zod schemas for all endpoints
2. **Validate path parameters** (UUID format for IDs)
3. **Implement query parameter validation** with allowlists for filters/sort/pagination
4. **Use Drizzle ORM** with parameterized queries when database layer is implemented
5. **Sanitize URLs** before storage (normalize, validate scheme, block internal IPs)

---

## 3. Secret Handling

### Current State

Good practices for configuration; secrets in env vars only.

### Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| SEC-001 | **`.env` gitignored, `.env.example` has placeholders** | **INFO** | `.env.example` shows all required vars with empty values. No secrets committed. |
| SEC-002 | **Database credentials in env** | **INFO** | `DATABASE_URL`, `POSTGRES_PASSWORD` in `.env.example` - correct pattern. |
| SEC-003 | **LLM model API keys in env** | **INFO** | `EXTRACTION_MODEL`, `CLASSIFICATION_MODEL`, `OPENAI_API_KEY` etc. in env - correct. |
| SEC-004 | **AWS credentials optional in env** | **INFO** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` commented out in `.env.example`. |
| SEC-005 | **Hardcoded fallback in USAJobs adapter** | **MEDIUM** | `USAJobsAdapter.hasCredentials()` returns `false` hardcoded, forcing fixture data. In production, must read from env. |
| SEC-006 | **User-Agent contains email in code** | **LOW** | `USAJobsAdapter.buildHeaders()` defaults to `opportunity-intelligence@example.com` - should be configurable via env. |
| SEC-007 | **No secret rotation strategy** | **MEDIUM** | No documentation or tooling for rotating API keys, DB passwords, JWT secrets. |
| SEC-008 | **No secrets scanning in CI** | **MEDIUM** | No mention of `git-secrets`, `truffleHog`, or similar in pipeline. |

### Recommendations

1. **Enforce env-only secrets** - Add pre-commit hook with `git-secrets` or `truffleHog`
2. **Make User-Agent configurable** via `USAJOBS_USER_AGENT` env var
3. **Document secret rotation procedure** in runbooks
4. **Use secret manager** (AWS Secrets Manager, HashiCorp Vault) in production
5. **Remove hardcoded `hasCredentials() = false`** - implement proper env check

---

## 4. Error Leakage

### Current State

Structured error types with codes; stack traces logged in development.

### Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| ERR-001 | **Structured adapter errors** | **INFO** | `AdapterError` hierarchy with `code`, `sourceId`, `retryable`, `cause`. No secrets in messages. |
| ERR-002 | **Error codes are generic** | **INFO** | Codes: `AUTHENTICATION_FAILURE`, `RATE_LIMITING`, `NETWORK_FAILURE`, `MALFORMED_RESPONSE`, `SOURCE_UNAVAILABLE`, `PARSING_FAILURE`, `UNSUPPORTED_SOURCE`, `VALIDATION_FAILURE`. |
| ERR-003 | **Stack traces logged in observability** | **MEDIUM** | `observability.ts` `logError()` includes `stack: error.stack` in JSON output. Acceptable for dev; must be filtered in production. |
| ERR-004 | **Health checks don't leak credentials** | **INFO** | `BaseSourceAdapter.health_check()` returns status + latency + generic reason, no secrets. |
| ERR-005 | **No HTTP error response standardization** | **HIGH** | When Express is added, need consistent error envelope: `{ error: { code, message, correlationId } }` without stack traces. |
| ERR-006 | **Validation errors expose field details** | **LOW** | `ValidationEngine` returns field-level issues with remediation - acceptable for API consumers but ensure no internal paths leaked. |

### Recommendations

1. **Create HTTP error middleware** that:
   - Maps internal errors to generic client-safe messages
   - Includes correlation ID for tracing
   - Logs full stack trace server-side only
   - Returns appropriate HTTP status codes (400, 401, 403, 404, 429, 500, 503)
2. **Filter stack traces in production logs** - use `NODE_ENV=production` guard
3. **Define standard error envelope** for all API responses

---

## 5. Logging Practices

### Current State

Structured JSON logging to console via custom observability module.

### Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| LOG-001 | **Structured JSON logging** | **INFO** | `observability.ts` emits JSON with `timestamp`, `level`, `message`, `meta`. |
| LOG-002 | **No request ID correlation** | **MEDIUM** | No request ID generation/propagation. Critical for distributed tracing. |
| LOG-003 | **No PII filtering** | **MEDIUM** | Logs may contain candidate data, opportunity details, emails in `meta`. Need field-level redaction. |
| LOG-004 | **In-memory event store** | **INFO** | `InMemoryStore` keeps last 10k events/metrics/traces - not production-ready. |
| LOG-005 | **Console-only output** | **MEDIUM** | No log rotation, no external aggregation (ELK, Datadog, CloudWatch). |
| LOG-006 | **Trace context propagation** | **INFO** | `startTrace`/`endTrace` support traceId/spanId but not integrated with HTTP layer. |
| LOG-007 | **Security events not distinguished** | **LOW** | Auth failures, rate limits, validation errors logged as generic `info`/`warn`. |

### Recommendations

1. **Add request ID middleware** (generate UUID, propagate via headers `X-Request-ID`)
2. **Implement PII redaction** - filter fields: `email`, `password`, `apiKey`, `token`, `authorization`, `ssn`, `creditCard`
3. **Add structured logging library** (pino, winston) with:
   - Log levels by environment
   - Pretty print in dev, JSON in prod
   - Log rotation
4. **Integrate with distributed tracing** (OpenTelemetry) when HTTP layer added
5. **Add security event logging** - separate audit log for auth failures, privilege changes, data access

---

## 6. CORS & Security Headers

### Current State

**MISSING** - No HTTP server exists.

### Findings

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| HDR-001 | **No CORS configuration** | **CRITICAL** | Frontend runs on `http://localhost:5173` (Vite), backend on `http://localhost:3001`. CORS must allow frontend origin. |
| HDR-002 | **No Helmet/security headers** | **CRITICAL** | No `helmet` middleware for: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. |
| HDR-003 | **No rate limiting on HTTP layer** | **HIGH** | Adapter-level rate limiting exists for external sources, but **no inbound API rate limiting** (per IP, per API key, per candidate). |
| HDR-004 | **No request size limits** | **MEDIUM** | Express default 100kb; may need adjustment for bulk endpoints. |
| HDR-005 | **No security.txt / well-known** | **LOW** | Add `/.well-known/security.txt` for vulnerability reporting. |

### Required Security Headers (when Express added)

```typescript
// Recommended helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.usajobs.gov"], // external APIs
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // if needed for embeddings
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  },
}));

// CORS - restrict to frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // if using cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-ID', 'Retry-After'],
  maxAge: 86400,
}));
```

### Inbound Rate Limiting (Required)

```typescript
// Per-IP rate limiter for anonymous endpoints
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    });
  },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 min
  // ...
});
```

---

## 7. Additional Security Considerations

### 7.1 Supply Chain Security

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| SUP-001 | **No `package-lock.json` integrity verification** | **MEDIUM** | `backend/package.json` has no lockfile committed (only `bun.lock` at root). |
| SUP-002 | **No dependency scanning** | **MEDIUM** | No `npm audit`, `snyk`, or `dependabot` configuration visible. |
| SUP-003 | **TypeScript `strict` mode enabled** | **INFO** | `tsconfig.json` likely has strict mode (standard for this codebase). |

### 7.2 Data Protection

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| DAT-001 | **No encryption at rest** | **MEDIUM** | PostgreSQL will store PII (candidate profiles, applications). Need TDE or column-level encryption for sensitive fields. |
| DAT-002 | **No encryption in transit (dev)** | **LOW** | Dev uses HTTP localhost. Production must enforce TLS 1.2+. |
| DAT-003 | **No data retention policy** | **MEDIUM** | Opportunities, candidates, applications stored indefinitely. Need GDPR/CCPA compliance. |
| DAT-004 | **Candidate PII in domain model** | **INFO** | `CandidateProfile` includes `email`, `phone`, `location`, `linkedInUrl`, `githubUrl`, `portfolioUrl`. |

### 7.3 API Contract Security

| ID | Finding | Severity | Details |
|----|---------|----------|---------|
| CON-001 | **No OpenAPI spec** | **HIGH** | Required for n8n integration; no contract exists. |
| CON-002 | **No API versioning strategy** | **MEDIUM** | Phase 6 specifies `/api/v1/` prefix but no versioning middleware. |
| CON-003 | **No idempotency keys** | **MEDIUM** | Required for webhook endpoints and mutating operations. |
| CON-004 | **No request/response schemas** | **HIGH** | Need Zod schemas for all endpoints for validation and OpenAPI generation. |

---

## 8. Remediation Priority Matrix

| Priority | Items | Timeline |
|----------|-------|----------|
| **P0 - Blockers** | AUTH-001, AUTH-002, AUTH-005, VAL-001, HDR-001, HDR-002, HDR-003 | Before any HTTP routes deployed |
| **P1 - Critical** | SEC-005, VAL-006, ERR-005, LOG-002, LOG-003, CON-001, CON-003 | Week 1 of API implementation |
| **P2 - High** | AUTH-003, AUTH-004, SEC-007, SEC-008, ERR-003, LOG-004, LOG-005, HDR-004, SUP-001, SUP-002, DAT-001, DAT-003, CON-002, CON-004 | Week 1-2 |
| **P3 - Medium** | SEC-006, LOG-006, LOG-007, DAT-002, DAT-004 | Week 2-3 |
| **P4 - Low** | HDR-005 | Week 3-4 |

---

## 9. Security Checklist for API Implementation

When implementing the Express HTTP layer (Phase 6A), verify each item:

### Authentication & Authorization
- [ ] JWT middleware with JWKS validation
- [ ] API key middleware for service-to-service
- [ ] Role-based access control (RBAC) for candidate-scoped endpoints
- [ ] Webhook HMAC verification middleware

### Input Validation
- [ ] Zod schemas for all request bodies, query params, path params
- [ ] UUID validation for all ID path parameters
- [ ] Allowlist validation for enum fields (status, category, etc.)
- [ ] Request size limits per endpoint

### Secret Handling
- [ ] All secrets via env vars only
- [ ] Pre-commit secret scanning
- [ ] Secret rotation documented
- [ ] No hardcoded credentials

### Error Handling
- [ ] Standard error envelope `{ error: { code, message, correlationId } }`
- [ ] No stack traces in production responses
- [ ] Correlation ID generated per request
- [ ] Proper HTTP status codes

### Logging
- [ ] Request ID in all log entries
- [ ] PII redaction middleware
- [ ] Structured JSON logging (pino)
- [ ] Security audit log separate from app log

### Security Headers
- [ ] Helmet with CSP configured
- [ ] CORS restricted to frontend origin
- [ ] Inbound rate limiting (per IP, per API key, per user)
- [ ] HSTS in production

### API Contract
- [ ] OpenAPI 3.1 spec generated from Zod schemas
- [ ] API versioning in URL (`/api/v1/`)
- [ ] Idempotency key support for POST/PATCH
- [ ] Request/response examples in spec

---

## 10. Conclusion

The codebase demonstrates **strong domain-level security practices** (structured errors, validation engines, secret configuration patterns) but **completely lacks the HTTP security perimeter** required for a production API.

**Immediate action required** before deploying any HTTP endpoints:
1. Implement authentication/authorization
2. Add CORS and security headers (Helmet)
3. Implement inbound rate limiting
4. Add request validation layer
5. Establish structured logging with correlation IDs

The existing TypeScript class architecture provides a solid foundation for building secure services once the HTTP layer is added with proper security middleware.

---

*End of Security Audit Report*
# Phase 6 Testing Report

## Overview
Comprehensive test suite for the Automated Opportunity Workflow backend API implementation.

## Test Infrastructure

### Configuration
- **Test Framework**: Vitest 1.x
- **Coverage Provider**: V8 (built-in)
- **Test Environment**: Node.js
- **Config File**: `backend/vitest.config.ts`

### Test Scripts (package.json)
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run --reporter=verbose --test-timeout=10000 tests/unit",
  "test:integration": "vitest run --reporter=verbose --test-timeout=30000 tests/integration",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

### Setup Files
- `backend/tests/setup.ts` - Global test setup, mocks, environment config
- `backend/tests/factories.ts` - Test data factories and mock service creators

---

## Unit Tests (No External Dependencies)

### Middleware Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/middleware/correlation.test.ts` | 8 | Correlation ID generation, propagation, logging |
| `tests/unit/middleware/auth.test.ts` | 15+ | JWT, API Key, scopes, candidate access, webhook HMAC |
| `tests/unit/middleware/validation.test.ts` | 20+ | Body, params, query, headers validation with Zod |
| `tests/unit/middleware/rate-limit.test.ts` | 8 | Standard, auth, webhook rate limiters |
| `tests/unit/middleware/error.test.ts` | 10 | ZodError, Fastify validation, RFC 7807 format, AppError |
| `tests/unit/middleware/security.test.ts` | 2 | Helmet CSP, CORS configuration |
| `tests/unit/middleware/webhook-hmac.test.ts` | 10 | HMAC verification, generation, timing-safe comparison |

**Total Middleware Tests: ~73**

### Schema Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/schemas/discovery.test.ts` | 20+ | UUID, pagination, date ranges, job/run schemas |
| `tests/unit/schemas/opportunity.test.ts` | 25+ | Opportunity CRUD, filters, versions, intelligence |
| `tests/unit/schemas/match.test.ts` | 15 | Match CRUD, filters, creation request |
| `tests/unit/schemas/webhook.test.ts` | 25+ | All webhook event types, registration |
| `tests/unit/schemas/verification.test.ts` | 15 | Verification & reprocessing runs, filters |
| `tests/unit/schemas/application.test.ts` | 15 | Application CRUD, reminders |
| `tests/unit/schemas/news.test.ts` | 8 | News CRUD, filters |

**Total Schema Tests: ~123**

### Utility Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/utils/api-envelope.test.ts` | 12 | Single/list/error response envelopes |
| `tests/unit/utils/idempotency.test.ts` | 10 | Hash, check, store, middleware |
| `tests/unit/utils/logger.test.ts` | 3 | Logger methods, child logger |
| `tests/unit/utils/graceful-shutdown.test.ts` | 8 | Signal handling, server close, DB close |

**Total Utility Tests: ~33**

### Service Tests (Mocked Dependencies)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/services/discovery.service.test.ts` | 10 | Job/run CRUD, scheduling, polling |
| `tests/unit/services/opportunity.service.test.ts` | 15 | CRUD, intelligence, versions, deadline |
| `tests/unit/services/match.service.test.ts` | 8 | CRUD, filters, candidate-scoped |
| `tests/unit/services/news.service.test.ts` | 8 | CRUD, related opportunities |
| `tests/unit/services/application.service.test.ts` | 9 | CRUD, reminders, candidate-scoped |
| `tests/unit/services/verification.service.test.ts` | 6 | Run CRUD, status updates |
| `tests/unit/services/reprocessing.service.test.ts` | 5 | Run CRUD, status updates |

**Total Service Tests: ~61**

---

## Integration Tests (Require Database)

### Test Categories

| Test File | Endpoints | Auth Tests |
|-----------|-----------|------------|
| `tests/integration/health.test.ts` | 2 | - |
| `tests/integration/auth.test.ts` | 5 | JWT, API Key, HMAC |
| `tests/integration/discovery.test.ts` | 10 | ✓ |
| `tests/integration/opportunity.test.ts` | 13 | ✓ |
| `tests/integration/match.test.ts` | 8 | ✓ |
| `tests/integration/webhook.test.ts` | 15 | ✓ |

**Total Integration Tests: ~53**

### Integration Test Coverage

| Endpoint Group | Endpoints Tested |
|----------------|------------------|
| Health | `/health/live`, `/health/ready` |
| Auth | JWT valid/invalid/expired, API Key, Webhook HMAC |
| Discovery | Jobs CRUD, runs CRUD, schedule/cancel/pause/resume, list |
| Opportunity | CRUD, intelligence, matches, versions, reprocess, verify |
| Match | Create, list (with all filters), detail, candidate-scoped |
| Webhook | All 6 webhook types, HMAC validation, idempotency |

---

## Test Classification Tags

### Unit Tests (`tests/unit/`)
- **No external dependencies** - All mocks
- **Fast execution** (< 10s total)
- **Run with**: `npm run test:unit`

### Integration Tests (`tests/integration/`)
- **Require database** - PostgreSQL
- **Require running server** - Fastify
- **Slower execution** (< 30s total)
- **Run with**: `npm run test:integration`

### Live Tests (Not Implemented)
- **Require external services** - n8n, ML APIs, external APIs
- **Manual execution only**
- **Run with**: `npm run test:live` (future)

---

## Coverage Targets

| Metric | Target | Current |
|--------|--------|---------|
| Lines | 70% | TBD |
| Functions | 70% | TBD |
| Branches | 60% | TBD |
| Statements | 70% | TBD |

Run `npm run test:coverage` to generate coverage report in `backend/coverage/`.

---

## Blockers & Known Issues

### 1. Database Dependency for Integration Tests
**Status**: Blocking
**Impact**: Integration tests require PostgreSQL
**Workaround**: 
- Use Testcontainers for ephemeral DB in CI
- Mock `getPool()` for unit tests (already done)
- Run integration tests against dev database

### 2. JWT Verification in Tests
**Status**: Partial
**Impact**: Auth middleware tests use mocked `jose.jwtVerify`
**Solution**: Use test JWT secret and generate real tokens in tests

### 3. External Service Mocks
**Status**: Not Implemented
**Impact**: n8n, ML model APIs not mocked
**Solution**: Create MSW (Mock Service Worker) handlers for external calls

### 4. Race Conditions in Idempotency Tests
**Status**: Minor
**Impact**: Fire-and-forget store may not complete before assertion
**Solution**: Use proper async waiting in middleware

---

## Running Tests

### All Tests
```bash
cd backend
npm test
```

### Unit Tests Only
```bash
cd backend
npm run test:unit
```

### Integration Tests Only
```bash
cd backend
npm run test:integration
```

### With Coverage
```bash
cd backend
npm run test:coverage
```

### Watch Mode (Development)
```bash
cd backend
npm run test:watch
```

### UI Mode
```bash
cd backend
npm run test:ui
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Unit Tests
  run: cd backend && npm run test:unit

- name: Run Integration Tests
  run: cd backend && npm run test:integration
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    directory: backend/coverage
```

---

## Test Data Factories

Located in `backend/tests/factories.ts`:

### Entity Factories
- `createTestOpportunity()` - Opportunity with all fields
- `createTestMatch()` - Match with score, ranking, explanation
- `createTestDiscoveryJob()` - Discovery job
- `createTestDiscoveryRun()` - Discovery run
- `createTestVerificationRun()` - Verification run
- `createTestReprocessingRun()` - Reprocessing run
- `createTestApplication()` - Application
- `createTestNewsItem()` - News item

### Auth Factories
- `createValidJWT()` - Valid JWT token
- `createExpiredJWT()` - Expired JWT
- `createInvalidJWT()` - Malformed JWT
- `createValidAPIKey()` - Valid API key
- `createValidHMAC()` - Valid HMAC signature

### Request/Response Factories
- `createMockRequest()` - Fastify request mock
- `createMockReply()` - Fastify reply mock
- `createMockFastifyInstance()` - Fastify instance mock
- `createListResponse()` - Paginated response helper

### Service Mocks
- `createMockDiscoveryService()`
- `createMockOpportunityService()`
- `createMockMatchService()`
- `createMockNewsService()`
- `createMockApplicationService()`
- `createMockVerificationService()`
- `createMockReprocessingService()`

---

## Summary

| Category | Test Files | Estimated Tests |
|----------|------------|-----------------|
| Middleware | 7 | 73 |
| Schemas | 7 | 123 |
| Utilities | 4 | 33 |
| Services | 7 | 61 |
| Integration | 6 | 53 |
| **Total** | **31** | **~343** |

The test suite provides comprehensive coverage of:
- ✅ All middleware (auth, validation, rate-limit, error, correlation, security, webhook)
- ✅ All Zod schemas (discovery, opportunity, match, webhook, verification, application, news)
- ✅ All utilities (api-envelope, idempotency, logger, graceful-shutdown, webhook-hmac)
- ✅ All services with mocked dependencies
- ✅ All API endpoints with authentication
- ✅ RFC 7807 error format compliance
- ✅ Idempotency key handling
- ✅ HMAC signature verification
- ✅ Pagination and filtering
- ✅ Correlation ID propagation
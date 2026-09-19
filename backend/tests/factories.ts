import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import { vi } from 'vitest';

// ============================================
// Test Data Factories
// ============================================

export function createMockRequest(overrides: Partial<{
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
  ip: string;
}> = {}) {
  const method = overrides.method || 'GET';
  const url = overrides.url || '/test';
  const headers = {
    'user-agent': 'test-agent',
    'x-forwarded-for': '127.0.0.1',
    ...overrides.headers,
  };
  
  return {
    method,
    url,
    headers,
    body: overrides.body || null,
    params: overrides.params || {},
    query: overrides.query || {},
    ip: overrides.ip || '127.0.0.1',
    correlationId: randomUUID(),
    requestId: randomUUID(),
    startTime: Date.now(),
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
  };
}

export function createMockReply(overrides: Partial<{
  statusCode: number;
  headers: Record<string, string>;
}> = {}) {
  const headers: Record<string, string> = {};
  let statusCode = overrides.statusCode || 200;
  let sentPayload: unknown = null;
  
  const reply = {
    code: vi.fn((code: number) => {
      statusCode = code;
      return {
        send: vi.fn((payload: unknown) => {
          sentPayload = payload;
          return { statusCode, headers, payload };
        }),
      };
    }),
    status: vi.fn((code: number) => {
      statusCode = code;
      return {
        send: vi.fn((payload: unknown) => {
          sentPayload = payload;
          return { statusCode, headers, payload };
        }),
      };
    }),
    code: vi.fn((code: number) => {
      statusCode = code;
      return reply;
    }),
    header: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return {
        send: vi.fn((payload: unknown) => {
          sentPayload = payload;
          return { statusCode, headers, payload };
        }),
      };
    }),
    send: vi.fn((payload: unknown) => {
      sentPayload = payload;
      return { statusCode, headers, payload };
    }),
    getHeaders: vi.fn(() => headers),
    getStatusCode: vi.fn(() => statusCode),
    sentPayload: vi.fn(() => sentPayload),
    // Expose statusCode as property for middleware access
    get statusCode() { return statusCode; },
    set statusCode(code: number) { statusCode = code; },
    // Test helpers
    _getStatusCode: () => statusCode,
    _getHeaders: () => headers,
    _getPayload: () => sentPayload,
  };
  
  // Apply overrides
  if (overrides.statusCode !== undefined) {
    statusCode = overrides.statusCode;
  }
  if (overrides.headers) {
    Object.assign(headers, overrides.headers);
  }
  
  return reply;
}

export function createMockFastifyInstance() {
  const hooks: Record<string, Array<(request: any, reply: any) => Promise<void>>> = {
    onRequest: [],
    onResponse: [],
    onError: [],
  };
  
  return {
    addHook: vi.fn((event: string, handler: (request: any, reply: any) => Promise<void>) => {
      if (hooks[event]) {
        hooks[event].push(handler);
      }
    }),
    setErrorHandler: vi.fn(),
    setNotFoundHandler: vi.fn(),
    register: vi.fn().mockResolvedValue(undefined),
    _hooks: hooks,
  };
}

export function createValidJWT(payload: Record<string, unknown> = {}, expiresIn: string = '1h'): string {
  // This is a mock - in real tests we'd use jose to create a real JWT
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour default
  
  const fullPayload = {
    iss: 'test-issuer',
    aud: 'test-audience',
    iat: now,
    exp,
    sub: 'test-user-123',
    candidateId: 'test-candidate-123',
    scopes: ['read', 'write'],
    type: 'access',
    ...payload,
  };
  
  // Base64 encode (not real JWT, just for testing structure)
  return 'Bearer ' + Buffer.from(JSON.stringify(header)).toString('base64') + '.' + 
         Buffer.from(JSON.stringify(fullPayload)).toString('base64') + '.' + 
         'test-signature';
}

export function createExpiredJWT(): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: 'test-issuer',
    aud: 'test-audience',
    iat: now - 7200,
    exp: now - 3600, // Expired 1 hour ago
    sub: 'test-user-123',
    scopes: ['read'],
  };
  
  return 'Bearer ' + Buffer.from(JSON.stringify(header)).toString('base64') + '.' + 
         Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + 
         'test-signature';
}

export function createInvalidJWT(): string {
  return 'Bearer invalid.token.signature';
}

export function createValidAPIKey(): string {
  return 'aow_test_abcdefghijklmnopqrstuvwxyz123456';
}

export function createValidHMAC(payload: string, secret: string = 'test-webhook-secret-key-min-32-chars-long'): string {
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${hmac}`;
}

export function createTestOpportunity(overrides: Partial<{
  id: string;
  stableId: string;
  sourceId: string;
  title: string;
  organization: string;
  status: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || randomUUID(),
    stableId: overrides.stableId || randomUUID(),
    sourceId: overrides.sourceId || randomUUID(),
    externalId: 'ext-' + randomUUID().slice(0, 8),
    title: overrides.title || 'Test Opportunity',
    organization: overrides.organization || 'Test Org',
    description: 'Test description',
    url: 'https://example.com/opportunity',
    location: 'Remote',
    remoteInfo: {},
    opportunityType: 'FELLOWSHIP',
    categoryIds: [],
    status: overrides.status || 'ACTIVE',
    publicationDate: now,
    applicationDeadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    deadlineType: 'FIXED',
    firstSeenAt: now,
    lastSeenAt: now,
    lastVerifiedAt: now,
    closedAt: null,
    lifecycleStage: 'DISCOVERED',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestMatch(overrides: Partial<{
  id: string;
  candidateId: string;
  opportunityId: string;
  status: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || randomUUID(),
    candidateId: overrides.candidateId || randomUUID(),
    opportunityId: overrides.opportunityId || randomUUID(),
    score: {
      overall: 0.85,
      factors: [
        { name: 'skills', weight: 0.4, score: 0.9, evidence: 'Strong match' },
        { name: 'experience', weight: 0.3, score: 0.8, evidence: 'Good experience' },
        { name: 'location', weight: 0.3, score: 0.85, evidence: 'Remote friendly' },
      ],
      confidence: 0.9,
    },
    ranking: {
      rank: 1,
      score: 0.85,
      percentile: 95,
    },
    explanation: {
      summary: 'Excellent match for candidate',
      strengths: ['Strong skills match', 'Relevant experience'],
      gaps: ['Missing certification'],
      recommendations: ['Apply early'],
      detail: {},
    },
    status: overrides.status || 'COMPUTED',
    computedAt: now,
    notifiedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestDiscoveryJob(overrides: Partial<{
  jobId: string;
  status: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    jobId: overrides.jobId || randomUUID(),
    createdAt: now,
    updatedAt: now,
    sourceIds: ['source-1', 'source-2'],
    runAllEnabled: false,
    category: 'TECHNOLOGY',
    priorityMin: 50,
    metadata: {},
    triggeredBy: 'test',
    status: overrides.status || 'DRAFT',
  };
}

export function createTestDiscoveryRun(overrides: Partial<{
  runId: string;
  jobId: string;
  status: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    runId: overrides.runId || randomUUID(),
    jobId: overrides.jobId || randomUUID(),
    status: overrides.status || 'PENDING',
    startedAt: null,
    completedAt: null,
    sourcesRequested: 2,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    sourcesSkipped: 0,
    stageResults: [],
    error: null,
    metadata: {},
    executionContext: {},
  };
}

export function createTestVerificationRun(overrides: Partial<{
  id: string;
  status: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || randomUUID(),
    opportunityIds: [randomUUID(), randomUUID()],
    status: overrides.status || 'PENDING',
    startedAt: now,
    completedAt: null,
    results: null,
    error: null,
    triggeredBy: 'test',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createTestReprocessingRun(overrides: Partial<{
  id: string;
  status: string;
  forceReprocess: boolean;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || randomUUID(),
    opportunityIds: [randomUUID(), randomUUID()],
    status: overrides.status || 'PENDING',
    startedAt: now,
    completedAt: null,
    results: null,
    error: null,
    triggeredBy: 'test',
    forceReprocess: overrides.forceReprocess ?? false,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createTestApplication(overrides: Partial<{
  id: string;
  userId: string;
  opportunityId: string;
  status: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || randomUUID(),
    opportunityId: overrides.opportunityId || randomUUID(),
    userId: overrides.userId || randomUUID(),
    externalId: 'ext-' + randomUUID().slice(0, 8),
    applicationUrl: 'https://example.com/apply',
    status: overrides.status || 'DRAFT',
    notes: 'Test application',
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestNewsItem(overrides: Partial<{
  id: string;
  title: string;
}> = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || randomUUID(),
    title: overrides.title || 'Test News Item',
    sourceId: randomUUID(),
    url: 'https://example.com/news',
    summary: 'Test summary',
    publishedAt: now,
    topic: 'TECHNOLOGY',
    organization: 'Test Org',
    sector: 'PRIVATE',
    geography: 'US',
    relevance: 0.8,
    relatedOpportunityIds: [],
    discoveredAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Pagination helpers
export function createPaginationParams(overrides: Partial<{
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}> = {}) {
  return {
    page: overrides.page || 1,
    limit: overrides.limit || 20,
    sortBy: overrides.sortBy || 'created_at',
    sortOrder: overrides.sortOrder || 'desc',
  };
}

export function createListResponse<T>(data: T[], page: number, limit: number, total: number, baseUrl: string) {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  const buildUrl = (p: number) => {
    const url = new URL(baseUrl, 'http://localhost:3000');
    url.searchParams.set('page', p.toString());
    url.searchParams.set('limit', limit.toString());
    return url.toString();
  };
  
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
    links: {
      first: buildUrl(1),
      last: buildUrl(totalPages),
      ...(hasPrev && { prev: buildUrl(page - 1) }),
      ...(hasNext && { next: buildUrl(page + 1) }),
    },
  };
}

// ============================================
// Mock Service Factories
// ============================================

export function createMockDiscoveryService() {
  return {
    createJob: vi.fn().mockResolvedValue(createTestDiscoveryJob()),
    getJob: vi.fn().mockResolvedValue(createTestDiscoveryJob()),
    executeJob: vi.fn().mockResolvedValue(createTestDiscoveryRun()),
    scheduleRun: vi.fn().mockResolvedValue({ runId: randomUUID() }),
    getRunStatus: vi.fn().mockResolvedValue(createTestDiscoveryRun()),
    cancelRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'CANCELLED' })),
    pauseRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'PAUSED' })),
    resumeRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'RUNNING' })),
    pollRunStatus: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'SUCCEEDED' })),
    listRuns: vi.fn().mockResolvedValue({ data: [createTestDiscoveryRun()], total: 1 }),
    getRunResults: vi.fn().mockResolvedValue({ run: createTestDiscoveryRun(), opportunities: [] }),
  };
}

export function createMockOpportunityService() {
  return {
    create: vi.fn().mockResolvedValue(createTestOpportunity()),
    getById: vi.fn().mockResolvedValue(createTestOpportunity()),
    getByStableId: vi.fn().mockResolvedValue(createTestOpportunity()),
    list: vi.fn().mockResolvedValue({ data: [createTestOpportunity()], total: 1 }),
    update: vi.fn().mockResolvedValue(createTestOpportunity()),
    delete: vi.fn().mockResolvedValue(true),
    getVersions: vi.fn().mockResolvedValue([]),
    getIntelligence: vi.fn().mockResolvedValue({
      opportunityId: randomUUID(),
      classification: { primaryCategory: 'TECHNOLOGY', confidence: 0.9 },
      requirements: [],
      eligibility: undefined,
      match: undefined,
      explanation: { summary: 'Test', strengths: [], gaps: [], recommendations: [] },
      scoredAt: new Date().toISOString(),
      version: 1,
    }),
    getMatches: vi.fn().mockResolvedValue([]),
    getDeadlineDetails: vi.fn().mockResolvedValue({}),
    reprocess: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockMatchService() {
  return {
    createMatchesForCandidate: vi.fn().mockResolvedValue([createTestMatch()]),
    list: vi.fn().mockResolvedValue({ data: [createTestMatch()], total: 1 }),
    getById: vi.fn().mockResolvedValue(createTestMatch()),
    getForCandidate: vi.fn().mockResolvedValue({ data: [createTestMatch()], total: 1 }),
  };
}

export function createMockNewsService() {
  return {
    create: vi.fn().mockResolvedValue(createTestNewsItem()),
    getById: vi.fn().mockResolvedValue(createTestNewsItem()),
    list: vi.fn().mockResolvedValue({ data: [createTestNewsItem()], total: 1 }),
    update: vi.fn().mockResolvedValue(createTestNewsItem()),
    delete: vi.fn().mockResolvedValue(true),
    getRelatedOpportunities: vi.fn().mockResolvedValue([]),
  };
}

export function createMockApplicationService() {
  return {
    create: vi.fn().mockResolvedValue(createTestApplication()),
    getById: vi.fn().mockResolvedValue(createTestApplication()),
    list: vi.fn().mockResolvedValue({ data: [createTestApplication()], total: 1 }),
    update: vi.fn().mockResolvedValue(createTestApplication()),
    delete: vi.fn().mockResolvedValue(true),
    getForCandidate: vi.fn().mockResolvedValue({ data: [createTestApplication()], total: 1 }),
    sendReminder: vi.fn().mockResolvedValue({}),
    getReminderHistory: vi.fn().mockResolvedValue([]),
  };
}

export function createMockVerificationService() {
  return {
    create: vi.fn().mockResolvedValue(createTestVerificationRun()),
    getById: vi.fn().mockResolvedValue(createTestVerificationRun()),
    list: vi.fn().mockResolvedValue({ data: [createTestVerificationRun()], total: 1 }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockReprocessingService() {
  return {
    create: vi.fn().mockResolvedValue(createTestReprocessingRun()),
    getById: vi.fn().mockResolvedValue(createTestReprocessingRun()),
    list: vi.fn().mockResolvedValue({ data: [createTestReprocessingRun()], total: 1 }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================
// Import vi for use in factory functions
// ============================================
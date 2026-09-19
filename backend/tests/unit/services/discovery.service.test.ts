import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockJob = { id: 'job-123', status: 'CREATED', sourceIds: ['src-1'], category: 'TECH', createdAt: new Date().toISOString() };
const mockRun = { id: 'run-123', status: 'SUCCEEDED', jobId: 'job-123', createdAt: new Date().toISOString() };

vi.mock('@/discovery/pipeline-orchestrator', () => ({
  PipelineOrchestrator: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/discovery/run-management/run-coordinator', () => ({
  RunCoordinator: vi.fn().mockImplementation(() => ({
    scheduleRun: vi.fn().mockResolvedValue({ runId: 'run-123' }),
    startRun: vi.fn().mockResolvedValue({ ...mockRun, status: 'RUNNING' }),
    getRunStatus: vi.fn().mockResolvedValue(mockRun),
    cancelRun: vi.fn().mockResolvedValue({ ...mockRun, status: 'CANCELLED' }),
    pauseRun: vi.fn().mockResolvedValue({ ...mockRun, status: 'PAUSED' }),
    resumeRun: vi.fn().mockResolvedValue({ ...mockRun, status: 'RUNNING' }),
    pollRunStatus: vi.fn().mockResolvedValue({ ...mockRun, status: 'SUCCEEDED' }),
    getPersistence: vi.fn().mockReturnValue({
      listRuns: vi.fn().mockResolvedValue([mockRun]),
    }),
  })),
  InMemoryRunPersistence: vi.fn().mockImplementation(() => ({
    listRuns: vi.fn().mockResolvedValue([mockRun]),
  })),
}));

vi.mock('@/discovery/discovery-engine', () => ({
  DiscoveryEngine: vi.fn().mockImplementation(() => ({
    createJob: vi.fn().mockResolvedValue(mockJob),
    getJob: vi.fn().mockResolvedValue(mockJob),
    executeJob: vi.fn().mockResolvedValue(mockRun),
  })),
}));

const { DiscoveryService } = await import('@/services/discovery.service.js');

describe('DiscoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create job via engine', async () => {
    const service = new DiscoveryService();
    const job = await service.createJob({ sourceIds: ['source-1'], category: 'TECH' });
    expect(job).toBeDefined();
  });

  it('should get job via engine', async () => {
    const service = new DiscoveryService();
    const job = await service.getJob('job-123');
    expect(job).toBeDefined();
  });

  it('should execute job via engine', async () => {
    const service = new DiscoveryService();
    const run = await service.executeJob('job-123');
    expect(run).toBeDefined();
  });

  it('should schedule run via runCoordinator', async () => {
    const service = new DiscoveryService();
    const request = { jobId: 'job-123', sources: ['source-1'] };
    const run = await service.scheduleRun(request);
    expect(run).toEqual({ runId: 'run-123' });
  });

  it('should get run status via runCoordinator', async () => {
    const service = new DiscoveryService();
    const run = await service.getRunStatus('run-123');
    expect(run).toBeDefined();
  });

  it('should cancel run via runCoordinator', async () => {
    const service = new DiscoveryService();
    const request = { runId: 'run-123', reason: 'User cancelled' };
    const run = await service.cancelRun(request);
    expect(run.status).toBe('CANCELLED');
  });

  it('should pause run via runCoordinator', async () => {
    const service = new DiscoveryService();
    const run = await service.pauseRun('run-123');
    expect(run.status).toBe('PAUSED');
  });

  it('should resume run via runCoordinator', async () => {
    const service = new DiscoveryService();
    const run = await service.resumeRun('run-123');
    expect(run.status).toBe('RUNNING');
  });

  it('should poll run status via runCoordinator', async () => {
    const service = new DiscoveryService();
    const options = { runId: 'run-123', intervalMs: 1000, timeoutMs: 30000 };
    const run = await service.pollRunStatus(options);
    expect(run.status).toBe('SUCCEEDED');
  });

  it('should list runs with filters', async () => {
    const service = new DiscoveryService();
    const filters = { status: 'RUNNING', jobId: 'job-123', limit: 10 };
    const runs = await service.listRuns(filters);
    expect(runs).toHaveLength(1);
  });

  it('should get run results', async () => {
    const service = new DiscoveryService();
    const result = await service.getRunResults('run-123');
    expect(result.run).toBeDefined();
    expect(result.opportunities).toEqual([]);
  });
});

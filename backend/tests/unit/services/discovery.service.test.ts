import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryService } from '@/services/discovery.service.js';
import { createTestDiscoveryJob, createTestDiscoveryRun } from '@tests/factories.js';

vi.mock('@/discovery/discovery-engine', () => ({
  DiscoveryEngine: vi.fn().mockImplementation(() => ({
    createJob: vi.fn().mockResolvedValue(createTestDiscoveryJob()),
    getJob: vi.fn().mockResolvedValue(createTestDiscoveryJob()),
    executeJob: vi.fn().mockResolvedValue(createTestDiscoveryRun()),
  })),
}));

vi.mock('@/discovery/run-management/run-coordinator', () => ({
  RunCoordinator: vi.fn().mockImplementation(() => ({
    scheduleRun: vi.fn().mockResolvedValue({ runId: 'run-123' }),
    startRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'RUNNING' })),
    getRunStatus: vi.fn().mockResolvedValue(createTestDiscoveryRun()),
    cancelRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'CANCELLED' })),
    pauseRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'PAUSED' })),
    resumeRun: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'RUNNING' })),
    pollRunStatus: vi.fn().mockResolvedValue(createTestDiscoveryRun({ status: 'SUCCEEDED' })),
    getPersistence: vi.fn().mockReturnValue({
      listRuns: vi.fn().mockResolvedValue([createTestDiscoveryRun()]),
    }),
  })),
}));

vi.mock('@/discovery/pipeline-orchestrator');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create job via engine', async () => {
    const service = new DiscoveryService();
    const options = { sourceIds: ['source-1'], category: 'TECH' };
    const job = await service.createJob(options);
    
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
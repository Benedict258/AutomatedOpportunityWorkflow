import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReprocessingService } from '@/services/reprocessing.service.js';
import { createMockReprocessingService, createTestReprocessingRun } from '@tests/factories.js';

vi.mock('@/db/connection.js');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ReprocessingService', () => {
  let service: ReprocessingService;
  let mockExecuteQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery = vi.fn();
    vi.mocked(require('@/db/connection.js').executeQuery).mockImplementation(mockExecuteQuery);
  });

  it('should create reprocessing run', async () => {
    const input = { opportunityIds: ['opp-1'], forceReprocess: true };
    const created = createTestReprocessingRun({ forceReprocess: true });
    mockExecuteQuery.mockResolvedValue({ rows: [created] });
    
    const result = await service.create(input);
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reprocessing_runs'),
      expect.arrayContaining([expect.any(String), ['opp-1'], 'PENDING', expect.any(String), expect.any(String), true])
    );
    expect(result.forceReprocess).toBe(true);
  });

  it('should get reprocessing run by ID', async () => {
    const run = createTestReprocessingRun({ id: 'run-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [run] });
    
    const result = await service.getById('run-123');
    
    expect(result?.id).toBe('run-123');
  });

  it('should list reprocessing runs with filters', async () => {
    const runs = [createTestReprocessingRun(), createTestReprocessingRun()];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: runs });
    
    const result = await service.list({ status: 'RUNNING' });
    
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should update run status with results', async () => {
    mockExecuteQuery.mockResolvedValue({});
    
    await service.updateStatus('run-123', 'SUCCEEDED', [{ opportunityId: 'opp-1', reprocessed: true, intelligenceUpdated: true }]);
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reprocessing_runs SET status = $2'),
      expect.arrayContaining(['run-123', 'SUCCEEDED'])
    );
  });
});

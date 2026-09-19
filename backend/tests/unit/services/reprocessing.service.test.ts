import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReprocessingService } from '@/services/reprocessing.service.js';
import { createTestReprocessingRun } from '@tests/factories.js';
import { executeQuery } from '@/db/connection';

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockExecuteQuery = vi.mocked(executeQuery);

describe('ReprocessingService', () => {
  let service: ReprocessingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery.mockReset();
    service = new ReprocessingService();
  });

  it('should create reprocessing run', async () => {
    const input = { opportunityIds: ['opp-1'], forceReprocess: true };
    const created = createTestReprocessingRun({ forceReprocess: true });
    mockExecuteQuery.mockResolvedValue({ rows: [created] });
    
    const result = await service.create(input);
    
    expect(executeQuery).toHaveBeenCalledWith(
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
    
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reprocessing_runs SET status = $2'),
      expect.arrayContaining(['run-123', 'SUCCEEDED'])
    );
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationService } from '@/services/verification.service.js';
import { createMockVerificationService, createTestVerificationRun } from '@tests/factories.js';

vi.mock('@/db/connection.js');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('VerificationService', () => {
  let service: VerificationService;
  let mockExecuteQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery = vi.fn();
    vi.mocked(require('@/db/connection.js').executeQuery).mockImplementation(mockExecuteQuery);
  });

  it('should create verification run', async () => {
    const input = { opportunityIds: ['opp-1', 'opp-2'], triggeredBy: 'manual' };
    const created = createTestVerificationRun({ opportunityIds: ['opp-1', 'opp-2'] });
    mockExecuteQuery.mockResolvedValue({ rows: [created] });
    
    const result = await service.create(input);
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO verification_runs'),
      expect.arrayContaining([expect.any(String), ['opp-1', 'opp-2'], 'PENDING'])
    );
    expect(result.opportunityIds).toHaveLength(2);
  });

  it('should get verification run by ID', async () => {
    const run = createTestVerificationRun({ id: 'run-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [run] });
    
    const result = await service.getById('run-123');
    
    expect(result?.id).toBe('run-123');
  });

  it('should list verification runs with filters', async () => {
    const runs = [createTestVerificationRun(), createTestVerificationRun()];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: runs });
    
    const result = await service.list({ status: 'SUCCEEDED', page: 1, limit: 20 });
    
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should update run status', async () => {
    mockExecuteQuery.mockResolvedValue({});
    
    await service.updateStatus('run-123', 'SUCCEEDED', [{ opportunityId: 'opp-1', verified: true }], null);
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE verification_runs SET status = $2'),
      expect.arrayContaining(['run-123', 'SUCCEEDED'])
    );
  });

  it('should set completedAt when status is terminal', async () => {
    mockExecuteQuery.mockResolvedValue({});
    
    await service.updateStatus('run-123', 'SUCCEEDED');
    
    const updateQuery = mockExecuteQuery.mock.calls[0][0];
    expect(updateQuery).toContain('completed_at');
  });

  it('should not set completedAt for PENDING status', async () => {
    mockExecuteQuery.mockResolvedValue({});
    
    await service.updateStatus('run-123', 'PENDING');
    
    const updateQuery = mockExecuteQuery.mock.calls[0][0];
    expect(updateQuery).not.toContain('completed_at');
  });
});

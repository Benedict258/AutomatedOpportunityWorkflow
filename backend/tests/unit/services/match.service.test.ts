import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchService } from '@/services/match.service.js';
import { createMockMatchService, createTestMatch } from '@tests/factories.js';

vi.mock('@/db/connection.js');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MatchService', () => {
  let service: MatchService;
  let mockExecuteQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery = vi.fn();
    vi.mocked(require('@/db/connection.js').executeQuery).mockImplementation(mockExecuteQuery);
  });

  it('should create matches for candidate', async () => {
    const request = { candidateId: 'cand-123', opportunityIds: ['opp-1', 'opp-2'] };
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    const result = await service.createMatchesForCandidate(request);
    
    expect(result).toEqual([]);
  });

  it('should list matches with filters', async () => {
    const matches = [createTestMatch(), createTestMatch()];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count
      .mockResolvedValueOnce({ rows: matches }); // data
    
    const result = await service.list({
      candidateId: 'cand-123',
      status: 'COMPUTED',
      minScore: 0.7,
      page: 1,
      limit: 20,
    });
    
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should get match by ID', async () => {
    const match = createTestMatch({ id: 'match-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [match] });
    
    const result = await service.getById('match-123');
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      'SELECT * FROM candidate_matches WHERE id = $1',
      ['match-123']
    );
    expect(result?.id).toBe('match-123');
  });

  it('should get matches for candidate', async () => {
    const matches = [createTestMatch({ candidateId: 'cand-123' })];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: matches });
    
    const result = await service.getForCandidate('cand-123', { status: 'COMPUTED' });
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].candidateId).toBe('cand-123');
  });

  it('should apply default pagination', async () => {
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    
    await service.list({});
    
    // Check that defaults are applied in the query
    expect(mockExecuteQuery).toHaveBeenCalledTimes(2);
  });

  it('should apply score filters', async () => {
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    
    await service.list({ minScore: 0.5, maxScore: 0.9 });
    
    // The query should include score filters
    const countQuery = mockExecuteQuery.mock.calls[0][0];
    expect(countQuery).toContain('minScore');
    expect(countQuery).toContain('maxScore');
  });

  it('should apply date filters', async () => {
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    
    await service.list({ computedAfter: '2024-01-01', computedBefore: '2024-12-31' });
    
    const countQuery = mockExecuteQuery.mock.calls[0][0];
    expect(countQuery).toContain('computed_after');
    expect(countQuery).toContain('computed_before');
  });
});

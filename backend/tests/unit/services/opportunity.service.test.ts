import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpportunityService } from '@/services/opportunity.service.js';
import { createTestOpportunity } from '@tests/factories.js';
import { executeQuery } from '@/db/connection';

vi.mock('../../../src/persistence/pg-opportunity-repository.js', () => ({
  PgOpportunityRepository: vi.fn().mockImplementation(() => ({
    upsert: vi.fn().mockResolvedValue({
      id: 'opp-123',
      stable_id: 'stable-123',
      source_id: 'source-123',
      external_id: 'ext-123',
      title: 'New Opportunity',
      organization: 'Org',
      description: null,
      url: null,
      location: null,
      remote_info: null,
      opportunity_type: null,
      category_ids: [],
      status: 'active',
      publication_date: null,
      application_deadline: null,
      deadline_type: 'hard',
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      last_verified_at: null,
      closed_at: null,
      lifecycle_stage: null,
      embedding: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    findBySourceAndExternal: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../../src/persistence/opportunity-persister.js', () => ({
  OpportunityPersister: vi.fn().mockImplementation(() => ({
    persist: vi.fn().mockResolvedValue({ inserted: 1, updated: 0, opportunities: [createTestOpportunity()] }),
  })),
}));

vi.mock('../../../src/discovery/versioning/version-manager.js', () => ({
  VersionManager: vi.fn().mockImplementation(() => ({
    createVersion: vi.fn().mockResolvedValue(undefined),
    getLifecycle: vi.fn().mockResolvedValue([]),
    getVersions: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('../../../src/intelligence/timing/timing-intelligence-engine.js', () => ({
  TimingIntelligenceEngine: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({ deadline: '2024-12-31', daysRemaining: 30 }),
    assess: vi.fn().mockReturnValue({ deadline: '2024-12-31', daysRemaining: 30 }),
  })),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockExecuteQuery = vi.mocked(executeQuery);

describe('OpportunityService', () => {
  let service: OpportunityService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery.mockReset();
  });

  it('should create opportunity', async () => {
    const service = new OpportunityService();
    const input = {
      sourceId: 'source-123',
      title: 'New Opportunity',
      organization: 'Org',
    };
    
    mockExecuteQuery.mockResolvedValue({ rows: [createTestOpportunity()] });
    
    const result = await service.create(input);
    
    expect(result).toBeDefined();
  });

  it('should get opportunity by ID', async () => {
    const service = new OpportunityService();
    const opportunity = createTestOpportunity({ id: 'opp-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [opportunity] });
    
    const result = await service.getById('opp-123');
    
    expect(executeQuery).toHaveBeenCalledWith(
      'SELECT * FROM opportunities WHERE id = $1',
      ['opp-123']
    );
    expect(result?.id).toBe('opp-123');
  });

  it('should return null for non-existent opportunity', async () => {
    const service = new OpportunityService();
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    const result = await service.getById('non-existent');
    
    expect(result).toBeNull();
  });

  it('should get opportunity by stable ID', async () => {
    const service = new OpportunityService();
    const opportunity = createTestOpportunity({ stableId: 'stable-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [opportunity] });
    
    const result = await service.getByStableId('stable-123');
    
    expect(executeQuery).toHaveBeenCalledWith(
      'SELECT * FROM opportunities WHERE stable_id = $1',
      ['stable-123']
    );
    expect(result?.stableId).toBe('stable-123');
  });

  it('should list opportunities with filters', async () => {
    const service = new OpportunityService();
    const opportunities = [createTestOpportunity(), createTestOpportunity()];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: opportunities });
    
    const result = await service.list({
      page: 1,
      limit: 20,
      status: 'ACTIVE',
      category: 'cat-123',
      search: 'fellowship',
    });
    
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should update opportunity', async () => {
    const service = new OpportunityService();
    const existing = createTestOpportunity({ id: 'opp-123' });
    const updated = createTestOpportunity({ id: 'opp-123', title: 'Updated Title' });
    
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [existing] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [updated] });
    
    const result = await service.update('opp-123', { title: 'Updated Title' });
    
    expect(result?.title).toBe('Updated Title');
  });

  it('should return null when updating non-existent opportunity', async () => {
    const service = new OpportunityService();
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    const result = await service.update('non-existent', { title: 'New' });
    
    expect(result).toBeNull();
  });

  it('should delete opportunity', async () => {
    const service = new OpportunityService();
    mockExecuteQuery.mockResolvedValue({ rowCount: 1 });
    
    const result = await service.delete('opp-123');
    
    expect(executeQuery).toHaveBeenCalledWith(
      'DELETE FROM opportunities WHERE id = $1',
      ['opp-123']
    );
    expect(result).toBe(true);
  });

  it('should get versions via versionManager', async () => {
    const service = new OpportunityService();
    const versions = [{ id: 'v1', versionNumber: 1 }, { id: 'v2', versionNumber: 2 }];
    
    const { VersionManager } = await import('../../../src/discovery/versioning/version-manager.js');
    const versionManagerInstance = vi.mocked(VersionManager).mock.results[0]?.value;
    if (versionManagerInstance) {
      vi.spyOn(versionManagerInstance, 'getVersions').mockReturnValue(versions as any);
    }
    
    const result = await service.getVersions('opp-123');
    
    expect(result).toHaveLength(2);
  });

  it('should get intelligence', async () => {
    const service = new OpportunityService();
    const opportunity = createTestOpportunity({ id: 'opp-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [opportunity] });
    
    const result = await service.getIntelligence('opp-123');
    
    expect(result).toBeDefined();
    expect(result?.opportunityId).toBe('opp-123');
    expect(result?.classification.primaryCategory).toBe('UNKNOWN');
  });

  it('should return null intelligence for non-existent opportunity', async () => {
    const service = new OpportunityService();
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    const result = await service.getIntelligence('non-existent');
    
    expect(result).toBeNull();
  });

  it('should get deadline details', async () => {
    const service = new OpportunityService();
    const opportunity = createTestOpportunity({ id: 'opp-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [opportunity] });
    
    const result = await service.getDeadlineDetails('opp-123');
    
    expect(result).toEqual({ deadline: '2024-12-31', daysRemaining: 30 });
  });

  it('should trigger reprocessing', async () => {
    const service = new OpportunityService();
    await service.reprocess('opp-123');
  });

  it('should trigger verification', async () => {
    const service = new OpportunityService();
    await service.verify('opp-123');
  });
});
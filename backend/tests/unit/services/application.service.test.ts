import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationService } from '@/services/application.service.js';
import { createMockApplicationService, createTestApplication } from '@tests/factories.js';

vi.mock('@/db/connection.js');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ApplicationService', () => {
  let service: ApplicationService;
  let mockExecuteQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery = vi.fn();
    vi.mocked(require('@/db/connection.js').executeQuery).mockImplementation(mockExecuteQuery);
  });

  it('should create application', async () => {
    const input = { opportunityId: 'opp-123', status: 'DRAFT' };
    const userId = 'user-123';
    const created = createTestApplication({ opportunityId: 'opp-123', userId });
    mockExecuteQuery.mockResolvedValue({ rows: [created] });
    
    const result = await service.create(input, userId);
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO application_references'),
      expect.arrayContaining([input.opportunityId, userId])
    );
    expect(result.userId).toBe(userId);
  });

  it('should get application by ID', async () => {
    const app = createTestApplication({ id: 'app-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [app] });
    
    const result = await service.getById('app-123');
    
    expect(result?.id).toBe('app-123');
  });

  it('should list applications', async () => {
    const apps = [createTestApplication(), createTestApplication()];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: apps });
    
    const result = await service.list({ status: 'SUBMITTED' }, 'user-123');
    
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should update application', async () => {
    const existing = createTestApplication({ id: 'app-123' });
    const updated = createTestApplication({ id: 'app-123', status: 'SUBMITTED' });
    
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [existing] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [updated] });
    
    const result = await service.update('app-123', { status: 'SUBMITTED' });
    
    expect(result?.status).toBe('SUBMITTED');
  });

  it('should delete application', async () => {
    mockExecuteQuery.mockResolvedValue({ rowCount: 1 });
    
    const result = await service.delete('app-123');
    
    expect(result).toBe(true);
  });

  it('should get applications for candidate', async () => {
    const apps = [createTestApplication({ userId: 'cand-123' })];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: apps });
    
    const result = await service.getForCandidate('cand-123', { status: 'DRAFT' });
    
    expect(result.data[0].userId).toBe('cand-123');
  });

  it('should send reminder', async () => {
    const app = createTestApplication({ id: 'app-123' });
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [app] }) // getById
      .mockResolvedValueOnce({ rows: [{ id: 'notif-123' }] }); // INSERT notification
    
    const result = await service.sendReminder('app-123', { type: 'DEADLINE', channel: 'EMAIL' });
    
    expect(result.applicationId).toBe('app-123');
    expect(result.type).toBe('DEADLINE');
    expect(result.status).toBe('PENDING');
  });

  it('should throw when sending reminder for non-existent application', async () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    await expect(service.sendReminder('non-existent', { type: 'DEADLINE' }))
      .rejects.toThrow('Application not found');
  });

  it('should get reminder history', async () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    const result = await service.getReminderHistory('app-123');
    
    expect(result).toEqual([]);
  });
});

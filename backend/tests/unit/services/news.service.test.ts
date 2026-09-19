import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsService } from '@/services/news.service.js';
import { createMockNewsService, createTestNewsItem } from '@tests/factories.js';

vi.mock('@/db/connection.js');
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NewsService', () => {
  let service: NewsService;
  let mockExecuteQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteQuery = vi.fn();
    vi.mocked(require('@/db/connection.js').executeQuery).mockImplementation(mockExecuteQuery);
  });

  it('should create news item', async () => {
    const input = { title: 'News', sourceId: 'src-1', url: 'https://example.com', publishedAt: new Date().toISOString() };
    const created = createTestNewsItem({ title: 'News' });
    mockExecuteQuery.mockResolvedValue({ rows: [created] });
    
    const result = await service.create(input);
    
    expect(mockExecuteQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO news_items'),
      expect.arrayContaining([input.title, input.sourceId, input.url])
    );
    expect(result.title).toBe('News');
  });

  it('should get news by ID', async () => {
    const news = createTestNewsItem({ id: 'news-123' });
    mockExecuteQuery.mockResolvedValue({ rows: [news] });
    
    const result = await service.getById('news-123');
    
    expect(result?.id).toBe('news-123');
  });

  it('should list news with filters', async () => {
    const news = [createTestNewsItem(), createTestNewsItem()];
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: news });
    
    const result = await service.list({ topic: 'TECHNOLOGY', minRelevance: 0.7 });
    
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should update news', async () => {
    const existing = createTestNewsItem({ id: 'news-123' });
    const updated = createTestNewsItem({ id: 'news-123', title: 'Updated' });
    
    mockExecuteQuery
      .mockResolvedValueOnce({ rows: [existing] }) // getById
      .mockResolvedValueOnce({}) // UPDATE
      .mockResolvedValueOnce({ rows: [updated] }); // getById
    
    const result = await service.update('news-123', { title: 'Updated' });
    
    expect(result?.title).toBe('Updated');
  });

  it('should return null when updating non-existent', async () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    const result = await service.update('non-existent', { title: 'New' });
    
    expect(result).toBeNull();
  });

  it('should delete news', async () => {
    mockExecuteQuery.mockResolvedValue({ rowCount: 1 });
    
    const result = await service.delete('news-123');
    
    expect(result).toBe(true);
  });

  it('should return related opportunities', async () => {
    const news = createTestNewsItem({ relatedOpportunityIds: ['opp-1'] });
    mockExecuteQuery.mockResolvedValue({ rows: [news] });
    
    const result = await service.getRelatedOpportunities('news-123');
    
    expect(result).toEqual([]);
  });
});

import { getPool, executeQuery } from '../db/connection';
import { NewsItem, CreateNewsItem, UpdateNewsItem, NewsFilters } from '../schemas/news';
import { logger } from '../utils/logger.js';

export class NewsService {
  async create(news: CreateNewsItem): Promise<NewsItem> {
    logger.info({ title: news.title }, 'Creating news item');
    
    const result = await executeQuery<NewsItem>(
      `INSERT INTO news_items (title, source_id, url, summary, published_at, topic, organization, sector, geography, relevance, related_opportunity_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        news.title,
        news.sourceId,
        news.url,
        news.summary,
        news.publishedAt,
        news.topic,
        news.organization,
        news.sector,
        news.geography,
        news.relevance,
        news.relatedOpportunityIds || [],
      ]
    );
    
    return result.rows[0];
  }

  async getById(id: string): Promise<NewsItem | null> {
    const result = await executeQuery<NewsItem>(
      'SELECT * FROM news_items WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async list(filters: NewsFilters): Promise<{ data: NewsItem[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'discovered_at', sortOrder = 'desc', ...filterParams } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filterParams.topic) {
      whereClause += ` AND topic = $${paramIndex}`;
      params.push(filterParams.topic);
      paramIndex++;
    }

    if (filterParams.sourceId) {
      whereClause += ` AND source_id = $${paramIndex}`;
      params.push(filterParams.sourceId);
      paramIndex++;
    }

    if (filterParams.organization) {
      whereClause += ` AND organization ILIKE $${paramIndex}`;
      params.push(`%${filterParams.organization}%`);
      paramIndex++;
    }

    if (filterParams.sector) {
      whereClause += ` AND sector = $${paramIndex}`;
      params.push(filterParams.sector);
      paramIndex++;
    }

    if (filterParams.geography) {
      whereClause += ` AND geography = $${paramIndex}`;
      params.push(filterParams.geography);
      paramIndex++;
    }

    if (filterParams.dateFrom) {
      whereClause += ` AND discovered_at >= $${paramIndex}`;
      params.push(filterParams.dateFrom);
      paramIndex++;
    }

    if (filterParams.dateTo) {
      whereClause += ` AND discovered_at <= $${paramIndex}`;
      params.push(filterParams.dateTo);
      paramIndex++;
    }

    if (filterParams.minRelevance !== undefined) {
      whereClause += ` AND relevance >= $${paramIndex}`;
      params.push(filterParams.minRelevance);
      paramIndex++;
    }

    const allowedSortColumns = ['discovered_at', 'published_at', 'created_at', 'relevance'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'discovered_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countResult = await executeQuery<{ count: string }>(
      `SELECT COUNT(*) FROM news_items ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data
    params.push(limit, offset);
    const dataResult = await executeQuery<NewsItem>(
      `SELECT * FROM news_items ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { data: dataResult.rows, total };
  }

  async update(id: string, updates: UpdateNewsItem): Promise<NewsItem | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const setClause: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    const allowedFields = [
      'title', 'source_id', 'url', 'summary', 'published_at',
      'topic', 'organization', 'sector', 'geography', 'relevance',
      'related_opportunity_ids'
    ];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        setClause.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return existing;
    }

    setClause.push(`updated_at = NOW()`);

    await executeQuery(
      `UPDATE news_items SET ${setClause.join(', ')} WHERE id = $1`,
      params
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await executeQuery(
      'DELETE FROM news_items WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getRelatedOpportunities(newsId: string): Promise<NewsItem[]> {
    const news = await this.getById(newsId);
    if (!news || !news.relatedOpportunityIds || news.relatedOpportunityIds.length === 0) {
      return [];
    }

    // This would typically join with opportunities table
    // For now, return empty array
    return [];
  }
}

let newsServiceInstance: NewsService | null = null;

export function getNewsService(): NewsService {
  if (!newsServiceInstance) {
    newsServiceInstance = new NewsService();
  }
  return newsServiceInstance;
}
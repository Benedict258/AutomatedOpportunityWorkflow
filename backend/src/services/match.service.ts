import { getPool, executeQuery } from '../db/connection';
import { Match, MatchFilters, CreateMatchRequest } from '../schemas/match';
import { logger } from '../utils/logger.js';

export class MatchService {
  async createMatchesForCandidate(request: CreateMatchRequest): Promise<Match[]> {
    logger.info({ candidateId: request.candidateId, opportunityCount: request.opportunityIds.length }, 'Creating matches for candidate');
    
    // TODO: Implement actual matching using SemanticMatchingEngine, ScoringEngine, RankingEngine
    // For now, return empty array as matching infrastructure needs pgvector
    return [];
  }

  async list(filters: MatchFilters): Promise<{ data: Match[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'computed_at', sortOrder = 'desc', ...filterParams } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filterParams.candidateId) {
      whereClause += ` AND candidate_id = $${paramIndex}`;
      params.push(filterParams.candidateId);
      paramIndex++;
    }

    if (filterParams.opportunityId) {
      whereClause += ` AND opportunity_id = $${paramIndex}`;
      params.push(filterParams.opportunityId);
      paramIndex++;
    }

    if (filterParams.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filterParams.status);
      paramIndex++;
    }

    if (filterParams.minScore !== undefined) {
      whereClause += ` AND (score->>'overall')::numeric >= $${paramIndex}`;
      params.push(filterParams.minScore);
      paramIndex++;
    }

    if (filterParams.maxScore !== undefined) {
      whereClause += ` AND (score->>'overall')::numeric <= $${paramIndex}`;
      params.push(filterParams.maxScore);
      paramIndex++;
    }

    if (filterParams.computedAfter) {
      whereClause += ` AND computed_at >= $${paramIndex}`;
      params.push(filterParams.computedAfter);
      paramIndex++;
    }

    if (filterParams.computedBefore) {
      whereClause += ` AND computed_at <= $${paramIndex}`;
      params.push(filterParams.computedBefore);
      paramIndex++;
    }

    const allowedSortColumns = ['computed_at', 'created_at', 'updated_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'computed_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countResult = await executeQuery<{ count: string }>(
      `SELECT COUNT(*) FROM candidate_matches ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data
    params.push(limit, offset);
    const dataResult = await executeQuery<Match>(
      `SELECT * FROM candidate_matches ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { data: dataResult.rows, total };
  }

  async getById(id: string): Promise<Match | null> {
    const result = await executeQuery<Match>(
      'SELECT * FROM candidate_matches WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getForCandidate(candidateId: string, filters: MatchFilters = {} as MatchFilters): Promise<{ data: Match[]; total: number }> {
    return this.list({ ...filters, candidateId } as MatchFilters);
  }
}

let matchServiceInstance: MatchService | null = null;

export function getMatchService(): MatchService {
  if (!matchServiceInstance) {
    matchServiceInstance = new MatchService();
  }
  return matchServiceInstance;
}
import { getPool, executeQuery } from '../db/connection';
import { VerificationRun, CreateVerificationRun, VerificationFilters, verificationStatusSchema } from '../schemas/verification';
import { logger } from '../utils/logger.js';

export class VerificationService {
  async create(run: CreateVerificationRun): Promise<VerificationRun> {
    logger.info({ opportunityCount: run.opportunityIds.length }, 'Creating verification run');
    
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await executeQuery<VerificationRun>(
      `INSERT INTO verification_runs (id, opportunity_ids, status, started_at, triggered_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id,
        run.opportunityIds,
        'PENDING',
        now,
        run.triggeredBy,
        run.metadata || {},
      ]
    );
    
    // TODO: Trigger actual verification via VerificationEngine
    // This would be async - update status to RUNNING then process
    
    return result.rows[0];
  }

  async getById(id: string): Promise<VerificationRun | null> {
    const result = await executeQuery<VerificationRun>(
      'SELECT * FROM verification_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async list(filters: VerificationFilters): Promise<{ data: VerificationRun[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', ...filterParams } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filterParams.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filterParams.status);
      paramIndex++;
    }

    if (filterParams.triggeredBy) {
      whereClause += ` AND triggered_by = $${paramIndex}`;
      params.push(filterParams.triggeredBy);
      paramIndex++;
    }

    if (filterParams.dateFrom) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(filterParams.dateFrom);
      paramIndex++;
    }

    if (filterParams.dateTo) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(filterParams.dateTo);
      paramIndex++;
    }

    const allowedSortColumns = ['created_at', 'started_at', 'completed_at'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countResult = await executeQuery<{ count: string }>(
      `SELECT COUNT(*) FROM verification_runs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data
    params.push(limit, offset);
    const dataResult = await executeQuery<VerificationRun>(
      `SELECT * FROM verification_runs ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { data: dataResult.rows, total };
  }

  async updateStatus(id: string, status: string, results?: any[], error?: string): Promise<void> {
    const updates: string[] = ['status = $2'];
    const params: unknown[] = [id, status];
    let paramIndex = 3;

    if (status === 'RUNNING' || status === 'SUCCEEDED' || status === 'FAILED' || status === 'PARTIAL') {
      updates.push(`completed_at = $${paramIndex}`);
      params.push(new Date().toISOString());
      paramIndex++;
    }

    if (results) {
      updates.push(`results = $${paramIndex}`);
      params.push(JSON.stringify(results));
      paramIndex++;
    }

    if (error) {
      updates.push(`error = $${paramIndex}`);
      params.push(error);
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);

    await executeQuery(
      `UPDATE verification_runs SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
  }
}

let verificationServiceInstance: VerificationService | null = null;

export function getVerificationService(): VerificationService {
  if (!verificationServiceInstance) {
    verificationServiceInstance = new VerificationService();
  }
  return verificationServiceInstance;
}
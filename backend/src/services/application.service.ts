import { getPool, executeQuery } from '../db/connection';
import { Application, CreateApplication, UpdateApplication, ApplicationFilters, Reminder, SendReminderRequest } from '../schemas/application';
import { logger } from '../utils/logger.js';

export class ApplicationService {
  async create(application: CreateApplication, userId: string): Promise<Application> {
    logger.info({ opportunityId: application.opportunityId, userId }, 'Creating application');
    
    const result = await executeQuery<Application>(
      `INSERT INTO application_references (opportunity_id, user_id, external_id, application_url, status, notes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        application.opportunityId,
        userId,
        application.externalId,
        application.applicationUrl,
        application.status,
        application.notes,
        application.metadata || {},
      ]
    );
    
    return result.rows[0];
  }

  async getById(id: string): Promise<Application | null> {
    const result = await executeQuery<Application>(
      'SELECT * FROM application_references WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async list(filters: ApplicationFilters, userId?: string): Promise<{ data: Application[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', ...filterParams } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    // Scope to user if provided (candidate-scoped)
    if (userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (filterParams.userId) {
      whereClause += ` AND user_id = $${paramIndex}`;
      params.push(filterParams.userId);
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

    const allowedSortColumns = ['created_at', 'updated_at', 'status'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countResult = await executeQuery<{ count: string }>(
      `SELECT COUNT(*) FROM application_references ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data
    params.push(limit, offset);
    const dataResult = await executeQuery<Application>(
      `SELECT * FROM application_references ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { data: dataResult.rows, total };
  }

  async update(id: string, updates: UpdateApplication): Promise<Application | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const setClause: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    const allowedFields = ['status', 'notes', 'metadata'];

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
      `UPDATE application_references SET ${setClause.join(', ')} WHERE id = $1`,
      params
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await executeQuery(
      'DELETE FROM application_references WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getForCandidate(candidateId: string, filters: ApplicationFilters = {}): Promise<{ data: Application[]; total: number }> {
    return this.list({ ...filters, userId: candidateId });
  }

  // Reminder methods
  async sendReminder(applicationId: string, request: SendReminderRequest): Promise<Reminder> {
    const application = await this.getById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    const scheduledAt = request.scheduledAt || new Date().toISOString();
    
    const result = await executeQuery<Reminder>(
      `INSERT INTO notification_history (notification_id, user_id, channel, sent_at, delivery_status, error_info)
       VALUES (
         (SELECT id FROM notifications WHERE related_entity_type = 'application' AND related_entity_id = $1 LIMIT 1),
         $2, $3, $4, $5, $6
       )
       RETURNING *`,
      [
        applicationId,
        application.userId,
        request.channel,
        scheduledAt,
        'PENDING',
        null,
      ]
    );

    // TODO: Actually send the reminder via notification service
    // For now, return a placeholder
    return {
      id: result.rows[0]?.id || crypto.randomUUID(),
      applicationId,
      type: request.type,
      scheduledAt,
      sentAt: undefined,
      status: 'PENDING',
      channel: request.channel,
      error: undefined,
      createdAt: new Date().toISOString(),
    };
  }

  async getReminderHistory(applicationId: string): Promise<Reminder[]> {
    const result = await executeQuery<Reminder>(
      `SELECT * FROM notification_history 
       WHERE notification_id IN (
         SELECT id FROM notifications WHERE related_entity_type = 'application' AND related_entity_id = $1
       )
       ORDER BY created_at DESC`,
      [applicationId]
    );
    return result.rows;
  }
}

let applicationServiceInstance: ApplicationService | null = null;

export function getApplicationService(): ApplicationService {
  if (!applicationServiceInstance) {
    applicationServiceInstance = new ApplicationService();
  }
  return applicationServiceInstance;
}
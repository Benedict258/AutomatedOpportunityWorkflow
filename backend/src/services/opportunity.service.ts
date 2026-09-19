import { getPool, executeQuery, executeTransaction } from '../db/connection';
import { OpportunityPersister } from '../persistence/opportunity-persister';
import { VersionManager } from '../discovery/versioning/version-manager';
import { TimingIntelligenceEngine } from '../intelligence/timing/timing-intelligence-engine';
import { 
  Opportunity, 
  CreateOpportunity, 
  UpdateOpportunity, 
  OpportunityFilters,
  OpportunityVersion,
  OpportunityIntelligence,
} from '../schemas/opportunity';
import { logger } from '../utils/logger.js';

export class OpportunityService {
  private persister: OpportunityPersister;
  private versionManager: VersionManager;
  private timingEngine: TimingIntelligenceEngine;

  constructor() {
    this.persister = new OpportunityPersister();
    this.versionManager = new VersionManager();
    this.timingEngine = new TimingIntelligenceEngine();
  }

  async create(opportunity: CreateOpportunity): Promise<Opportunity> {
    logger.info({ title: opportunity.title }, 'Creating opportunity');
    
    // Convert to NormalizedOpportunity format for persister
    const normalized = {
      title: opportunity.title,
      sourceId: opportunity.sourceId,
      externalId: opportunity.externalId,
      organization: opportunity.organization,
      description: opportunity.description,
      url: opportunity.url,
      location: opportunity.location,
      remoteInfo: opportunity.remoteInfo,
      opportunityType: opportunity.opportunityType,
      categoryIds: opportunity.categoryIds,
      status: opportunity.status,
      publicationDate: opportunity.publicationDate,
      applicationDeadline: opportunity.applicationDeadline,
      deadlineType: opportunity.deadlineType,
      lifecycleStage: opportunity.lifecycleStage,
    };

    const result = await this.persister.persist([normalized]);
    
    if (result.inserted === 0 && result.updated === 0) {
      throw new Error('Failed to create opportunity');
    }

    const created = result.opportunities[0];
    return this.getById(created.id) as Promise<Opportunity>;
  }

  async getById(id: string): Promise<Opportunity | null> {
    const result = await executeQuery<Opportunity>(
      'SELECT * FROM opportunities WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getByStableId(stableId: string): Promise<Opportunity | null> {
    const result = await executeQuery<Opportunity>(
      'SELECT * FROM opportunities WHERE stable_id = $1',
      [stableId]
    );
    return result.rows[0] || null;
  }

  async list(filters: OpportunityFilters): Promise<{ data: Opportunity[]; total: number }> {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', ...filterParams } = filters;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filterParams.category) {
      whereClause += ` AND $${paramIndex} = ANY(category_ids)`;
      params.push(filterParams.category);
      paramIndex++;
    }

    if (filterParams.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filterParams.status);
      paramIndex++;
    }

    if (filterParams.sourceId) {
      whereClause += ` AND source_id = $${paramIndex}`;
      params.push(filterParams.sourceId);
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

    if (filterParams.search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filterParams.search}%`);
      paramIndex++;
    }

    if (filterParams.hasDeadline !== undefined) {
      if (filterParams.hasDeadline) {
        whereClause += ` AND application_deadline IS NOT NULL`;
      } else {
        whereClause += ` AND application_deadline IS NULL`;
      }
    }

    // Validate sortBy to prevent SQL injection
    const allowedSortColumns = ['created_at', 'updated_at', 'title', 'publication_date', 'application_deadline'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total
    const countResult = await executeQuery<{ count: string }>(
      `SELECT COUNT(*) FROM opportunities ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get data
    params.push(limit, offset);
    const dataResult = await executeQuery<Opportunity>(
      `SELECT * FROM opportunities ${whereClause} ORDER BY ${safeSortBy} ${safeSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { data: dataResult.rows, total };
  }

  async update(id: string, updates: UpdateOpportunity): Promise<Opportunity | null> {
    logger.info({ id, updates }, 'Updating opportunity');
    
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    // Create version before update
    await this.versionManager.createVersion(existing, updates);

    // Build update query
    const setClause: string[] = [];
    const params: unknown[] = [id];
    let paramIndex = 2;

    const allowedFields = [
      'title', 'organization', 'description', 'url', 'location',
      'remote_info', 'opportunity_type', 'category_ids', 'status',
      'publication_date', 'application_deadline', 'deadline_type',
      'lifecycle_stage', 'last_seen_at', 'last_verified_at', 'closed_at'
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
      `UPDATE opportunities SET ${setClause.join(', ')} WHERE id = $1`,
      params
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    logger.info({ id }, 'Deleting opportunity');
    const result = await executeQuery(
      'DELETE FROM opportunities WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getVersions(opportunityId: string): Promise<OpportunityVersion[]> {
    return this.versionManager.getLifecycle(opportunityId);
  }

  async getIntelligence(opportunityId: string): Promise<OpportunityIntelligence | null> {
    const opportunity = await this.getById(opportunityId);
    if (!opportunity) {
      return null;
    }

    // TODO: Implement intelligence retrieval from cached/computed store
    // For now, return a placeholder structure
    return {
      opportunityId,
      classification: {
        primaryCategory: 'UNKNOWN',
        confidence: 0,
      },
      requirements: [],
      eligibility: undefined,
      match: undefined,
      explanation: {
        summary: 'Intelligence not yet computed',
        strengths: [],
        gaps: [],
        recommendations: ['Run intelligence pipeline'],
      },
      scoredAt: new Date().toISOString(),
      version: 1,
    };
  }

  async getMatches(opportunityId: string): Promise<any[]> {
    // TODO: Implement match retrieval
    return [];
  }

  async getDeadlineDetails(opportunityId: string): Promise<any> {
    const opportunity = await this.getById(opportunityId);
    if (!opportunity) {
      return null;
    }

    return this.timingEngine.analyze(opportunity);
  }

  async reprocess(opportunityId: string): Promise<void> {
    logger.info({ opportunityId }, 'Triggering reprocessing');
    // TODO: Trigger intelligence pipeline reprocessing
  }

  async verify(opportunityId: string): Promise<void> {
    logger.info({ opportunityId }, 'Triggering verification');
    // TODO: Trigger verification
  }
}

let opportunityServiceInstance: OpportunityService | null = null;

export function getOpportunityService(): OpportunityService {
  if (!opportunityServiceInstance) {
    opportunityServiceInstance = new OpportunityService();
  }
  return opportunityServiceInstance;
}
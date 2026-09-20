import { PoolClient } from 'pg';
import { getPool, executeTransaction } from '../db/connection.js';
import type { NormalizedOpportunity } from '../adapters/types.js';

export interface OpportunityRow {
  id: string;
  stable_id: string;
  source_id: string;
  external_id: string | null;
  title: string;
  organization: string | null;
  description: string | null;
  url: string | null;
  location: string | null;
  remote_info: any;
  opportunity_type: string | null;
  category_ids: string[];
  status: string;
  publication_date: string | null;
  application_deadline: string | null;
  deadline_type: string;
  first_seen_at: string;
  last_seen_at: string | null;
  last_verified_at: string | null;
  closed_at: string | null;
  lifecycle_stage: string | null;
  embedding: number[] | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
}

export class PgOpportunityRepository {
  private mapRow(row: any): OpportunityRow {
    return {
      id: row.id,
      stable_id: row.stable_id,
      source_id: row.source_id,
      external_id: row.external_id,
      title: row.title,
      organization: row.organization,
      description: row.description,
      url: row.url,
      location: row.location,
      remote_info: row.remote_info,
      opportunity_type: row.opportunity_type,
      category_ids: row.category_ids ?? [],
      status: row.status,
      publication_date: row.publication_date,
      application_deadline: row.application_deadline,
      deadline_type: row.deadline_type,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      last_verified_at: row.last_verified_at,
      closed_at: row.closed_at,
      lifecycle_stage: row.lifecycle_stage,
      embedding: row.embedding ?? null,
      run_id: row.run_id ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async upsert(opportunity: NormalizedOpportunity, sourceInternalId: string, embedding?: number[], runId?: string): Promise<OpportunityRow> {
    const query = `
      INSERT INTO opportunities (
        stable_id, source_id, external_id, title, organization, description, url,
        location, remote_info, opportunity_type, category_ids, status,
        publication_date, application_deadline, deadline_type,
        first_seen_at, last_seen_at, lifecycle_stage, embedding, run_id
      ) VALUES (
        gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW(),$15,$16,$17
      )
      ON CONFLICT (source_id, external_id) DO UPDATE SET
        title = EXCLUDED.title,
        organization = EXCLUDED.organization,
        description = EXCLUDED.description,
        url = EXCLUDED.url,
        location = EXCLUDED.location,
        remote_info = EXCLUDED.remote_info,
        opportunity_type = EXCLUDED.opportunity_type,
        category_ids = EXCLUDED.category_ids,
        status = EXCLUDED.status,
        publication_date = EXCLUDED.publication_date,
        application_deadline = EXCLUDED.application_deadline,
        deadline_type = EXCLUDED.deadline_type,
        last_seen_at = NOW(),
        lifecycle_stage = EXCLUDED.lifecycle_stage,
        embedding = EXCLUDED.embedding,
        run_id = COALESCE(EXCLUDED.run_id, opportunities.run_id),
        updated_at = NOW()
      RETURNING *;
    `;
    const params = [
      sourceInternalId,
      opportunity.externalId ?? null,
      opportunity.title,
      opportunity.organization ?? null,
      opportunity.description ?? null,
      opportunity.url ?? null,
      opportunity.location ?? null,
      opportunity.remoteInfo ?? null,
      opportunity.opportunityType ?? null,
      opportunity.categoryIds ?? [],
      opportunity.status ?? 'active',
      opportunity.publicationDate ?? null,
      opportunity.applicationDeadline ?? null,
      opportunity.deadlineType ?? 'hard',
      (opportunity as any).lifecycleStage ?? null,
      embedding ?? null,
      runId ?? null
    ];
    const res = await executeTransaction(async (client: PoolClient) => client.query(query, params));
    return this.mapRow(res.rows[0]);
  }

  async findBySourceAndExternal(sourceId: string, externalId: string): Promise<OpportunityRow | null> {
    const query = `SELECT * FROM opportunities WHERE source_id = $1 AND external_id = $2;`;
    const res = await getPool().query(query, [sourceId, externalId]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async getById(id: string): Promise<OpportunityRow | null> {
    const query = `SELECT * FROM opportunities WHERE id = $1;`;
    const res = await getPool().query(query, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async list(limit = 100, offset = 0): Promise<OpportunityRow[]> {
    const query = `SELECT * FROM opportunities ORDER BY created_at DESC LIMIT $1 OFFSET $2;`;
    const res = await getPool().query(query, [limit, offset]);
    return res.rows.map(r => this.mapRow(r));
  }

  async findByRunId(runId: string): Promise<OpportunityRow[]> {
    const query = `SELECT * FROM opportunities WHERE run_id = $1 ORDER BY created_at DESC;`;
    const res = await getPool().query(query, [runId]);
    return res.rows.map(r => this.mapRow(r));
  }
}
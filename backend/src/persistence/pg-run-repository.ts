import { PoolClient } from 'pg';
import { getPool, executeTransaction } from '../db/connection.js';
import { DiscoveryRunRecord, RunStatus } from '../discovery/run-management/types.js';
import { RunPersistence, RunQueryFilter } from '../discovery/run-management/run-persistence';

export class PgRunRepository implements RunPersistence {
  private mapRow(row: any): DiscoveryRunRecord {
    return {
      runId: row.run_id,
      jobId: row.job_id,
      status: row.status as RunStatus,
      triggeredBy: row.triggered_by,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
      metrics: row.metrics ?? {},
      sourcesRequested: row.sources_requested ?? [],
      sourcesCompleted: row.sources_completed ?? [],
    };
  }

  async createRun(record: DiscoveryRunRecord): Promise<DiscoveryRunRecord> {
    const query = `
      INSERT INTO discovery_runs (run_id, job_id, status, triggered_by, started_at, completed_at, error, metrics)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;
    const params = [
      record.runId,
      record.jobId,
      record.status,
      record.triggeredBy,
      record.startedAt,
      record.completedAt ?? null,
      record.error ?? null,
      JSON.stringify(record.metrics ?? {})
    ];
    const res = await executeTransaction(async (client: PoolClient) => {
      return client.query(query, params);
    });
    return this.mapRow(res.rows[0]);
  }

  async getRun(runId: string): Promise<DiscoveryRunRecord | null> {
    const query = `SELECT * FROM discovery_runs WHERE run_id = $1;`;
    const res = await getPool().query(query, [runId]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async listRuns(filter?: RunQueryFilter): Promise<DiscoveryRunRecord[]> {
    let query = `SELECT * FROM discovery_runs`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        const placeholders = statuses.map((_: any, i: any) => `$${params.length + i + 1}`).join(',');
        conditions.push(`status IN (${placeholders})`);
        params.push(...statuses);
      }
      if (filter.jobId) {
        params.push(filter.jobId);
        conditions.push(`job_id = $${params.length}`);
      }
      if (filter.triggeredBy) {
        params.push(filter.triggeredBy);
        conditions.push(`triggered_by = $${params.length}`);
      }
      if (filter.startedAfter) {
        params.push(filter.startedAfter);
        conditions.push(`started_at >= $${params.length}`);
      }
      if (filter.startedBefore) {
        params.push(filter.startedBefore);
        conditions.push(`started_at <= $${params.length}`);
      }
    }

    if (conditions.length) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY started_at DESC`;
    if (filter?.limit) {
      params.push(filter.limit);
      query += ` LIMIT $${params.length}`;
    }
    if (filter?.offset) {
      params.push(filter.offset);
      query += ` OFFSET $${params.length}`;
    }

    const res = await getPool().query(query, params);
    return res.rows.map(r => this.mapRow(r));
  }

  async updateRun(runId: string, updates: Partial<DiscoveryRunRecord>): Promise<DiscoveryRunRecord> {
    const fields: string[] = [];
    const params: any[] = [runId];
    let idx = 2;
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${col} = $${idx++}`);
      params.push(key === 'metrics' ? JSON.stringify(value) : value);
    }
    if (!fields.length) throw new Error('No fields to update');
    const query = `UPDATE discovery_runs SET ${fields.join(', ')} WHERE run_id = $1 RETURNING *;`;
    const res = await executeTransaction(async (client: PoolClient) => client.query(query, params));
    if (res.rows.length === 0) throw new Error(`Run ${runId} not found`);
    return this.mapRow(res.rows[0]);
  }

  async deleteRun(runId: string): Promise<boolean> {
    const query = `DELETE FROM discovery_runs WHERE run_id = $1;`;
    const res = await getPool().query(query, [runId]);
    return (res.rowCount ?? 0) > 0;
  }

  async upsertMetrics(runId: string, metrics: Partial<DiscoveryRunRecord['metrics']>): Promise<void> {
    const query = `
      UPDATE discovery_runs
      SET metrics = COALESCE(metrics, '{}'::jsonb) || $2::jsonb
      WHERE run_id = $1;
    `;
    await executeTransaction(async (client: PoolClient) => client.query(query, [runId, JSON.stringify(metrics)]));
  }
}
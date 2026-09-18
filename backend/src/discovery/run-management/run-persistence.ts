import { DiscoveryRunRecord, RunStatus } from './types';

/**
 * Abstract persistence layer for discovery runs.
 * Stubbed implementation - no DB required for Step 10.
 * In production, implement with PostgreSQL / Redis / Firestore as appropriate.
 */
export interface RunPersistence {
  createRun(record: DiscoveryRunRecord): Promise<DiscoveryRunRecord>;
  getRun(runId: string): Promise<DiscoveryRunRecord | null>;
  listRuns(filter?: RunQueryFilter): Promise<DiscoveryRunRecord[]>;
  updateRun(runId: string, updates: Partial<DiscoveryRunRecord>): Promise<DiscoveryRunRecord>;
  deleteRun(runId: string): Promise<boolean>;
  upsertMetrics(runId: string, metrics: Partial<DiscoveryRunRecord['metrics']>): Promise<void>;
}

export interface RunQueryFilter {
  status?: RunStatus | RunStatus[];
  jobId?: string;
  triggeredBy?: string;
  startedAfter?: string;
  startedBefore?: string;
  limit?: number;
  offset?: number;
}

/**
 * In-memory stub implementation for development and testing.
 */
export class InMemoryRunPersistence implements RunPersistence {
  private store = new Map<string, DiscoveryRunRecord>();

  async createRun(record: DiscoveryRunRecord): Promise<DiscoveryRunRecord> {
    if (this.store.has(record.runId)) {
      throw new Error(`Run ${record.runId} already exists`);
    }
    this.store.set(record.runId, JSON.parse(JSON.stringify(record)));
    return record;
  }

  async getRun(runId: string): Promise<DiscoveryRunRecord | null> {
    const record = this.store.get(runId);
    return record ? JSON.parse(JSON.stringify(record)) : null;
  }

  async listRuns(filter?: RunQueryFilter): Promise<DiscoveryRunRecord[]> {
    let results = Array.from(this.store.values());

    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        results = results.filter(r => statuses.includes(r.status));
      }
      if (filter.jobId) {
        results = results.filter(r => r.jobId === filter.jobId);
      }
      if (filter.triggeredBy) {
        results = results.filter(r => r.triggeredBy === filter.triggeredBy);
      }
      if (filter.startedAfter) {
        results = results.filter(r => r.startedAt && r.startedAt >= filter.startedAfter);
      }
      if (filter.startedBefore) {
        results = results.filter(r => r.startedAt && r.startedAt <= filter.startedBefore);
      }
    }

    if (filter?.offset) {
      results = results.slice(filter.offset);
    }
    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results.map(r => JSON.parse(JSON.stringify(r)));
  }

  async updateRun(runId: string, updates: Partial<DiscoveryRunRecord>): Promise<DiscoveryRunRecord> {
    const existing = this.store.get(runId);
    if (!existing) {
      throw new Error(`Run ${runId} not found`);
    }
    const merged = { ...existing, ...updates };
    this.store.set(runId, merged);
    return JSON.parse(JSON.stringify(merged));
  }

  async deleteRun(runId: string): Promise<boolean> {
    return this.store.delete(runId);
  }

  async upsertMetrics(runId: string, metrics: Partial<DiscoveryRunRecord['metrics']>): Promise<void> {
    const existing = this.store.get(runId);
    if (!existing) {
      throw new Error(`Run ${runId} not found`);
    }
    existing.metrics = { ...existing.metrics, ...metrics };
    this.store.set(runId, existing);
  }

  // Utility for testing
  clear(): void {
    this.store.clear();
  }
}

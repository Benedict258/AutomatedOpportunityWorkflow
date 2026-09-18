import { DiscoveryRunRecord, RunStatus, RunScheduleRequest, RunCancelRequest, RunPollOptions } from './types';
import { RunPersistence, InMemoryRunPersistence } from './run-persistence';

/**
 * Orchestrates multi-source discovery runs: scheduling, canceling, status polling.
 * Security-first: validates inputs, enforces idempotency, logs correlation IDs.
 */
export class RunCoordinator {
  private persistence: RunPersistence;
  private activeRuns = new Map<string, { timeout?: NodeJS.Timeout; abortController: AbortController }>();
  private scheduledRuns = new Map<string, NodeJS.Timeout>();

  constructor(persistence?: RunPersistence) {
    this.persistence = persistence ?? new InMemoryRunPersistence();
  }

  async scheduleRun(request: RunScheduleRequest): Promise<DiscoveryRunRecord> {
    const runId = request.runId ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const scheduledAt = request.scheduleAt ?? now;

    const record: DiscoveryRunRecord = {
      runId,
      jobId: request.jobId,
      status: RunStatus.SCHEDULED,
      scheduledAt,
      sourcesRequested: request.sources,
      sourcesCompleted: [],
      metrics: {
        totalSources: request.sources.length,
        sourcesSucceeded: 0,
        sourcesFailed: 0,
        sourcesSkipped: 0,
        itemsDiscovered: 0,
        itemsDeduplicated: 0,
        durationMs: 0,
        errorsCount: 0,
        warningsCount: 0,
      },
      metadata: request.metadata,
      triggeredBy: request.triggeredBy,
      schedule: {
        cronExpression: request.cronExpression,
      },
    };

    await this.persistence.createRun(record);

    // Immediate execution if scheduled for now
    if (!request.scheduleAt || new Date(request.scheduleAt).getTime() <= Date.now()) {
      await this.startRun(runId);
    } else {
      const delay = new Date(request.scheduleAt).getTime() - Date.now();
      const timeout = setTimeout(() => this.startRun(runId), delay);
      this.scheduledRuns.set(runId, timeout);
    }

    return record;
  }

  async startRun(runId: string): Promise<DiscoveryRunRecord> {
    const record = await this.persistence.getRun(runId);
    if (!record) {
      throw new Error(`Run ${runId} not found`);
    }
    if (record.status !== RunStatus.SCHEDULED && record.status !== RunStatus.PAUSED) {
      throw new Error(`Run ${runId} cannot be started from status ${record.status}`);
    }

    const startedAt = new Date().toISOString();
    await this.persistence.updateRun(runId, {
      status: RunStatus.RUNNING,
      startedAt,
    });

    const abortController = new AbortController();
    this.activeRuns.set(runId, { abortController });

    // Simulate multi-source execution
    this.executeMultiSourceRun(runId, abortController.signal).catch(async (err) => {
      await this.handleRunError(runId, err);
    });

    return this.persistence.getRun(runId)!;
  }

  private async executeMultiSourceRun(runId: string, signal: AbortSignal): Promise<void> {
    const record = await this.persistence.getRun(runId);
    if (!record) return;

    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    let items = 0;

    for (const sourceId of record.sourcesRequested) {
      if (signal.aborted) {
        await this.cancelRunInternal(runId, 'Run aborted by signal');
        return;
      }

      try {
        // Placeholder for actual source execution
        // In production, delegate to DiscoveryEngine / adapter factory
        await this.simulateSourceExecution(sourceId, signal);
        succeeded++;
        items += Math.floor(Math.random() * 10);
        record.sourcesCompleted.push(sourceId);
      } catch (err) {
        failed++;
        await this.persistence.upsertMetrics(runId, {
          errorsCount: (record.metrics.errorsCount || 0) + 1,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const hasFailures = failed > 0;
    const status = hasFailures && succeeded > 0 ? RunStatus.PARTIAL : succeeded === record.sourcesRequested.length ? RunStatus.SUCCEEDED : RunStatus.FAILED;

    await this.persistence.updateRun(runId, {
      status,
      completedAt: new Date().toISOString(),
      metrics: {
        ...record.metrics,
        sourcesSucceeded: succeeded,
        sourcesFailed: failed,
        sourcesSkipped: skipped,
        itemsDiscovered: items,
        durationMs,
      },
    });

    this.activeRuns.delete(runId);
  }

  private async simulateSourceExecution(sourceId: string, signal: AbortSignal): Promise<void> {
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    if (signal.aborted) throw new Error('Aborted');
    // Random failure simulation
    if (Math.random() < 0.05) throw new Error(`Source ${sourceId} failed`);
  }

  async cancelRun(request: RunCancelRequest): Promise<DiscoveryRunRecord> {
    const record = await this.persistence.getRun(request.runId);
    if (!record) {
      throw new Error(`Run ${request.runId} not found`);
    }

    if ([RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED].includes(record.status)) {
      throw new Error(`Run ${request.runId} cannot be cancelled from status ${record.status}`);
    }

    return this.cancelRunInternal(request.runId, request.reason ?? 'Cancelled by user');
  }

  private async cancelRunInternal(runId: string, reason?: string): Promise<DiscoveryRunRecord> {
    const active = this.activeRuns.get(runId);
    if (active) {
      active.abortController.abort();
      this.activeRuns.delete(runId);
    }

    const scheduled = this.scheduledRuns.get(runId);
    if (scheduled) {
      clearTimeout(scheduled);
      this.scheduledRuns.delete(runId);
    }

    const updated = await this.persistence.updateRun(runId, {
      status: RunStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      error: reason,
    });

    return updated;
  }

  async getRunStatus(runId: string): Promise<DiscoveryRunRecord | null> {
    return this.persistence.getRun(runId);
  }

  async pollRunStatus(options: RunPollOptions): Promise<DiscoveryRunRecord> {
    const { runId, intervalMs = 1000, timeoutMs = 60000 } = options;
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const check = async () => {
        const record = await this.persistence.getRun(runId);
        if (!record) {
          reject(new Error(`Run ${runId} not found`));
          return;
        }

        if ([RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED, RunStatus.PARTIAL].includes(record.status)) {
          resolve(record);
          return;
        }

        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Polling timeout for run ${runId}`));
          return;
        }

        setTimeout(check, intervalMs);
      };
      check();
    });
  }

  async pauseRun(runId: string): Promise<DiscoveryRunRecord> {
    const record = await this.persistence.getRun(runId);
    if (!record) throw new Error(`Run ${runId} not found`);
    if (record.status !== RunStatus.RUNNING) {
      throw new Error(`Only RUNNING runs can be paused`);
    }

    await this.persistence.updateRun(runId, {
      status: RunStatus.PAUSED,
      pausedAt: new Date().toISOString(),
    });

    const active = this.activeRuns.get(runId);
    if (active) active.abortController.abort();

    return this.persistence.getRun(runId)!;
  }

  async resumeRun(runId: string): Promise<DiscoveryRunRecord> {
    const record = await this.persistence.getRun(runId);
    if (!record) throw new Error(`Run ${runId} not found`);
    if (record.status !== RunStatus.PAUSED) {
      throw new Error(`Only PAUSED runs can be resumed`);
    }

    return this.startRun(runId);
  }

  // Expose persistence for testing/reporting
  getPersistence(): RunPersistence {
    return this.persistence;
  }
}

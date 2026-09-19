import { DiscoveryEngine } from '../../discovery/discovery-engine';
import { RunCoordinator, InMemoryRunPersistence } from '../../discovery/run-management/run-coordinator';
import { PipelineOrchestrator } from '../../discovery/pipeline-orchestrator';
import { 
  CreateJobOptions, 
  DiscoveryJob, 
  DiscoveryRun, 
  DiscoveryRunStatus,
  DiscoveryEngineOptions 
} from '../../discovery/types';
import { RunScheduleRequest, RunCancelRequest, RunPollOptions, DiscoveryRunRecord, RunStatus } from '../../discovery/run-management/types';
import { logger } from '../utils/logger.js';

export class DiscoveryService {
  private engine: DiscoveryEngine;
  private runCoordinator: RunCoordinator;
  private orchestrator: PipelineOrchestrator;

  constructor(options: DiscoveryEngineOptions) {
    this.orchestrator = new PipelineOrchestrator();
    this.engine = new DiscoveryEngine({
      ...options,
      // We'll inject the orchestrator after creation
    } as DiscoveryEngineOptions);
    
    // Override the internal orchestrator
    (this.engine as any).orchestrator = this.orchestrator;
    
    this.runCoordinator = new RunCoordinator(new InMemoryRunPersistence());
  }

  // Job management
  async createJob(options: CreateJobOptions): Promise<DiscoveryJob> {
    logger.info({ options }, 'Creating discovery job');
    return this.engine.createJob(options);
  }

  async getJob(jobId: string): Promise<DiscoveryJob | null> {
    return this.engine.getJob(jobId);
  }

  async executeJob(jobId: string): Promise<DiscoveryRun> {
    logger.info({ jobId }, 'Executing discovery job');
    return this.engine.executeJob(jobId);
  }

  // Run management (via RunCoordinator)
  async scheduleRun(request: RunScheduleRequest): Promise<DiscoveryRunRecord> {
    logger.info({ request }, 'Scheduling discovery run');
    return this.runCoordinator.scheduleRun(request);
  }

  async startRun(runId: string): Promise<DiscoveryRunRecord> {
    return this.runCoordinator.startRun(runId);
  }

  async getRunStatus(runId: string): Promise<DiscoveryRunRecord | null> {
    return this.runCoordinator.getRunStatus(runId);
  }

  async cancelRun(request: RunCancelRequest): Promise<DiscoveryRunRecord> {
    logger.info({ request }, 'Cancelling discovery run');
    return this.runCoordinator.cancelRun(request);
  }

  async pauseRun(runId: string): Promise<DiscoveryRunRecord> {
    return this.runCoordinator.pauseRun(runId);
  }

  async resumeRun(runId: string): Promise<DiscoveryRunRecord> {
    return this.runCoordinator.resumeRun(runId);
  }

  async pollRunStatus(options: RunPollOptions): Promise<DiscoveryRunRecord> {
    return this.runCoordinator.pollRunStatus(options);
  }

  async listRuns(filter?: {
    status?: RunStatus | RunStatus[];
    jobId?: string;
    triggeredBy?: string;
    startedAfter?: string;
    startedBefore?: string;
    limit?: number;
    offset?: number;
  }): Promise<DiscoveryRunRecord[]> {
    return this.runCoordinator.getPersistence().listRuns(filter);
  }

  // Get run results (discovered opportunities)
  async getRunResults(runId: string): Promise<{ run: DiscoveryRunRecord | null; opportunities: any[] }> {
    const run = await this.runCoordinator.getRunStatus(runId);
    if (!run) {
      return { run: null, opportunities: [] };
    }

    // TODO: Link run to discovered opportunities via database
    // For now, return empty array as opportunities are persisted separately
    return { run, opportunities: [] };
  }
}

// Singleton instance
let discoveryServiceInstance: DiscoveryService | null = null;

export function getDiscoveryService(options?: DiscoveryEngineOptions): DiscoveryService {
  if (!discoveryServiceInstance && options) {
    discoveryServiceInstance = new DiscoveryService(options);
  }
  if (!discoveryServiceInstance) {
    throw new Error('DiscoveryService not initialized. Call getDiscoveryService(options) first.');
  }
  return discoveryServiceInstance;
}

export function initializeDiscoveryService(options: DiscoveryEngineOptions): DiscoveryService {
  discoveryServiceInstance = new DiscoveryService(options);
  return discoveryServiceInstance;
}
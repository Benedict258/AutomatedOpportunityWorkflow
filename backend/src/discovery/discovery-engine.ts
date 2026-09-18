import { PipelineOrchestrator } from './pipeline-orchestrator';
import {
  CreateJobOptions,
  DiscoveryEngineOptions,
  DiscoveryExecutionContext,
  DiscoveryJob,
  DiscoveryRun,
  DiscoveryRunStatus,
  PipelineStageName,
} from './types';

export class DiscoveryEngine {
  private jobs = new Map<string, DiscoveryJob>();
  private runs = new Map<string, DiscoveryRun>();
  private orchestrator: PipelineOrchestrator;
  private options: DiscoveryEngineOptions;

  constructor(options: DiscoveryEngineOptions) {
    this.options = options;
    this.orchestrator = new PipelineOrchestrator();
  }

  async createJob(options: CreateJobOptions): Promise<DiscoveryJob> {
    this.validateCreateOptions(options);

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const job: DiscoveryJob = {
      jobId,
      createdAt: now,
      updatedAt: now,
      sourceIds: options.sourceIds,
      runAllEnabled: options.runAllEnabled ?? false,
      category: options.category,
      priorityMin: options.priorityMin,
      metadata: options.metadata,
      triggeredBy: options.triggeredBy,
      status: 'DRAFT',
    };

    this.jobs.set(jobId, job);
    return job;
  }

  async executeJob(jobId: string): Promise<DiscoveryRun> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'PROCESSING') {
      throw new Error(`Job ${jobId} is already processing`);
    }

    job.status = 'PROCESSING';
    job.updatedAt = new Date().toISOString();
    this.jobs.set(jobId, job);

    const runId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    const sources = await this.resolveSources(job);

    const context: DiscoveryExecutionContext = {
      runId,
      jobId,
      startedAt,
      sources,
      options: {
        runAllEnabled: job.runAllEnabled,
        category: job.category,
        priorityMin: job.priorityMin,
      },
      sourceRegistryService: this.options.sourceRegistryService,
      adapterFactory: this.options.adapterFactory,
    };

    const run: DiscoveryRun = {
      runId,
      jobId,
      status: DiscoveryRunStatus.RUNNING,
      startedAt,
      sourcesRequested: sources.length,
      sourcesSucceeded: 0,
      sourcesFailed: 0,
      sourcesSkipped: 0,
      stageResults: [],
      executionContext: context,
    };

    this.runs.set(runId, run);

    try {
      const stageResults = await this.orchestrator.run(context);
      run.stageResults = stageResults;

      const overallStatus = this.computeOverallStatus(stageResults, run);
      run.status = overallStatus;
      run.completedAt = new Date().toISOString();

      this.updateRunMetrics(run, stageResults);
    } catch (error) {
      run.status = DiscoveryRunStatus.FAILED;
      run.error = error instanceof Error ? error.message : String(error);
      run.completedAt = new Date().toISOString();
    } finally {
      job.status = 'COMPLETED';
      job.updatedAt = new Date().toISOString();
      this.jobs.set(jobId, job);
      this.runs.set(runId, run);
    }

    return run;
  }

  async getRunStatus(runId: string): Promise<DiscoveryRun | null> {
    return this.runs.get(runId) ?? null;
  }

  async getJob(jobId: string): Promise<DiscoveryJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  private validateCreateOptions(options: CreateJobOptions): void {
    if (!options.sourceIds && !options.runAllEnabled) {
      throw new Error('Either sourceIds or runAllEnabled must be specified');
    }

    if (options.sourceIds && options.sourceIds.length === 0) {
      throw new Error('sourceIds cannot be empty when specified');
    }
  }

  private async resolveSources(job: DiscoveryJob): Promise<string[]> {
    // Scaffolding: resolve source IDs from registry based on job criteria
    // Future implementation will query SourceRegistryService:
    // - if job.sourceIds provided -> validate existence and enabled
    // - if runAllEnabled -> list enabled sources filtered by category/priority
    if (job.sourceIds && job.sourceIds.length > 0) {
      return [...job.sourceIds];
    }

    // Placeholder for runAllEnabled logic
    // In production, call sourceRegistryService.listEnabled() with filters
    return [];
  }

  private computeOverallStatus(stageResults: any[], run: DiscoveryRun): DiscoveryRunStatus {
    const hasFailure = stageResults.some(r => r.status === 'FAILED');
    const hasPartial = stageResults.some(r => r.metadata?.partial);

    if (hasFailure) {
      return DiscoveryRunStatus.FAILED;
    }
    if (hasPartial) {
      return DiscoveryRunStatus.PARTIAL;
    }
    return DiscoveryRunStatus.SUCCEEDED;
  }

  private updateRunMetrics(run: DiscoveryRun, stageResults: any[]): void {
    const executeStage = stageResults.find(s => s.stageName === PipelineStageName.EXECUTE_SOURCES);
    if (executeStage?.sourceResults) {
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      for (const sourceId in executeStage.sourceResults) {
        const sr = executeStage.sourceResults[sourceId];
        if (sr.status === 'SUCCEEDED') succeeded++;
        else if (sr.status === 'FAILED') failed++;
        else if (sr.status === 'SKIPPED') skipped++;
      }

      run.sourcesSucceeded = succeeded;
      run.sourcesFailed = failed;
      run.sourcesSkipped = skipped;
    }
  }
}

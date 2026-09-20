import {
  DiscoveryExecutionContext,
  DiscoveryRunStatus,
  PipelineStageName,
  StageResult,
  SourceStageResult,
} from './types';

export class PipelineOrchestrator {
  private stages: Array<{
    name: PipelineStageName;
    handler: (context: DiscoveryExecutionContext) => Promise<StageResult>;
  }> = [];

  constructor() {
    this.registerDefaultStages();
  }

  private registerDefaultStages(): void {
    this.stages.push({
      name: PipelineStageName.SELECT_SOURCES,
      handler: this.selectSourcesStage.bind(this),
    });
    this.stages.push({
      name: PipelineStageName.PREPARE,
      handler: this.prepareStage.bind(this),
    });
    this.stages.push({
      name: PipelineStageName.EXECUTE_SOURCES,
      handler: this.executeSourcesStage.bind(this),
    });
    this.stages.push({
      name: PipelineStageName.AGGREGATE,
      handler: this.aggregateStage.bind(this),
    });
    this.stages.push({
      name: PipelineStageName.COMPLETE,
      handler: this.completeStage.bind(this),
    });
  }

  async run(context: DiscoveryExecutionContext): Promise<StageResult[]> {
    const results: StageResult[] = [];
    const startedAt = new Date().toISOString();

    for (const stage of this.stages) {
      const stageResult = await this.executeStageWithBoundary(stage, context);
      results.push(stageResult);

      if (stageResult.status === 'FAILED' && !this.isRecoverable(stage.name)) {
        break;
      }
    }

    return results;
  }

  private async executeStageWithBoundary(
    stage: { name: PipelineStageName; handler: (ctx: DiscoveryExecutionContext) => Promise<StageResult> },
    context: DiscoveryExecutionContext
  ): Promise<StageResult> {
    const startedAt = new Date().toISOString();
    try {
      const result = await stage.handler(context);
      return {
        ...result,
        stageName: stage.name,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(startedAt).getTime(),
      };
    } catch (error) {
      return {
        stageName: stage.name,
        status: 'FAILED',
        startedAt,
        completedAt: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async selectSourcesStage(context: DiscoveryExecutionContext): Promise<StageResult> {
    // Scaffolding: source selection logic will be implemented later
    // This stage resolves sourceIds from job options using SourceRegistryService
    return {
      stageName: PipelineStageName.SELECT_SOURCES,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      metadata: {
        requestedSources: context.sources.length,
        sourceIds: context.sources,
      },
    };
  }

  private async prepareStage(context: DiscoveryExecutionContext): Promise<StageResult> {
    // Scaffolding: prepare adapters, rate limits, health checks
    const sourceResults: Record<string, SourceStageResult> = {};
    for (const sourceId of context.sources) {
      sourceResults[sourceId] = {
        sourceId,
        status: 'PENDING',
      };
    }

    return {
      stageName: PipelineStageName.PREPARE,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      metadata: { preparedCount: context.sources.length },
      sourceResults,
    };
  }

  private async executeSourcesStage(context: DiscoveryExecutionContext): Promise<StageResult> {
    // Scaffolding: orchestrate per-source discovery with retry boundaries and failure isolation
    // Actual discovery will be delegated to adapters later
    const sourceResults: Record<string, SourceStageResult> = {};
    for (const sourceId of context.sources) {
      sourceResults[sourceId] = {
        sourceId,
        status: 'SKIPPED', // Placeholder until adapter execution is wired
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    return {
      stageName: PipelineStageName.EXECUTE_SOURCES,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      metadata: { executedCount: context.sources.length },
      sourceResults,
    };
  }

  private async aggregateStage(context: DiscoveryExecutionContext): Promise<StageResult> {
    // Scaffolding: aggregate results, deduplicate, metrics
    return {
      stageName: PipelineStageName.AGGREGATE,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      metadata: { aggregated: true },
    };
  }

  private async completeStage(context: DiscoveryExecutionContext): Promise<StageResult> {
    // Scaffolding: finalize run metadata
    return {
      stageName: PipelineStageName.COMPLETE,
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      metadata: { completedAt: new Date().toISOString() },
    };
  }

  private isRecoverable(stageName: PipelineStageName): boolean {
    // Define which stages allow continuation after failure
    return stageName === PipelineStageName.SELECT_SOURCES;
  }
}

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
    const sourceResults: Record<string, SourceStageResult> = {};

    const registry = context.sourceRegistryService as { getById?: (id: string) => Promise<{ source_id: string; name: string } | null> } | undefined;
    const factories = context.adapterFactory as Array<{ canHandle: (s: any) => boolean; create: (s: any) => any }> | undefined;

    for (const sourceId of context.sources) {
      const startedAt = new Date().toISOString();
      try {
        const sourceEntry = registry?.getById ? await registry.getById(sourceId) : null;
        if (!sourceEntry) {
          sourceResults[sourceId] = { sourceId, status: 'SKIPPED', startedAt, completedAt: new Date().toISOString(), error: 'Source not found in registry' };
          continue;
        }

        const factory = factories?.find(f => f.canHandle(sourceEntry));
        if (!factory) {
          sourceResults[sourceId] = { sourceId, status: 'SKIPPED', startedAt, completedAt: new Date().toISOString(), error: 'No adapter found for source' };
          continue;
        }

        const adapter = factory.create(sourceEntry);
        const raw = await adapter.fetch({ sourceId, raw: true, limit: 20 });
        const collected = Array.isArray(raw) ? raw.length : (raw ? 1 : 0);

        sourceResults[sourceId] = {
          sourceId,
          status: 'SUCCEEDED',
          startedAt,
          completedAt: new Date().toISOString(),
          itemsDiscovered: collected,
        };
      } catch (err) {
        sourceResults[sourceId] = {
          sourceId,
          status: 'FAILED',
          startedAt,
          completedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        };
      }
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

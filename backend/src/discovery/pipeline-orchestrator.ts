import {
  DiscoveryExecutionContext,
  DiscoveryRunStatus,
  PipelineStageName,
  StageResult,
  SourceStageResult,
} from './types';
import { PgOpportunityRepository } from '../persistence/pg-opportunity-repository';
import { getPool } from '../db/connection';

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

    const registry = context.sourceRegistryService as { getById?: (id: string) => Promise<any | null> } | undefined;
    const factories = context.adapterFactory as Array<{ canHandle: (s: any) => boolean; create: (s: any) => any }> | undefined;
    const persister = new PgOpportunityRepository();

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

        // Normalize raw data into structured opportunities
        const normalized = await adapter.normalize(raw, sourceId);

        // Ensure source exists in sources table (foreign key constraint)
        await this.ensureSourceExists(sourceEntry);

        // Persist each normalized opportunity with run_id
        let persisted = 0;
        for (const opp of normalized) {
          try {
            await persister.upsert(opp, sourceEntry.source_id, undefined, context.runId);
            persisted++;
          } catch (err) {
            // Log but don't fail the whole source for one bad record
          }
        }

        sourceResults[sourceId] = {
          sourceId,
          status: 'SUCCEEDED',
          startedAt,
          completedAt: new Date().toISOString(),
          itemsDiscovered: normalized.length,
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

  private async ensureSourceExists(sourceEntry: { source_id: string; name: string; url?: string; source_type?: string; category?: string }): Promise<void> {
    const query = `
      INSERT INTO sources (id, name, url, source_type, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `;
    await getPool().query(query, [
      sourceEntry.source_id,
      sourceEntry.name,
      sourceEntry.url ?? null,
      sourceEntry.source_type ?? null,
      JSON.stringify({ category: sourceEntry.category }),
    ]);
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

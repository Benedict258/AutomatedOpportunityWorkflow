import { randomUUID } from 'crypto';
import { DiscoveryStrategyEngine, TaxonomyService } from '../strategy';
import { CollectionOrchestrator } from '../collection';
import { ExtractionEngine } from '../extraction';
import { NormalizationEngine } from '../normalization';
import { ValidationEngine } from '../validation';
import { DeduplicationEngine } from '../deduplication';
import { FreshnessEngine } from '../freshness';
import { VersionManager } from '../versioning';
import { OpportunityPersister } from '../../persistence/opportunity-persister';
import { PgOpportunityRepository } from '../../persistence/pg-opportunity-repository.js';
import { USAJobsAdapter } from '../../adapters/usajobs-adapter';
import type { PipelineStageInput, PipelineStageOutput, PipelineContext, DiscoveryPipelineResult, PipelineMetrics } from './types';
import { PipelineStageName } from './types';
import type { QueryPlan } from '../strategy/types';
import type { CollectionResult, RawDocument } from '../collection/types';
import type { ExtractionResult } from '../extraction/types';
import type { NormalizationResult, NormalizedOpportunity } from '../normalization/types';
import type { ValidationResult } from '../validation/types';
import type { DuplicateCandidate } from '../deduplication/types';
import type { ChangeDetectionResult } from '../freshness/types';
import type { VersioningResult } from '../versioning/types';
import { RunStatus } from '../run-management/types';

interface PipelineOptions {
  strategyEngine?: DiscoveryStrategyEngine;
  collectionOrchestrator?: CollectionOrchestrator;
  extractionEngine?: ExtractionEngine;
  normalizationEngine?: NormalizationEngine;
  validationEngine?: ValidationEngine;
  dedupEngine?: DeduplicationEngine;
  freshnessEngine?: FreshnessEngine;
  versionManager?: VersionManager;
  persister?: PgOpportunityRepository;
}

export class DiscoveryPipeline {
  private options: Required<PipelineOptions>;

  constructor(options: PipelineOptions = {}) {
    this.options = {
      strategyEngine: options.strategyEngine ?? new DiscoveryStrategyEngine({
        taxonomyService: new TaxonomyService(''),
        config: {},
      }),
      collectionOrchestrator: options.collectionOrchestrator ?? new CollectionOrchestrator(),
      extractionEngine: options.extractionEngine ?? new ExtractionEngine(),
      normalizationEngine: options.normalizationEngine ?? new NormalizationEngine(),
      validationEngine: options.validationEngine ?? new ValidationEngine(),
      dedupEngine: options.dedupEngine ?? new DeduplicationEngine(),
      freshnessEngine: options.freshnessEngine ?? new FreshnessEngine(),
      versionManager: options.versionManager ?? new VersionManager(),
      persister: options.persister ?? new PgOpportunityRepository(),
    };
  }

  async run(input: PipelineStageInput): Promise<DiscoveryPipelineResult> {
    const runId = input.runId ?? randomUUID();
    const startedAt = new Date().toISOString();
    const context: PipelineContext = {
      runId,
      jobId: input.jobId,
      startedAt,
      sourceIds: input.sourceIds,
      options: input.metadata,
      metrics: {} as PipelineMetrics,
    };
    const stages: PipelineStageOutput[] = [];
    const errors: string[] = [];

    const runStage = async <T>(name: PipelineStageName, fn: () => Promise<T>): Promise<PipelineStageOutput<T>> => {
      const start = Date.now();
      const startedAtStage = new Date().toISOString();
      try {
        const data = await fn();
        const completedAt = new Date().toISOString();
        return {
          stage: name,
          status: 'SUCCESS',
          startedAt: startedAtStage,
          completedAt,
          durationMs: Date.now() - start,
          data,
        };
      } catch (e: any) {
        const completedAt = new Date().toISOString();
        const msg = e?.message ?? String(e);
        errors.push(`${name} failed: ${msg}`);
        return {
          stage: name,
          status: 'FAILED',
          startedAt: startedAtStage,
          completedAt,
          durationMs: Date.now() - start,
          errors: [msg],
        };
      }
    };

    // 1. Query Strategy
    const strategyOut = await runStage(PipelineStageName.QUERY_STRATEGY, async () => {
      const plan = this.options.strategyEngine.generateQueryPlan({
        runId,
        jobId: input.jobId ?? '',
        sourceIds: input.sourceIds,
      });
      context.queryPlan = plan;
      return plan;
    });
    stages.push(strategyOut);

    // 2. Collection
    const collectionOut = await runStage(PipelineStageName.COLLECTION, async () => {
      const results = new Map<string, CollectionResult>();
      const allDocs: RawDocument[] = [];
      for (const sourceId of context.sourceIds) {
        // USAJobs fixture path
        if (sourceId === 'gov_usajobs_001') {
          const adapter = new USAJobsAdapter();
          const raw = await adapter.fetch({ sourceId, limit: 100 });
          const rawItems = (raw as any)?.SearchResult?.SearchResultItems ?? [];
          const docs: RawDocument[] = rawItems.map((item: any, idx: number) => ({
            sourceId,
            collectedAt: new Date().toISOString(),
            rawData: item,
            metadata: { adapterId: 'usajobs-api-adapter', index: idx },
          }));
          allDocs.push(...docs);
          const collResult: CollectionResult = {
            sourceId,
            status: 'SUCCEEDED',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            documents: docs,
            metrics: {
              documentsCollected: docs.length,
              pagesFetched: 1,
              durationMs: 0,
              rateLimitHits: 0,
              retries: 0,
              errors: 0,
            },
          };
          results.set(sourceId, collResult);
        } else {
          // Stub for other sources
          results.set(sourceId, {
            sourceId,
            status: 'SKIPPED',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            documents: [],
            metrics: { documentsCollected: 0, pagesFetched: 0, durationMs: 0, rateLimitHits: 0, retries: 0, errors: 0 },
          });
        }
      }
      context.collectionResults = results;
      context.rawDocuments = allDocs;
      return results;
    });
    stages.push(collectionOut);

    // 3. Extraction
    const extractionOut = await runStage(PipelineStageName.EXTRACTION, async () => {
      const docs = context.rawDocuments ?? [];
      // Minimal RawDocument shape for extraction engine
      const batch = docs.map(d => ({
        ...d,
        sourceId: d.sourceId,
        collectedAt: d.collectedAt,
        rawData: d.rawData,
      })) as any;
      const { results, metrics } = await this.options.extractionEngine.extractBatch(batch);
      context.extractionResults = results;
      return { results, metrics };
    });
    stages.push(extractionOut);

    // 4. Normalization
    const normalizationOut = await runStage(PipelineStageName.NORMALIZATION, async () => {
      const extractions = context.extractionResults ?? [];
      const normalized: NormalizationResult[] = [];
      for (const ext of extractions) {
        const sourceId = ext.sourceId;
        // Build context for normalizer
        const normCtx = {
          sourceId,
          documentId: ext.documentId,
          externalId: undefined as any,
          extractionResult: {
            fields: ext.fields,
            confidence: ext.confidence,
            warnings: ext.warnings,
            errors: ext.errors,
          },
        };
        const result = await this.options.normalizationEngine.normalize(ext.fields, normCtx);
        normalized.push(result);
      }
      context.normalized = normalized;
      return normalized;
    });
    stages.push(normalizationOut);

    // 5. Validation
    const validationOut = await runStage(PipelineStageName.VALIDATION, async () => {
      const normalized = context.normalized ?? [];
      const items = normalized.map(n => ({
        opportunity: n.normalizedOpportunity,
        context: { opportunity: n.normalizedOpportunity, sourceId: n.normalizedOpportunity.source ?? 'unknown' },
      }));
      const results = await this.options.validationEngine.validateBatch(items as any);
      context.validated = results;
      return results;
    });
    stages.push(validationOut);

    // 6. Deduplication
    const dedupOut = await runStage(PipelineStageName.DEDUPLICATION, async () => {
      const normalized = context.normalized ?? [];
      const candidates: DuplicateCandidate[] = normalized.map(n => {
        const opp = n.normalizedOpportunity;
        const fingerprint = `${opp.source}-${opp.externalId ?? opp.url ?? ''}`.toLowerCase();
        return {
          opportunity: opp,
          fingerprint,
          source: opp.source,
          externalId: opp.externalId,
          normalizedTitle: opp.title?.toLowerCase().trim(),
          normalizedOrg: opp.organization?.toLowerCase().trim(),
          normalizedUrl: opp.url?.toLowerCase().trim(),
          descriptionHash: '',
        };
      });
      const result = this.options.dedupEngine.deduplicate(candidates);
      context.dedupResult = result;
      return result;
    });
    stages.push(dedupOut);

    // 7. Freshness
    const freshnessOut = await runStage(PipelineStageName.FRESHNESS, async () => {
      const candidates = context.dedupResult?.uniqueCandidates ?? [];
      const checks = candidates.map(c => {
        const opp = c.opportunity;
        const check = {
          opportunityId: opp.externalId ?? randomUUID(),
          source: opp.source,
          externalId: opp.externalId,
          lastSeenAt: opp.lastSeenAt,
          firstSeenAt: opp.firstSeenAt,
          freshnessStatus: 'UNKNOWN' as const,
        };
        const evaluated = this.options.freshnessEngine.evaluateFreshness(check);
        return evaluated;
      });
      context.freshnessResults = checks as unknown as ChangeDetectionResult[];
      return checks;
    });
    stages.push(freshnessOut);

    // 8. Versioning
    const versioningOut = await runStage(PipelineStageName.VERSIONING, async () => {
      const candidates = context.dedupResult?.uniqueCandidates ?? [];
      const results: VersioningResult[] = [];
      for (const c of candidates) {
        const opp = c.opportunity;
        const input = {
          opportunityId: opp.externalId ?? randomUUID(),
          title: opp.title,
          description: opp.description,
          applicationDeadline: opp.deadline ?? null,
          deadlineType: opp.deadlineType,
          location: opp.location,
          url: opp.url,
          status: opp.status,
        };
        const res = this.options.versionManager.createVersion(input);
        results.push(res);
      }
      context.versioningResults = results;
      return results;
    });
    stages.push(versioningOut);

    // 9. Persistence
    const persistenceOut = await runStage(PipelineStageName.PERSISTENCE, async () => {
      const normalized = (context.normalized ?? []).map(n => n.normalizedOpportunity);
      const results = { inserted: 0, updated: 0, skipped: 0, opportunities: [] as any[] };
      for (const o of normalized) {
        try {
          const sourceInternalId = o.source; // assume source ID is internal UUID
          const row = await this.options.persister.upsert({
            ...o,
            sourceId: o.source,
            externalId: o.externalId,
          } as any, sourceInternalId, undefined, context.runId);
          results.inserted++;
          results.opportunities.push({ id: row.id, stableId: row.stable_id, externalId: row.external_id });
        } catch (e) {
          results.skipped++;
        }
      }
      context.persisted = results;
      return results;
    });
    stages.push(persistenceOut);

    // Compute metrics
    const metrics: PipelineMetrics = {
      sourcesRequested: context.sourceIds.length,
      sourcesSucceeded: Array.from(context.collectionResults?.values() ?? []).filter(r => r.status === 'SUCCEEDED').length,
      sourcesFailed: Array.from(context.collectionResults?.values() ?? []).filter(r => r.status === 'FAILED').length,
      documentsCollected: (context.rawDocuments ?? []).length,
      documentsExtracted: (context.extractionResults ?? []).length,
      opportunitiesNormalized: (context.normalized ?? []).length,
      opportunitiesValidated: (context.validated ?? []).length,
      opportunitiesDeduped: context.dedupResult?.uniqueCandidates.length ?? 0,
      opportunitiesPersisted: context.persisted?.inserted ?? 0,
      durationMs: Date.now() - new Date(startedAt).getTime(),
    };

    const status = errors.length > 0 ? RunStatus.FAILED : RunStatus.SUCCEEDED;
    const completedAt = new Date().toISOString();

    const summary = {
      totalOpportunities: metrics.opportunitiesNormalized,
      newOpportunities: context.persisted?.inserted ?? 0,
      updatedOpportunities: context.persisted?.updated ?? 0,
      duplicatesRemoved: (context.dedupResult?.duplicateCandidates.length ?? 0),
      validationErrors: (context.validated ?? []).filter(v => !v.valid).length,
    };

    return {
      runId,
      jobId: input.jobId,
      status,
      startedAt,
      completedAt,
      durationMs: metrics.durationMs,
      stages,
      context,
      metrics,
      summary,
      errors: errors.length ? errors : undefined,
    };
  }

  /**
   * Example pipeline execution with USAJOBS fixture.
   * Demonstrates full discovery pipeline integration.
   */
  static async runUsaJobsExample() {
    const pipeline = new DiscoveryPipeline();
    const input: PipelineStageInput = {
      runId: `run-usajobs-${randomUUID()}`,
      sourceIds: ['gov_usajobs_001'],
      metadata: { example: true },
    };
    const result = await pipeline.run(input);
    console.log('=== USAJOBS Pipeline Execution ===');
    console.log(`Run ID: ${result.runId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(`Stages:`);
    for (const s of result.stages) {
      console.log(`  - ${s.stage}: ${s.status} (${s.durationMs}ms)`);
    }
    console.log(`Summary:`, result.summary);
    console.log(`Normalized opportunities: ${result.metrics.opportunitiesNormalized}`);
    console.log(`Persisted inserted: ${result.summary.newOpportunities}`);
    return result;
  }
}

// Export singleton helper
export const discoveryPipeline = new DiscoveryPipeline();

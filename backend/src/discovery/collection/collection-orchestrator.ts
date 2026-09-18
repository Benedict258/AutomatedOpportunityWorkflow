import type { SourceRegistryEntry } from '../../../shared/src/registry/types';
import type { SourceAdapter, AdapterFactory } from '../../adapters/source-adapter.interface';
import type { FetchOptions } from '../../adapters/types';
import { CollectionOptions, CollectionResult, CollectionMetrics, RawDocument } from './types';
import { RateLimiterRegistry } from './rate-limiter';

export interface CollectionOrchestratorOptions {
  adapterFactory?: AdapterFactory | AdapterFactory[];
  maxConcurrency?: number;
  defaultMaxPages?: number;
  defaultLimit?: number;
  respectRateLimits?: boolean;
}

export class CollectionOrchestrator {
  private rateLimiterRegistry = new RateLimiterRegistry();
  private adapterFactories: AdapterFactory[];

  constructor(options: CollectionOrchestratorOptions = {}) {
    this.adapterFactories = Array.isArray(options.adapterFactory)
      ? options.adapterFactory
      : options.adapterFactory
      ? [options.adapterFactory]
      : [];
    this.maxConcurrency = options.maxConcurrency ?? 5;
    this.defaultMaxPages = options.defaultMaxPages ?? 10;
    this.defaultLimit = options.defaultLimit ?? 100;
    this.respectRateLimits = options.respectRateLimits ?? true;
  }

  private maxConcurrency: number;
  private defaultMaxPages: number;
  private defaultLimit: number;
  private respectRateLimits: boolean;

  registerAdapterFactory(factory: AdapterFactory): void {
    this.adapterFactories.push(factory);
  }

  private findAdapter(source: SourceRegistryEntry): SourceAdapter | null {
    for (const factory of this.adapterFactories) {
      if (factory.canHandle(source)) {
        try {
          return factory.create(source);
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  async collect(source: SourceRegistryEntry, options: CollectionOptions): Promise<CollectionResult> {
    const startedAt = new Date().toISOString();
    const adapter = this.findAdapter(source);

    if (!adapter) {
      return this.buildSkippedResult(source, options, startedAt, 'No adapter found for source');
    }

    const metrics: CollectionMetrics = {
      documentsCollected: 0,
      pagesFetched: 0,
      durationMs: 0,
      rateLimitHits: 0,
      retries: 0,
      errors: 0,
    };

    const documents: RawDocument[] = [];
    const warnings: string[] = [];
    let nextCursor: string | undefined;
    let hasMore = false;
    let status: CollectionResult['status'] = 'SUCCEEDED';

    try {
      // Respect rate limit before first request
      if (this.respectRateLimits && source.rate_limit) {
        await this.rateLimiterRegistry.wait(source.source_id, source.rate_limit);
      }

      const fetchOptions: FetchOptions = {
        sourceId: source.source_id,
        since: options.since,
        limit: options.limit ?? this.defaultLimit,
        cursor: options.cursor,
        filters: options.filters,
        raw: true,
      };

      let page = 0;
      const maxPages = options.maxPages ?? this.defaultMaxPages;
      let keepFetching = true;

      while (keepFetching && page < maxPages) {
        page++;
        metrics.pagesFetched = page;

        // Rate limit per page
        if (this.respectRateLimits && source.rate_limit) {
          await this.rateLimiterRegistry.wait(source.source_id, source.rate_limit);
        }

        const raw = await adapter.fetch(fetchOptions);
        const collected = this.wrapRawDocument(source, adapter.adapterId, raw, page, fetchOptions.cursor);
        
        if (Array.isArray(collected)) {
          documents.push(...collected);
        } else {
          documents.push(collected);
        }

        metrics.documentsCollected = documents.length;

        // Determine pagination continuation
        const metadata = (collected[0]?.metadata ?? collected.metadata) as any;
        const paginationType = source.metadata?.pagination?.type;

        if (paginationType === 'cursor' || paginationType === 'page') {
          // Simple heuristic: if we got full page, assume more may exist
          const itemsCount = Array.isArray(raw) ? raw.length : 1;
          const limit = fetchOptions.limit ?? this.defaultLimit;
          hasMore = itemsCount >= limit;
          if (hasMore && fetchOptions.cursor) {
            // In real adapter, cursor would be updated from response headers/body
            // For now, stop to avoid infinite loop without real pagination support
            warnings.push(`Pagination cursor not supported in collection orchestrator for source ${source.source_id}. Consider implementing cursor extraction in adapter.`);
            keepFetching = false;
          } else if (hasMore) {
            // Simple page increment for demo
            fetchOptions.cursor = String((Number(fetchOptions.cursor || 1) + 1));
            nextCursor = fetchOptions.cursor;
          } else {
            keepFetching = false;
          }
        } else {
          keepFetching = false;
        }

        // Respect source capabilities
        const adapterMeta = await adapter.get_metadata().catch(() => null);
        if (adapterMeta?.capabilities?.pagination === false) {
          keepFetching = false;
        }
      }

      if (warnings.length > 0 && status === 'SUCCEEDED') {
        status = 'PARTIAL';
      }
    } catch (err) {
      metrics.errors++;
      status = 'FAILED';
      return this.buildFailedResult(source, startedAt, metrics, err, documents);
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(startedAt).getTime();
    metrics.durationMs = durationMs;

    return {
      sourceId: source.source_id,
      sourceName: source.name,
      status,
      startedAt,
      completedAt,
      durationMs,
      documents,
      metrics,
      warnings: warnings.length ? warnings : undefined,
      nextCursor: hasMore ? nextCursor : undefined,
      hasMore,
    };
  }

  async collectMany(sources: SourceRegistryEntry[], optionsFactory: (source: SourceRegistryEntry) => CollectionOptions): Promise<CollectionResult[]> {
    const results: CollectionResult[] = [];
    const concurrency = Math.min(this.maxConcurrency, sources.length);
    
    // Simple concurrency pool
    const queue = [...sources];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const source = queue.shift()!;
        const options = optionsFactory(source);
        const result = await this.collect(source, options);
        results.push(result);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private wrapRawDocument(source: SourceRegistryEntry, adapterId: string, raw: unknown, page: number, cursor?: string): RawDocument | RawDocument[] {
    const collectedAt = new Date().toISOString();
    
    // If raw is an array, wrap each item
    if (Array.isArray(raw)) {
      return raw.map((item, idx) => ({
        sourceId: source.source_id,
        externalId: this.extractExternalId(item),
        collectedAt,
        rawData: item,
        metadata: {
          page,
          cursor,
          adapterId,
          sourceType: source.source_type,
          index: idx,
        },
      }));
    }

    // Single object
    return {
      sourceId: source.source_id,
      externalId: this.extractExternalId(raw),
      collectedAt,
      rawData: raw,
      metadata: {
        page,
        cursor,
        adapterId,
        sourceType: source.source_type,
      },
    };
  }

  private extractExternalId(item: unknown): string | undefined {
    if (!item || typeof item !== 'object') return undefined;
    const obj = item as any;
    return obj.id ?? obj.externalId ?? obj.MatchedObjectId ?? obj.PositionID ?? obj.job_id ?? undefined;
  }

  private buildSkippedResult(source: SourceRegistryEntry, options: CollectionOptions, startedAt: string, reason: string): CollectionResult {
    const completedAt = new Date().toISOString();
    return {
      sourceId: source.source_id,
      sourceName: source.name,
      status: 'SKIPPED',
      startedAt,
      completedAt,
      durationMs: Date.now() - new Date(startedAt).getTime(),
      documents: [],
      metrics: {
        documentsCollected: 0,
        pagesFetched: 0,
        durationMs: 0,
        rateLimitHits: 0,
        retries: 0,
        errors: 0,
      },
      error: reason,
      warnings: [reason],
    };
  }

  private buildFailedResult(source: SourceRegistryEntry, startedAt: string, metrics: CollectionMetrics, err: unknown, documents: RawDocument[]): CollectionResult {
    const completedAt = new Date().toISOString();
    return {
      sourceId: source.source_id,
      sourceName: source.name,
      status: 'FAILED',
      startedAt,
      completedAt,
      durationMs: Date.now() - new Date(startedAt).getTime(),
      documents,
      metrics,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

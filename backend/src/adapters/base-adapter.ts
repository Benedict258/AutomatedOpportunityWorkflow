import type { SourceRegistryEntry } from 'shared/registry/types';
import type { SourceAdapter } from './source-adapter.interface';
import type {
  FetchOptions,
  DiscoverOptions,
  NormalizedOpportunity,
  AdapterMetadata,
  HealthCheckResult,
  ValidationResult,
} from './types';
import {
  AdapterError,
  AuthenticationFailureError,
  NetworkFailureError,
  SourceUnavailableError,
  MalformedResponseError,
  ParsingFailureError,
  UnsupportedSourceError,
  ValidationFailureError,
} from './errors';

export abstract class BaseSourceAdapter implements SourceAdapter {
  public abstract readonly adapterId: string;

  abstract supports(source: SourceRegistryEntry): boolean;

  abstract discover(options: DiscoverOptions): Promise<string[]>;

  abstract fetch(options: FetchOptions): Promise<unknown>;

  abstract normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]>;

  async validate(normalized: NormalizedOpportunity[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const item of normalized) {
      if (!item.title || item.title.trim().length === 0) {
        errors.push(`Opportunity ${item.externalId ?? 'unknown'} missing title`);
      }
      if (!item.firstSeenAt) {
        errors.push(`Opportunity ${item.externalId ?? 'unknown'} missing firstSeenAt`);
      }
      if (!item.sourceId) {
        errors.push(`Opportunity missing sourceId`);
      }
      if (item.applicationDeadline && isNaN(Date.parse(item.applicationDeadline))) {
        warnings.push(`Opportunity ${item.externalId ?? 'unknown'} has invalid deadline format`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async get_metadata(): Promise<AdapterMetadata> {
    return {
      adapterId: this.adapterId,
      version: '0.1.0',
      sourceType: this.getSourceType(),
      capabilities: {
        discovery: this.supportsDiscovery(),
        search: this.supportsSearch(),
        pagination: this.supportsPagination(),
        realTime: false,
      },
    };
  }

  async health_check(sourceId: string): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.ping(sourceId);
      return {
        status: 'HEALTHY',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const error = err as Error;
      if (error instanceof AuthenticationFailureError) {
        return {
          status: 'DEGRADED',
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - start,
          details: { reason: error.message },
        };
      }
      return {
        status: 'UNREACHABLE',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        details: { reason: error.message },
      };
    }
  }

  protected abstract getSourceType(): string;
  protected abstract supportsDiscovery(): boolean;
  protected abstract supportsSearch(): boolean;
  protected abstract supportsPagination(): boolean;
  protected abstract ping(sourceId: string): Promise<void>;

  protected handleError(error: unknown, sourceId?: string, context?: string): never {
    if (error instanceof AdapterError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new AdapterError({
      code: 'NETWORK_FAILURE',
      message: context ? `${context}: ${message}` : message,
      sourceId,
      retryable: true,
      cause: error,
    });
  }

  protected ensureSupported(source: SourceRegistryEntry): void {
    if (!this.supports(source)) {
      throw new UnsupportedSourceError(
        `Adapter ${this.adapterId} does not support source ${source.source_id}`,
        source.source_id
      );
    }
  }

  protected wrapMalformedResponse(sourceId: string, raw: unknown, cause?: unknown): never {
    throw new MalformedResponseError(
      `Malformed response from source ${sourceId}`,
      sourceId,
      cause
    );
  }

  protected wrapParsingFailure(sourceId: string, cause?: unknown): never {
    throw new ParsingFailureError(
      `Failed to parse response from source ${sourceId}`,
      sourceId,
      cause
    );
  }
}

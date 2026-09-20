import type { SourceRegistryEntry } from 'shared/registry/types';
import { BaseSourceAdapter } from './base-adapter';
import type {
  FetchOptions,
  DiscoverOptions,
  NormalizedOpportunity,
  HealthCheckResult,
} from './types';
import {
  AuthenticationFailureError,
  NetworkFailureError,
  SourceUnavailableError,
} from './errors';
import { SourceType } from 'shared/registry/types';

/**
 * Generic API Adapter Skeleton
 * 
 * This is a template for implementing adapters for RESTful API sources.
 * It demonstrates the separation of concerns:
 * - Discovery: identify available resources/IDs
 * - Fetch: retrieve raw data from source
 * - Normalize: map raw data to domain-compatible NormalizedOpportunity
 * - Validate: ensure data integrity (handled by BaseSourceAdapter)
 * 
 * Do NOT implement concrete source-specific logic here.
 * Extend this class for real adapters.
 */
export abstract class GenericApiAdapter extends BaseSourceAdapter {
  public abstract readonly adapterId: string;

  protected abstract baseUrl: string;
  protected abstract endpointPath: string;
  protected abstract authHeader?: (source: SourceRegistryEntry) => Record<string, string>;

  supports(source: SourceRegistryEntry): boolean {
    return source.source_type === SourceType.API && this.isCompatible(source);
  }

  protected abstract isCompatible(source: SourceRegistryEntry): boolean;

  async discover(options: DiscoverOptions): Promise<string[]> {
    // Step 1: Discovery - find external IDs available from source
    // Should return list of external IDs or identifiers
    // Example: fetch list endpoint and extract IDs
    throw new Error('discover() not implemented for generic skeleton');
  }

  async fetch(options: FetchOptions): Promise<unknown> {
    // Step 2: Fetch - retrieve raw data from source
    // This method should ONLY fetch raw data, no normalization
    const sourceId = options.sourceId;
    
    try {
      // Pseudocode for HTTP fetch:
      // const url = this.buildUrl(sourceId, options);
      // const response = await httpGet(url, this.authHeader(sourceId));
      // 
      // if (!response.ok) {
      //   throw new NetworkFailureError(...);
      // }
      // return response.data;

      throw new Error('fetch() not implemented for generic skeleton');
    } catch (err) {
      this.handleError(err, sourceId, 'fetch');
    }
  }

  async normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]> {
    // Step 3: Normalization - map raw source data to domain schema
    // This is where provider-specific mapping happens
    // Output must conform to NormalizedOpportunity interface
    // which maps to Opportunity domain entity fields
    
    if (!raw) {
      this.wrapMalformedResponse(sourceId, raw);
    }

    try {
      // Pseudocode:
      // const items = Array.isArray(raw) ? raw : [raw];
      // return items.map(item => ({
      //   sourceId,
      //   externalId: item.id,
      //   title: item.title,
      //   organization: item.org_name,
      //   description: item.description,
      //   url: item.url,
      //   firstSeenAt: new Date().toISOString(),
      //   ...
      // }));

      throw new Error('normalize() not implemented for generic skeleton');
    } catch (err) {
      this.wrapParsingFailure(sourceId, err);
    }
  }

  protected getSourceType(): string {
    return SourceType.API;
  }

  protected supportsDiscovery(): boolean {
    return true;
  }

  protected supportsSearch(): boolean {
    return false;
  }

  protected supportsPagination(): boolean {
    return false;
  }

  async ping(sourceId: string): Promise<void> {
    // Lightweight health check - e.g., HEAD request to base URL
    // Should not fetch full data
    try {
      // const response = await httpHead(this.baseUrl);
      // if (!response.ok) throw new SourceUnavailableError(...)
      throw new Error('ping() not implemented for generic skeleton');
    } catch (err) {
      if (err instanceof SourceUnavailableError || err instanceof NetworkFailureError) {
        throw err;
      }
      throw new SourceUnavailableError(`Source ${sourceId} unreachable`, sourceId, err);
    }
  }

  protected buildUrl(sourceId: string, options: FetchOptions): string {
    // Helper to construct request URL with query params
    // Respect pagination, filters, since
    return `${this.baseUrl}${this.endpointPath}`;
  }

  protected getAuthHeaders(source: SourceRegistryEntry): Record<string, string> {
    if (!this.authHeader) return {};
    try {
      return this.authHeader(source);
    } catch (err) {
      throw new AuthenticationFailureError(
        `Authentication failed for source ${source.source_id}`,
        source.source_id,
        err
      );
    }
  }
}

// Example usage skeleton - DO NOT IMPLEMENT
// export class ExampleApiAdapter extends GenericApiAdapter {
//   public readonly adapterId = 'example-api';
//   protected baseUrl = 'https://api.example.com';
//   protected endpointPath = '/opportunities';
//   protected authHeader = (source) => ({ 'Authorization': `Bearer ${source.authentication?.apiKey}` });
//
//   protected isCompatible(source: SourceRegistryEntry): boolean {
//     return source.name === 'Example Source';
//   }
//
//   async discover(options: DiscoverOptions): Promise<string[]> {
//     // Implementation
//   }
//   ...
// }

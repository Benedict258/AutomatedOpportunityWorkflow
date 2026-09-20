import type { SourceRegistryEntry } from 'shared/registry/types';
import type {
  AdapterMetadata,
  HealthCheckResult,
  SearchQuery,
  NormalizedOpportunity,
} from './types';

export interface SearchProvider {
  readonly adapterId: string;
  supports(source: SourceRegistryEntry): boolean;

  search(query: SearchQuery): Promise<NormalizedOpportunity[]>;
  get_metadata(): Promise<AdapterMetadata>;
  health_check(sourceId: string): Promise<HealthCheckResult>;
}

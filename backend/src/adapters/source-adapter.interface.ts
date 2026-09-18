import type { SourceRegistryEntry } from '../../../shared/src/registry/types';
import type {
  FetchOptions,
  DiscoverOptions,
  NormalizedOpportunity,
  AdapterMetadata,
  HealthCheckResult,
  ValidationResult,
} from './types';

export interface SourceAdapter {
  readonly adapterId: string;
  readonly supports(source: SourceRegistryEntry): boolean;

  discover(options: DiscoverOptions): Promise<string[]>;
  fetch(options: FetchOptions): Promise<unknown>;
  normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]>;
  validate(normalized: NormalizedOpportunity[]): Promise<ValidationResult>;
  get_metadata(): Promise<AdapterMetadata>;
  health_check(sourceId: string): Promise<HealthCheckResult>;
}

export interface AdapterFactory {
  create(source: SourceRegistryEntry): SourceAdapter;
  canHandle(source: SourceRegistryEntry): boolean;
}

export type SourceType = 'api' | 'web' | 'rss' | 'scrape' | 'database';

export interface TaxonomyNodeRef {
  taxonomyFile: string;
  nodeId: string;
  keywords?: string[];
}

export interface QueryFilter {
  taxonomyNodes?: TaxonomyNodeRef[];
  keywords?: string[];
  excludeKeywords?: string[];
  opportunityTypes?: string[];
  geographic?: GeographicFilter;
  remote?: boolean | null;
  profileSkills?: string[];
  profileInterests?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  sourceSpecific?: Record<string, unknown>;
}

export interface GeographicFilter {
  countries?: string[];
  regions?: string[];
  cities?: string[];
  remoteAllowed?: boolean;
}

export interface QueryDefinition {
  id: string;
  name: string;
  description?: string;
  family: string;
  sourceId?: string;
  sourceType?: SourceType;
  filters: QueryFilter;
  priority?: number;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface QueryTemplate {
  id: string;
  name: string;
  family: string;
  description?: string;
  baseFilters: QueryFilter;
  parameters?: string[];
  version: string;
  active: boolean;
  examples?: QueryDefinition[];
}

export interface QueryFamily {
  id: string;
  name: string;
  description?: string;
  taxonomyRoots?: TaxonomyNodeRef[];
  defaultFilters?: Partial<QueryFilter>;
  templates?: string[];
}

export interface SourceCapability {
  sourceId: string;
  sourceType: SourceType;
  supportedFilters: (keyof QueryFilter)[];
  maxQueriesPerRun?: number;
}

export interface QueryPlanItem {
  sourceId: string;
  query: QueryDefinition;
  estimatedCost?: number;
}

export interface QueryPlan {
  runId: string;
  jobId: string;
  generatedAt: string;
  items: QueryPlanItem[];
  metadata?: Record<string, unknown>;
}

export interface StrategyConfig {
  taxonomyPath?: string;
  maxQueriesPerSource?: number;
  enableProfileAware?: boolean;
  enableGeographic?: boolean;
  defaultPriority?: number;
}

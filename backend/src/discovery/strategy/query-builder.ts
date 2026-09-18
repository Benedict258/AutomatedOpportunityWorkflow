import { QueryDefinition, QueryFilter, TaxonomyNodeRef, QueryTemplate, StrategyConfig } from './types';
import { TaxonomyService } from './taxonomy-service';

export interface QueryBuilderOptions {
  taxonomyService: TaxonomyService;
  config?: StrategyConfig;
}

export class QueryBuilder {
  private taxonomyService: TaxonomyService;
  private config: StrategyConfig;

  constructor(options: QueryBuilderOptions) {
    this.taxonomyService = options.taxonomyService;
    this.config = options.config ?? {};
  }

  buildFromTemplate(template: QueryTemplate, params: Record<string, unknown> = {}, overrides?: Partial<QueryDefinition>): QueryDefinition {
    const filters = this.mergeFilters(template.baseFilters, params);
    const id = overrides?.id ?? `${template.id}-${Date.now()}`;
    const query: QueryDefinition = {
      id,
      name: overrides?.name ?? template.name,
      description: template.description,
      family: template.family,
      sourceId: overrides?.sourceId,
      sourceType: overrides?.sourceType,
      filters,
      priority: overrides?.priority ?? this.config.defaultPriority ?? 50,
      active: template.active,
      metadata: {
        templateId: template.id,
        version: template.version,
        ...overrides?.metadata,
      },
    };
    return query;
  }

  buildTaxonomyDrivenQuery(nodeRefs: TaxonomyNodeRef[], options: {
    sourceId?: string;
    family?: string;
    name?: string;
    extraFilters?: Partial<QueryFilter>;
  } = {}): QueryDefinition {
    const expanded = this.taxonomyService.expandTaxonomyRefs(nodeRefs);
    const keywords = Array.from(new Set(expanded.flatMap(e => e.keywords)));
    const filters: QueryFilter = {
      taxonomyNodes: nodeRefs,
      keywords,
      ...options.extraFilters,
    };
    return {
      id: `tax-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      name: options.name ?? 'Taxonomy Driven Query',
      family: options.family ?? 'software_engineering',
      filters,
      active: true,
      priority: this.config.defaultPriority ?? 50,
    };
  }

  buildProfileAwareQuery(profile: {
    skills?: string[];
    interests?: string[];
    location?: string;
    remotePreference?: boolean;
  }, options: {
    sourceId?: string;
    family?: string;
  } = {}): QueryDefinition {
    const filters: QueryFilter = {
      profileSkills: profile.skills,
      profileInterests: profile.interests,
      geographic: profile.location ? { cities: [profile.location] } : undefined,
      remote: profile.remotePreference ?? null,
    };
    return {
      id: `profile-${Date.now()}`,
      name: 'Profile Aware Query',
      family: options.family ?? 'software_engineering',
      sourceId: options.sourceId,
      filters,
      active: true,
      priority: this.config.defaultPriority ?? 50,
    };
  }

  buildGeographicQuery(geographic: {
    countries?: string[];
    regions?: string[];
    cities?: string[];
    remoteAllowed?: boolean;
  }, options: {
    nodeRefs?: TaxonomyNodeRef[];
    family?: string;
  } = {}): QueryDefinition {
    const baseFilters: QueryFilter = { geographic };
    if (options.nodeRefs) {
      const expanded = this.taxonomyService.expandTaxonomyRefs(options.nodeRefs);
      baseFilters.taxonomyNodes = options.nodeRefs;
      baseFilters.keywords = Array.from(new Set(expanded.flatMap(e => e.keywords)));
    }
    return {
      id: `geo-${Date.now()}`,
      name: 'Geographic Query',
      family: options.family ?? 'software_engineering',
      filters: baseFilters,
      active: true,
      priority: this.config.defaultPriority ?? 50,
    };
  }

  buildOpportunityTypeQuery(types: string[], options: {
    nodeRefs?: TaxonomyNodeRef[];
    family?: string;
  } = {}): QueryDefinition {
    const filters: QueryFilter = { opportunityTypes: types };
    if (options.nodeRefs) {
      const expanded = this.taxonomyService.expandTaxonomyRefs(options.nodeRefs);
      filters.taxonomyNodes = options.nodeRefs;
      filters.keywords = Array.from(new Set(expanded.flatMap(e => e.keywords)));
    }
    return {
      id: `type-${Date.now()}`,
      name: 'Opportunity Type Query',
      family: options.family ?? 'software_engineering',
      filters,
      active: true,
      priority: this.config.defaultPriority ?? 50,
    };
  }

  buildRemoteQuery(allowRemote: boolean, options: {
    nodeRefs?: TaxonomyNodeRef[];
    family?: string;
  } = {}): QueryDefinition {
    const filters: QueryFilter = { remote: allowRemote, geographic: { remoteAllowed: allowRemote } };
    if (options.nodeRefs) {
      const expanded = this.taxonomyService.expandTaxonomyRefs(options.nodeRefs);
      filters.taxonomyNodes = options.nodeRefs;
      filters.keywords = Array.from(new Set(expanded.flatMap(e => e.keywords)));
    }
    return {
      id: `remote-${Date.now()}`,
      name: 'Remote Query',
      family: options.family ?? 'software_engineering',
      filters,
      active: true,
      priority: this.config.defaultPriority ?? 50,
    };
  }

  buildSourceSpecificQuery(sourceId: string, sourceType: string, customFilters: Record<string, unknown>, options: {
    family?: string;
    nodeRefs?: TaxonomyNodeRef[];
  } = {}): QueryDefinition {
    const filters: QueryFilter = {
      sourceSpecific: customFilters,
    };
    if (options.nodeRefs) {
      const expanded = this.taxonomyService.expandTaxonomyRefs(options.nodeRefs);
      filters.taxonomyNodes = options.nodeRefs;
      filters.keywords = Array.from(new Set(expanded.flatMap(e => e.keywords)));
    }
    return {
      id: `source-${sourceId}-${Date.now()}`,
      name: `Source Specific Query: ${sourceId}`,
      family: options.family ?? 'software_engineering',
      sourceId,
      sourceType: sourceType as any,
      filters,
      active: true,
      priority: this.config.defaultPriority ?? 50,
    };
  }

  private mergeFilters(base: QueryFilter, params: Record<string, unknown>): QueryFilter {
    const merged: QueryFilter = { ...base };
    if (params.keywords) merged.keywords = this.mergeArrays(base.keywords, params.keywords as string[]);
    if (params.taxonomyNodes) merged.taxonomyNodes = params.taxonomyNodes as TaxonomyNodeRef[];
    if (params.profileSkills) merged.profileSkills = params.profileSkills as string[];
    if (params.profileInterests) merged.profileInterests = params.profileInterests as string[];
    if (params.countries || params.regions || params.remote) {
      merged.geographic = {
        ...base.geographic,
        countries: params.countries as string[] ?? base.geographic?.countries,
        regions: params.regions as string[] ?? base.geographic?.regions,
        remoteAllowed: params.remote as boolean ?? base.geographic?.remoteAllowed,
      };
      merged.remote = params.remote as boolean ?? base.remote ?? null;
    }
    if (params.opportunityTypes) merged.opportunityTypes = params.opportunityTypes as string[];
    return merged;
  }

  private mergeArrays(base?: string[], addition?: string[]): string[] {
    const set = new Set<string>();
    (base ?? []).forEach(v => set.add(v.toLowerCase()));
    (addition ?? []).forEach(v => set.add(v.toLowerCase()));
    return Array.from(set);
  }
}

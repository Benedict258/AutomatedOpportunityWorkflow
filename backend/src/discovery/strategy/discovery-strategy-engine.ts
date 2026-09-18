import { QueryPlan, QueryPlanItem, QueryDefinition, StrategyConfig, SourceCapability } from './types';
import { QueryBuilder } from './query-builder';
import { TaxonomyService } from './taxonomy-service';
import { getQueryFamily, QUERY_FAMILIES } from './query-families';
import { getQueryTemplate, QUERY_TEMPLATES } from './query-templates';

export interface DiscoveryStrategyOptions {
  taxonomyService: TaxonomyService;
  config?: StrategyConfig;
  sourceCapabilities?: SourceCapability[];
}

export class DiscoveryStrategyEngine {
  private queryBuilder: QueryBuilder;
  private taxonomyService: TaxonomyService;
  private config: StrategyConfig;
  private sourceCapabilities: Map<string, SourceCapability>;

  constructor(options: DiscoveryStrategyOptions) {
    this.taxonomyService = options.taxonomyService;
    this.config = options.config ?? {};
    this.queryBuilder = new QueryBuilder({ taxonomyService: this.taxonomyService, config: this.config });
    this.sourceCapabilities = new Map((options.sourceCapabilities ?? []).map(s => [s.sourceId, s]));
  }

  generateQueryPlan(params: {
    runId: string;
    jobId: string;
    families?: string[];
    sourceIds?: string[];
    profile?: {
      skills?: string[];
      interests?: string[];
      location?: string;
      remotePreference?: boolean;
    };
    geographic?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
      remoteAllowed?: boolean;
    };
    opportunityTypes?: string[];
    maxQueriesPerSource?: number;
  }): QueryPlan {
    const items: QueryPlanItem[] = [];
    const families = params.families && params.families.length > 0
      ? params.families.map(id => getQueryFamily(id)).filter(Boolean)
      : QUERY_FAMILIES;

    const maxPerSource = params.maxQueriesPerSource ?? this.config.maxQueriesPerSource ?? 5;

    for (const family of families) {
      const queries = this.generateQueriesForFamily(family, {
        sourceIds: params.sourceIds,
        profile: params.profile,
        geographic: params.geographic,
        opportunityTypes: params.opportunityTypes,
        maxPerSource,
      });
      items.push(...queries);
    }

    return {
      runId: params.runId,
      jobId: params.jobId,
      generatedAt: new Date().toISOString(),
      items,
      metadata: {
        families: families.map(f => f.id),
        sourceFilter: params.sourceIds,
      },
    };
  }

  private generateQueriesForFamily(family: any, ctx: {
    sourceIds?: string[];
    profile?: any;
    geographic?: any;
    opportunityTypes?: string[];
    maxPerSource: number;
  }): QueryPlanItem[] {
    const items: QueryPlanItem[] = [];
    const nodeRefs = family.taxonomyRoots ?? [];

    // Taxonomy driven base query
    if (nodeRefs.length > 0) {
      const query = this.queryBuilder.buildTaxonomyDrivenQuery(nodeRefs, {
        family: family.id,
        name: `${family.name} Taxonomy Query`,
      });
      items.push(this.applySourceCapabilities(query, ctx.sourceIds, ctx.maxPerSource));
    }

    // Profile aware
    if (this.config.enableProfileAware && ctx.profile) {
      const query = this.queryBuilder.buildProfileAwareQuery(ctx.profile, { family: family.id });
      // enrich with taxonomy
      if (nodeRefs.length) {
        const enriched = this.queryBuilder.buildTaxonomyDrivenQuery(nodeRefs, {
          family: family.id,
          name: `${family.name} Profile Enriched`,
          extraFilters: {
            profileSkills: ctx.profile.skills,
            profileInterests: ctx.profile.interests,
          },
        });
        items.push(this.toItem(enriched, ctx.sourceIds));
      }
    }

    // Geographic
    if (this.config.enableGeographic && ctx.geographic) {
      const query = this.queryBuilder.buildGeographicQuery(ctx.geographic, { nodeRefs, family: family.id });
      items.push(this.toItem(query, ctx.sourceIds));
    }

    // Opportunity type
    if (ctx.opportunityTypes && ctx.opportunityTypes.length) {
      const query = this.queryBuilder.buildOpportunityTypeQuery(ctx.opportunityTypes, { nodeRefs, family: family.id });
      items.push(this.toItem(query, ctx.sourceIds));
    }

    // Remote
    if (ctx.profile?.remotePreference !== undefined) {
      const query = this.queryBuilder.buildRemoteQuery(ctx.profile.remotePreference, { nodeRefs, family: family.id });
      items.push(this.toItem(query, ctx.sourceIds));
    }

    // Templates for family
    const templates = QUERY_TEMPLATES.filter(t => t.family === family.id && t.active);
    for (const tmpl of templates) {
      const query = this.queryBuilder.buildFromTemplate(tmpl, {}, { name: `${family.name} Template ${tmpl.id}` });
      items.push(this.toItem(query, ctx.sourceIds));
    }

    return items;
  }

  private toItem(query: QueryDefinition, sourceIds?: string[]): QueryPlanItem {
    return {
      sourceId: 'all',
      query,
    };
  }

  private applySourceCapabilities(query: QueryDefinition, sourceIds?: string[], maxPerSource?: number): QueryPlanItem {
    const targetSources = sourceIds && sourceIds.length > 0 ? sourceIds : Array.from(this.sourceCapabilities.keys());
    const items: QueryPlanItem[] = [];
    for (const sourceId of targetSources) {
      const cap = this.sourceCapabilities.get(sourceId);
      if (cap) {
        const supported = this.isQuerySupportedBySource(query, cap);
        if (supported) {
          items.push({
            sourceId,
            query: { ...query, sourceId },
          });
        }
      } else {
        items.push({ sourceId, query: { ...query, sourceId } });
      }
    }
    // If no specific sources, return generic
    if (items.length === 0) {
      return { sourceId: 'all', query };
    }
    // For simplicity return first; caller can expand
    return items[0];
  }

  private isQuerySupportedBySource(query: QueryDefinition, cap: SourceCapability): boolean {
    const filters = query.filters;
    const supported = cap.supportedFilters ?? [];
    const requiredKeys: (keyof typeof filters)[] = [];
    if (filters.taxonomyNodes) requiredKeys.push('taxonomyNodes');
    if (filters.keywords) requiredKeys.push('keywords');
    if (filters.geographic) requiredKeys.push('geographic');
    if (filters.remote !== null && filters.remote !== undefined) requiredKeys.push('remote');
    if (filters.profileSkills) requiredKeys.push('profileSkills');
    if (filters.opportunityTypes) requiredKeys.push('opportunityTypes');
    if (filters.sourceSpecific) requiredKeys.push('sourceSpecific');
    return requiredKeys.every(k => supported.includes(k as any));
  }

  generateQueriesFromTaxonomy(nodeIds: { file: string; id: string }[], options?: {
    sourceIds?: string[];
    family?: string;
  }): QueryDefinition[] {
    const nodeRefs = nodeIds.map(n => ({ taxonomyFile: n.file, nodeId: n.id }));
    const queries: QueryDefinition[] = [];
    for (const ref of nodeRefs) {
      const q = this.queryBuilder.buildTaxonomyDrivenQuery([ref], {
        family: options?.family,
        name: `Taxonomy Query ${ref.nodeId}`,
      });
      queries.push(q);
    }
    return queries;
  }

  getAvailableFamilies(): string[] {
    return QUERY_FAMILIES.map(f => f.id);
  }
}

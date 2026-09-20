import { BaseSourceAdapter } from './base-adapter';
import type { SourceRegistryEntry } from 'shared/registry/types';
import type { FetchOptions, DiscoverOptions, NormalizedOpportunity } from './types';
import { SourceType, SourceCategory } from 'shared/registry/types';
import { AuthenticationFailureError, NetworkFailureError, SourceUnavailableError } from './errors';

interface USAJOBSResponse {
  SearchResult: {
    SearchResultCount: number;
    SearchResultItems: USAJOBSItem[];
  };
}

interface USAJOBSItem {
  MatchedObjectDescriptor: {
    PositionID: string;
    PositionTitle: string;
    PositionURI: string;
    ApplyURI?: string;
    PositionLocation?: Array<{ LocationName: string }>;
    OrganizationName?: string;
    PositionRemarks?: string;
    QualificationSummary?: string;
    PositionScheduleTypeCode?: string[];
    HiringPath?: string[];
    RemoteIndicator?: string;
    PositionStartDate?: string;
    PositionEndDate?: string;
    WhoMayApply?: string;
    PositionOfferingTypeCode?: string[];
    PositionTypeCode?: string[];
  };
}

export class USAJobsAdapter extends BaseSourceAdapter {
  public readonly adapterId = 'usajobs-api-adapter';
  private readonly baseUrl = process.env.USAJOBS_BASE_URL || 'https://data.usajobs.gov';

  supports(source: SourceRegistryEntry): boolean {
    return (
      source.source_type === SourceType.API &&
      source.category === SourceCategory.EMPLOYMENT &&
      (source.name.toLowerCase().includes('usajobs') || (source.organization?.toLowerCase().includes('usajobs') ?? false))
    );
  }

  async discover(options: DiscoverOptions): Promise<string[]> {
    const raw = await this.fetch({ sourceId: options.sourceId, limit: options.maxItems ?? 20 });
    const items = (raw as USAJOBSResponse)?.SearchResult?.SearchResultItems ?? [];
    return items.map((i) => i.MatchedObjectDescriptor.PositionID);
  }

  async fetch(options: FetchOptions): Promise<unknown> {
    const apiKey = process.env.USAJOBS_API_KEY;
    const userAgent = process.env.USAJOBS_USER_AGENT;
    const maxPages = Number(process.env.USAJOBS_MAX_PAGES) || 5;
    const perPage = Number(process.env.USAJOBS_RESULTS_PER_PAGE) || 20;
    const maxResults = Number(process.env.USAJOBS_MAX_RESULTS) || 100;

    if (!apiKey || !userAgent) {
      throw new AuthenticationFailureError('USAJOBS API key or User-Agent not configured', options.sourceId);
    }

    const allItems: USAJOBSItem[] = [];
    let page = 1;
    let totalCollected = 0;

    while (page <= maxPages && totalCollected < maxResults) {
      const url = new URL(`${this.baseUrl}/api/search`);
      url.searchParams.set('Keyword', (options.filters?.keyword as string) || 'software');
      url.searchParams.set('ResultsPerPage', String(perPage));
      url.searchParams.set('Page', String(page));
      url.searchParams.set('Fields', 'Full');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Host': 'data.usajobs.gov',
          'User-Agent': userAgent,
          'Authorization-Key': apiKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationFailureError('USAJOBS authentication failed', options.sourceId);
        }
        if (response.status === 429) {
          throw new NetworkFailureError('USAJOBS rate limit exceeded', options.sourceId);
        }
        if (response.status >= 500) {
          throw new SourceUnavailableError('USAJOBS service unavailable', options.sourceId);
        }
        throw new NetworkFailureError(`USAJOBS HTTP ${response.status}`, options.sourceId);
      }

      const data = (await response.json()) as USAJOBSResponse;
      const items = data.SearchResult?.SearchResultItems ?? [];
      allItems.push(...items);
      totalCollected += items.length;

      if (items.length < perPage) break;
      page++;
    }

    return { SearchResult: { SearchResultCount: allItems.length, SearchResultItems: allItems } };
  }

  async normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]> {
    const response = raw as USAJOBSResponse;
    const items = response.SearchResult?.SearchResultItems ?? [];
    const now = new Date().toISOString();

    return items.map((item) => {
      const desc = item.MatchedObjectDescriptor;
      const location = desc.PositionLocation?.[0]?.LocationName;
      const remote = desc.RemoteIndicator === '1' ? { remote: true } : {};
      const deadline = desc.PositionEndDate ? new Date(desc.PositionEndDate).toISOString() : null;
      const pubDate = desc.PositionStartDate ? new Date(desc.PositionStartDate).toISOString() : now;

      return {
        sourceId,
        externalId: desc.PositionID,
        title: desc.PositionTitle,
        organization: desc.OrganizationName,
        description: [desc.PositionRemarks, desc.QualificationSummary].filter(Boolean).join('\n\n') || undefined,
        url: desc.ApplyURI || desc.PositionURI,
        location,
        remoteInfo: remote,
        opportunityType: desc.PositionScheduleTypeCode?.[0] || 'FULL_TIME',
        status: 'OPEN',
        publicationDate: pubDate,
        applicationDeadline: deadline,
        deadlineType: deadline ? 'HARD' : 'NONE',
        firstSeenAt: now,
        lastSeenAt: now,
        rawData: item,
      };
    });
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
    return true;
  }

  async ping(sourceId: string): Promise<void> {
    const apiKey = process.env.USAJOBS_API_KEY;
    const userAgent = process.env.USAJOBS_USER_AGENT;
    if (!apiKey || !userAgent) {
      throw new AuthenticationFailureError('USAJOBS API key or User-Agent not configured', sourceId);
    }
    const url = new URL(`${this.baseUrl}/api/search`);
    url.searchParams.set('Keyword', 'test');
    url.searchParams.set('ResultsPerPage', '1');
    const resp = await fetch(url.toString(), {
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': userAgent,
        'Authorization-Key': apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new NetworkFailureError(`USAJOBS ping failed ${resp.status}`, sourceId);
  }
}
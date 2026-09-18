import { BaseSourceAdapter } from './base-adapter';
import type { SourceRegistryEntry } from '../../../shared/src/registry/types';
import type { FetchOptions, DiscoverOptions, NormalizedOpportunity } from './types';
import { SourceCategory, SourceType, AccessMethod } from '../../../shared/src/registry/types';
import { AuthenticationFailureError, SourceUnavailableError, NetworkFailureError, MalformedResponseError, ParsingFailureError } from './errors';

// Fixture data for development when API key unavailable
const USAJOBS_FIXTURE = {
  SearchResult: {
    SearchResultCount: 2,
    SearchResultCountAll: 2,
    SearchResultItems: [
      {
        MatchedObjectId: '21947200',
        MatchedObjectDescriptor: {
          PositionID: 'SW62210-05-1716110PB411413H',
          PositionTitle: 'IT Specialist (InfoSec/Network)',
          PositionURI: 'https://www.usajobs.gov/GetJob/ViewDetails/21947200',
          ApplyURI: ['https://www.usajobs.gov/GetJob/ViewDetails/21947200?PostingChannelID=RESTAPI'],
          PositionLocationDisplay: 'Point Loma Complex, San Diego, California',
          PositionLocation: [{
            LocationName: 'Point Loma Complex, San Diego, California',
            CountryCode: 'United States',
            CountrySubDivisionCode: 'California'
          }],
          OrganizationName: 'Space and Naval Warfare Systems Command',
          DepartmentName: 'Department of the Navy',
          JobCategory: [
            { Name: 'Information Technology', Code: '2200' },
            { Name: 'Information Technology Management', Code: '2210' }
          ],
          PositionSchedule: [{ Name: 'Full Time', Code: '1' }],
          PositionOfferingType: [{ Name: 'Permanent', Code: '15317' }],
          QualificationSummary: 'IT specialist role',
          PositionRemuneration: [{
            MinimumRange: '92108',
            MaximumRange: '119746',
            RateIntervalCode: 'PA',
            Description: 'Per Year'
          }],
          PublicationStartDate: '2016-06-05T00:00:00Z',
          ApplicationCloseDate: '2016-12-01T00:00:00Z',
          UserArea: {
            Details: {
              JobSummary: 'Major duties and responsibilities',
              WhoMayApply: { Name: 'United States Citizens', Code: '15514' }
            }
          }
        },
        RelevanceRank: 0.0
      },
      {
        MatchedObjectId: '98765432',
        MatchedObjectDescriptor: {
          PositionID: 'ABC123-01-999',
          PositionTitle: 'Data Analyst',
          PositionURI: 'https://www.usajobs.gov/GetJob/ViewDetails/98765432',
          PositionLocationDisplay: 'Remote',
          PositionLocation: [{
            LocationName: 'Remote',
            CountryCode: 'United States'
          }],
          OrganizationName: 'Department of Veterans Affairs',
          DepartmentName: 'Department of Veterans Affairs',
          JobCategory: [{ Name: 'Information Technology', Code: '2200' }],
          PositionSchedule: [{ Name: 'Full Time', Code: '1' }],
          PositionOfferingType: [{ Name: 'Permanent', Code: '15317' }],
          PublicationStartDate: '2025-09-01T00:00:00Z',
          ApplicationCloseDate: null,
          UserArea: {
            Details: {
              JobSummary: 'Data analyst remote role',
              WhoMayApply: { Name: 'Public', Code: '15515' }
            }
          }
        }
      }
    ]
  }
};

export class USAJobsAdapter extends BaseSourceAdapter {
  public readonly adapterId = 'usajobs-api-adapter';
  private readonly baseUrl = 'https://data.usajobs.gov';
  private readonly endpointPath = '/api/search';

  supports(source: SourceRegistryEntry): boolean {
    return (
      source.source_id === 'gov_usajobs_001' &&
      source.source_type === SourceType.API &&
      source.category === SourceCategory.GOVERNMENT
    );
  }

  async discover(options: DiscoverOptions): Promise<string[]> {
    const sourceId = options.sourceId;
    // Discovery returns external IDs available
    // For USAJobs, we can query with minimal params to get recent IDs
    const raw = await this.fetch({ sourceId, limit: options.maxItems ?? 10 });
    const items = this.extractItems(raw);
    return items.map(item => item.MatchedObjectId);
  }

  async fetch(options: FetchOptions): Promise<unknown> {
    const sourceId = options.sourceId;
    
    // Check credentials availability
    const credentialsAvailable = this.hasCredentials(sourceId);
    
    if (!credentialsAvailable) {
      // Use fixture data for development
      // Real implementation would throw AuthenticationFailureError
      return USAJOBS_FIXTURE;
    }

    try {
      const url = this.buildUrl(sourceId, options);
      const headers = this.buildHeaders(sourceId);
      
      // In real implementation, perform HTTP GET
      // const response = await fetch(url, { headers });
      // if (!response.ok) { ... }
      // return await response.json();
      
      throw new SourceUnavailableError('Real fetch not implemented without credentials', sourceId);
    } catch (err) {
      this.handleError(err, sourceId, 'fetch');
    }
  }

  async normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]> {
    if (!raw || typeof raw !== 'object') {
      this.wrapMalformedResponse(sourceId, raw);
    }

    try {
      const items = this.extractItems(raw);
      const now = new Date().toISOString();
      const normalized: NormalizedOpportunity[] = [];

      for (const item of items) {
        const desc = item.MatchedObjectDescriptor;
        if (!desc) continue;

        const externalId = item.MatchedObjectId ?? desc.PositionID;
        const publicationDate = desc.PublicationStartDate ?? undefined;
        const applicationDeadline = desc.ApplicationCloseDate ?? null;
        const deadlineType = applicationDeadline ? 'FIXED' : 'UNKNOWN';

        const location = desc.PositionLocationDisplay ??
          desc.PositionLocation?.[0]?.LocationName ??
          undefined;

        const remoteInfo = location?.toLowerCase().includes('remote') 
          ? { isRemote: true, location }
          : { isRemote: false, location };

        const normalizedUrl = desc.PositionURI ? desc.PositionURI.toLowerCase().trim() : undefined;

        const opportunity: NormalizedOpportunity = {
          sourceId,
          externalId,
          title: desc.PositionTitle ?? '',
          organization: desc.OrganizationName,
          description: desc.UserArea?.Details?.JobSummary ?? desc.QualificationSummary,
          url: desc.PositionURI,
          location,
          remoteInfo,
          opportunityType: desc.PositionOfferingType?.[0]?.Name,
          categoryIds: desc.JobCategory?.map(c => c.Code) ?? [],
          status: 'OPEN',
          publicationDate,
          applicationDeadline,
          deadlineType,
          firstSeenAt: now,
          lastSeenAt: now,
          rawData: {
            eligibility: desc.UserArea?.Details?.WhoMayApply,
            department: desc.DepartmentName,
            jobCategory: desc.JobCategory,
            remuneration: desc.PositionRemuneration,
          }
        };

        normalized.push(opportunity);
      }

      return normalized;
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
    return true;
  }

  protected supportsPagination(): boolean {
    return true;
  }

  async ping(sourceId: string): Promise<void> {
    const credentialsAvailable = this.hasCredentials(sourceId);
    if (!credentialsAvailable) {
      // Simulate degraded health
      throw new AuthenticationFailureError('API key not configured for USAJobs', sourceId);
    }
    // Real ping would HEAD baseUrl
  }

  private hasCredentials(sourceId: string): boolean {
    // Check environment for USAJOBS_API_KEY
    // For now, credentials are unavailable
    return false;
  }

  private buildHeaders(sourceId: string): Record<string, string> {
    const apiKey = process.env.USAJOBS_API_KEY;
    const userAgent = process.env.USAJOBS_USER_AGENT || 'opportunity-intelligence@example.com';
    
    if (!apiKey) {
      throw new AuthenticationFailureError('USAJOBS_API_KEY not configured', sourceId);
    }

    return {
      'Host': 'data.usajobs.gov',
      'User-Agent': userAgent,
      'Authorization-Key': apiKey
    };
  }

  private buildUrl(sourceId: string, options: FetchOptions): string {
    const params = new URLSearchParams();
    params.set('Fields', 'Full');
    if (options.limit) params.set('ResultsPerPage', String(Math.min(options.limit, 500)));
    if (options.cursor) params.set('Page', options.cursor);
    // Add since filter if publication date available
    if (options.since) {
      // USAJobs supports DatePosted filter
      const daysAgo = Math.max(1, Math.floor((Date.now() - new Date(options.since).getTime()) / 86400000));
      params.set('DatePosted', String(daysAgo));
    }
    return `${this.baseUrl}${this.endpointPath}?${params.toString()}`;
  }

  private extractItems(raw: unknown): any[] {
    const data = raw as any;
    return data?.SearchResult?.SearchResultItems ?? [];
  }
}

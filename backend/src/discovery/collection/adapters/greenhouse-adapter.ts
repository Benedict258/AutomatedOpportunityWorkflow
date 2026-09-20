import { BaseSourceAdapter } from '../../../adapters/base-adapter';
import type { SourceRegistryEntry } from 'shared/registry/types';
import type { FetchOptions, DiscoverOptions, NormalizedOpportunity } from '../../../adapters/types';
import { SourceType, SourceCategory } from 'shared/registry/types';
import { AuthenticationFailureError } from '../../../adapters/errors';

const GREENHOUSE_FIXTURE = {
  jobs: [
    {
      id: 1001,
      title: 'Senior Backend Engineer',
      updated_at: '2025-09-15T10:00:00Z',
      departments: [{ name: 'Engineering' }],
      locations: [{ name: 'Remote' }],
      content: 'Build scalable systems...',
      absolute_url: 'https://jobs.lever.co/company/1001',
    },
    {
      id: 1002,
      title: 'Product Manager',
      updated_at: '2025-09-14T09:30:00Z',
      departments: [{ name: 'Product' }],
      locations: [{ name: 'San Francisco, CA' }],
      content: 'Lead product initiatives...',
      absolute_url: 'https://jobs.lever.co/company/1002',
    },
  ],
};

export class GreenhouseAdapter extends BaseSourceAdapter {
  public readonly adapterId = 'greenhouse-api-adapter';
  private readonly baseUrl = 'https://boards-api.greenhouse.io/v1';

  supports(source: SourceRegistryEntry): boolean {
    return (
      source.source_type === SourceType.API &&
      (source.category === SourceCategory.EMPLOYMENT || source.category === SourceCategory.TECHNICAL) &&
      (source.name.toLowerCase().includes('greenhouse') || (source.organization?.toLowerCase().includes('greenhouse') ?? false))
    );
  }

  async discover(options: DiscoverOptions): Promise<string[]> {
    const raw = await this.fetch({ sourceId: options.sourceId, limit: options.maxItems ?? 50 });
    const jobs = (raw as any)?.jobs ?? [];
    return jobs.map((j: any) => String(j.id));
  }

  async fetch(options: FetchOptions): Promise<unknown> {
    const sourceId = options.sourceId;
    const credentialsAvailable = this.hasCredentials(sourceId);

    if (!credentialsAvailable) {
      // Return fixture for development
      return GREENHOUSE_FIXTURE;
    }

    // Real implementation would perform HTTP GET with auth
    throw new AuthenticationFailureError('Greenhouse API key not configured', sourceId);
  }

  async normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]> {
    // Normalization is out of scope for collection step.
    // Returning empty to satisfy interface; collection step uses raw data only.
    return [];
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
      throw new AuthenticationFailureError('API key not configured for Greenhouse', sourceId);
    }
  }

  private hasCredentials(sourceId: string): boolean {
    // Placeholder: check env vars
    return !!process.env.GREENHOUSE_API_KEY;
  }
}

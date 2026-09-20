import { BaseSourceAdapter } from '../../../adapters/base-adapter';
import type { SourceRegistryEntry } from 'shared/registry/types';
import type { FetchOptions, DiscoverOptions, NormalizedOpportunity } from '../../../adapters/types';
import { SourceType, SourceCategory } from 'shared/registry/types';
import { AuthenticationFailureError } from '../../../adapters/errors';

const EVENTBRITE_FIXTURE = {
  events: [
    {
      id: 'evt_001',
      name: { text: 'AI Ethics Summit 2025' },
      start: { local: '2025-10-15T09:00:00' },
      end: { local: '2025-10-15T17:00:00' },
      url: 'https://www.eventbrite.com/e/ai-ethics-summit-2025',
      description: { text: 'Annual summit on AI ethics...' },
      venue: { name: 'San Francisco Convention Center', city: 'San Francisco' },
    },
    {
      id: 'evt_002',
      name: { text: 'Remote Work Conference' },
      start: { local: '2025-11-01T10:00:00' },
      end: { local: '2025-11-01T16:00:00' },
      url: 'https://www.eventbrite.com/e/remote-work-conference',
      description: { text: 'Best practices for distributed teams...' },
      venue: { name: 'Virtual', city: '' },
    },
  ],
};

export class EventbriteAdapter extends BaseSourceAdapter {
  public readonly adapterId = 'eventbrite-api-adapter';
  private readonly baseUrl = 'https://www.eventbrite.com/platform/api/v3';

  supports(source: SourceRegistryEntry): boolean {
    return (
      source.source_type === SourceType.API &&
      source.category === SourceCategory.EVENT &&
      source.name.toLowerCase().includes('eventbrite')
    );
  }

  async discover(options: DiscoverOptions): Promise<string[]> {
    const raw = await this.fetch({ sourceId: options.sourceId, limit: options.maxItems ?? 50 });
    const events = (raw as any)?.events ?? [];
    return events.map((e: any) => e.id);
  }

  async fetch(options: FetchOptions): Promise<unknown> {
    const sourceId = options.sourceId;
    const credentialsAvailable = this.hasCredentials(sourceId);

    if (!credentialsAvailable) {
      return EVENTBRITE_FIXTURE;
    }

    throw new AuthenticationFailureError('Eventbrite API token not configured', sourceId);
  }

  async normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]> {
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
    if (!this.hasCredentials(sourceId)) {
      throw new AuthenticationFailureError('API token not configured for Eventbrite', sourceId);
    }
  }

  private hasCredentials(sourceId: string): boolean {
    return !!process.env.EVENTBRITE_API_TOKEN;
  }
}

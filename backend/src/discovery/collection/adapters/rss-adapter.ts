import { BaseSourceAdapter } from '../../../adapters/base-adapter';
import type { SourceRegistryEntry } from 'shared/registry/types';
import type { FetchOptions, DiscoverOptions, NormalizedOpportunity } from '../../../adapters/types';
import { SourceType, SourceCategory } from 'shared/registry/types';

const RSS_FIXTURE = {
  feed: {
    title: 'Tech News Feed',
    items: [
      {
        guid: 'rss_001',
        title: 'Breaking: New AI Fellowship Announced',
        link: 'https://example.com/news/ai-fellowship',
        pubDate: '2025-09-18T08:00:00Z',
        description: 'A new fellowship for AI researchers...',
      },
      {
        guid: 'rss_002',
        title: 'Certification Update: Cloud Security',
        link: 'https://example.com/news/cloud-cert',
        pubDate: '2025-09-17T12:00:00Z',
        description: 'Updated certification requirements...',
      },
    ],
  },
};

export class RssAdapter extends BaseSourceAdapter {
  public readonly adapterId = 'rss-adapter';
  private readonly baseUrl = '';

  supports(source: SourceRegistryEntry): boolean {
    return source.source_type === SourceType.RSS;
  }

  async discover(options: DiscoverOptions): Promise<string[]> {
    const raw = await this.fetch({ sourceId: options.sourceId });
    const items = (raw as any)?.feed?.items ?? [];
    return items.map((i: any) => i.guid ?? i.link);
  }

  async fetch(options: FetchOptions): Promise<unknown> {
    const sourceId = options.sourceId;
    // RSS is public, no auth needed. Use fixture for demo.
    // Real implementation would fetch RSS XML and parse.
    return RSS_FIXTURE;
  }

  async normalize(raw: unknown, sourceId: string): Promise<NormalizedOpportunity[]> {
    return [];
  }

  protected getSourceType(): string {
    return SourceType.RSS;
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
    // Simple ping: assume reachable if source enabled
  }

  private hasCredentials(_sourceId: string): boolean {
    return true;
  }
}

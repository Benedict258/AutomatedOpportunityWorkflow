import type { SourceRegistryEntry } from '../../../shared/src/registry/types';
import type { SourceAdapter, AdapterFactory } from '../../adapters/source-adapter.interface';
import { USAJobsAdapter } from '../../adapters/usajobs-adapter';
import { GreenhouseAdapter } from './adapters/greenhouse-adapter';
import { EventbriteAdapter } from './adapters/eventbrite-adapter';
import { RssAdapter } from './adapters/rss-adapter';

export class UsaJobsAdapterFactory implements AdapterFactory {
  canHandle(source: SourceRegistryEntry): boolean {
    return source.source_id === 'gov_usajobs_001' || source.name.toLowerCase().includes('usajobs');
  }

  create(source: SourceRegistryEntry): SourceAdapter {
    return new USAJobsAdapter();
  }
}

export class GreenhouseAdapterFactory implements AdapterFactory {
  canHandle(source: SourceRegistryEntry): boolean {
    const name = source.name.toLowerCase();
    const org = source.organization?.toLowerCase() ?? '';
    return name.includes('greenhouse') || org.includes('greenhouse') || source.source_type === 'API' && name.includes('career');
  }

  create(source: SourceRegistryEntry): SourceAdapter {
    return new GreenhouseAdapter();
  }
}

export class EventbriteAdapterFactory implements AdapterFactory {
  canHandle(source: SourceRegistryEntry): boolean {
    return source.name.toLowerCase().includes('eventbrite') || source.category === 'EVENT';
  }

  create(source: SourceRegistryEntry): SourceAdapter {
    return new EventbriteAdapter();
  }
}

export class RssAdapterFactory implements AdapterFactory {
  canHandle(source: SourceRegistryEntry): boolean {
    return source.source_type === 'RSS';
  }

  create(source: SourceRegistryEntry): SourceAdapter {
    return new RssAdapter();
  }
}

export function createDefaultAdapterFactories(): AdapterFactory[] {
  return [
    new UsaJobsAdapterFactory(),
    new GreenhouseAdapterFactory(),
    new EventbriteAdapterFactory(),
    new RssAdapterFactory(),
  ];
}

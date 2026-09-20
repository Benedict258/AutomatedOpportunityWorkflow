import { CollectionOrchestrator } from './collection-orchestrator';
import { createDefaultAdapterFactories } from './adapter-registry';
import type { SourceRegistryEntry } from 'shared/registry/types';
import { SourceCategory, SourceType, AccessMethod } from 'shared/registry/types';

const usaJobsSource: SourceRegistryEntry = {
  source_id: 'gov_usajobs_001',
  name: 'USAJobs API',
  category: SourceCategory.GOVERNMENT,
  source_type: SourceType.API,
  access_method: AccessMethod.API_KEY,
  enabled: true,
  priority: 90,
  rate_limit: { requestsPerMinute: 10 },
  metadata: { pagination: { type: 'page', pageSize: 100 } },
};

async function demo() {
  const orchestrator = new CollectionOrchestrator({
    adapterFactory: createDefaultAdapterFactories(),
    maxConcurrency: 2,
    respectRateLimits: true,
  });

  const result = await orchestrator.collect(usaJobsSource, {
    sourceId: usaJobsSource.source_id,
    limit: 10,
    maxPages: 1,
  });

  console.log('Collection result:', {
    sourceId: result.sourceId,
    status: result.status,
    documents: result.documents.length,
    metrics: result.metrics,
  });
}

// demo();

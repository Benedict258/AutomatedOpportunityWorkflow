# Query & Discovery Strategy Engine

Step 2 implementation for Automated Opportunity Intelligence System.

## Files Created

- `types.ts` - TypeScript interfaces for QueryDefinition, QueryFamily, QueryTemplate, QueryFilter, etc.
- `query-families.ts` - 19 query families defined from taxonomy
- `query-templates.ts` - Composable query templates as TS constants
- `query-templates.yaml` - Example YAML storage for templates
- `taxonomy-service.ts` - Loads taxonomy YAML files, expands nodes, extracts keywords
- `query-builder.ts` - Builds queries from taxonomy, profile, geographic, remote, opportunity-type, source-specific
- `discovery-strategy-engine.ts` - Generates query plans per source based on taxonomy and config
- `index.ts` - Public exports

## Query Families

Software Engineering, AI/ML, Cloud, Data, Cybersecurity, Government Technology, Technology Policy, AI Policy, Cyber Policy, International Affairs, Diplomacy, Research, Fellowships, Certifications, Professional Development, Hackathons, Competitions, Events, Networking.

## Usage

```ts
import { TaxonomyService } from './strategy/taxonomy-service';
import { DiscoveryStrategyEngine } from './strategy/discovery-strategy-engine';

const taxonomy = new TaxonomyService('C:/.../taxonomy');
const engine = new DiscoveryStrategyEngine({ taxonomyService: taxonomy });

const plan = engine.generateQueryPlan({
  runId: 'run-1',
  jobId: 'job-1',
  families: ['ai_ml','cybersecurity'],
  profile: { skills:['python'], remotePreference:true }
});
```

No domain model changes. Queries are composable, not hardcoded.

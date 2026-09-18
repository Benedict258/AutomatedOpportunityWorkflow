import { QueryTemplate, QueryFilter, TaxonomyNodeRef } from './types';

export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: 'taxonomy_driven_base',
    name: 'Taxonomy Driven Base',
    family: 'software_engineering',
    description: 'Base template for taxonomy-driven queries',
    version: '1.0.0',
    active: true,
    baseFilters: {
      taxonomyNodes: [],
    },
    parameters: ['taxonomyNodes', 'keywords'],
  },
  {
    id: 'profile_aware_skills',
    name: 'Profile Aware Skills',
    family: 'software_engineering',
    description: 'Query filtered by user profile skills and interests',
    version: '1.0.0',
    active: true,
    baseFilters: {
      profileSkills: [],
      profileInterests: [],
    },
    parameters: ['profileSkills', 'profileInterests'],
  },
  {
    id: 'geographic_remote',
    name: 'Geographic and Remote',
    family: 'software_engineering',
    description: 'Filter by geography and remote work options',
    version: '1.0.0',
    active: true,
    baseFilters: {
      geographic: { remoteAllowed: false },
      remote: null,
    },
    parameters: ['countries', 'regions', 'remote'],
  },
  {
    id: 'opportunity_type',
    name: 'Opportunity Type Filter',
    family: 'software_engineering',
    description: 'Filter by opportunity type taxonomy',
    version: '1.0.0',
    active: true,
    baseFilters: {
      opportunityTypes: [],
    },
    parameters: ['opportunityTypes'],
  },
  {
    id: 'source_specific_keywords',
    name: 'Source Specific Keywords',
    family: 'ai_ml',
    description: 'Source-specific keyword query',
    version: '1.0.0',
    active: true,
    baseFilters: {
      keywords: [],
      sourceSpecific: {},
    },
    parameters: ['keywords', 'sourceSpecific'],
  },
  {
    id: 'fellowship_research_government',
    name: 'Fellowship Research Government',
    family: 'fellowships',
    description: 'Government research fellowships',
    version: '1.0.0',
    active: true,
    baseFilters: {
      taxonomyNodes: [
        { taxonomyFile: 'opportunities.yaml', nodeId: 'fellowship.research' },
        { taxonomyFile: 'government.yaml', nodeId: 'government.science_research' },
      ],
      opportunityTypes: ['fellowship'],
    },
    parameters: [],
  },
  {
    id: 'cyber_policy_government',
    name: 'Cyber Policy Government',
    family: 'cyber_policy',
    description: 'Government cyber policy roles',
    version: '1.0.0',
    active: true,
    baseFilters: {
      taxonomyNodes: [
        { taxonomyFile: 'policy.yaml', nodeId: 'policy.cyber_policy' },
        { taxonomyFile: 'government.yaml', nodeId: 'government.public_policy.cyber_policy' },
      ],
    },
    parameters: [],
  },
  {
    id: 'hackathon_tech',
    name: 'Hackathon Tech',
    family: 'hackathons',
    description: 'Technology hackathons',
    version: '1.0.0',
    active: true,
    baseFilters: {
      taxonomyNodes: [
        { taxonomyFile: 'opportunities.yaml', nodeId: 'technical_experience.hackathon' },
      ],
      opportunityTypes: ['hackathon'],
    },
    parameters: ['keywords'],
  },
  {
    id: 'certification_cyber',
    name: 'Certification Cybersecurity',
    family: 'certifications',
    description: 'Cybersecurity certifications',
    version: '1.0.0',
    active: true,
    baseFilters: {
      taxonomyNodes: [
        { taxonomyFile: 'opportunities.yaml', nodeId: 'education.certification' },
        { taxonomyFile: 'technology.yaml', nodeId: 'technology.cybersecurity' },
      ],
    },
    parameters: [],
  },
  {
    id: 'event_networking_tech',
    name: 'Event Networking Tech',
    family: 'networking',
    description: 'Technology networking events',
    version: '1.0.0',
    active: true,
    baseFilters: {
      taxonomyNodes: [
        { taxonomyFile: 'opportunities.yaml', nodeId: 'events.networking' },
      ],
      opportunityTypes: ['event'],
    },
    parameters: ['geographic'],
  },
];

export function getQueryTemplate(id: string): QueryTemplate | undefined {
  return QUERY_TEMPLATES.find(t => t.id === id);
}

export function listQueryTemplates(family?: string): QueryTemplate[] {
  if (!family) return QUERY_TEMPLATES;
  return QUERY_TEMPLATES.filter(t => t.family === family && t.active);
}

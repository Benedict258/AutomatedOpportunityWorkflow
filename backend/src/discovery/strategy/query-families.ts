import { QueryFamily } from './types';

export const QUERY_FAMILIES: QueryFamily[] = [
  {
    id: 'software_engineering',
    name: 'Software Engineering',
    description: 'Software engineering opportunities',
    taxonomyRoots: [
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.software_engineering' },
      { taxonomyFile: 'opportunities.yaml', nodeId: 'work' },
    ],
  },
  {
    id: 'ai_ml',
    name: 'AI/ML',
    description: 'Artificial Intelligence and Machine Learning',
    taxonomyRoots: [
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.ai' },
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.machine_learning' },
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.generative_ai' },
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud',
    description: 'Cloud computing opportunities',
    taxonomyRoots: [
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.cloud' },
    ],
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Data engineering, analytics, science',
    taxonomyRoots: [
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.data' },
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.data_engineering' },
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.data_analytics' },
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.data_science' },
    ],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'Cybersecurity opportunities',
    taxonomyRoots: [
      { taxonomyFile: 'technology.yaml', nodeId: 'technology.cybersecurity' },
      { taxonomyFile: 'cybersecurity.yaml', nodeId: 'cybersecurity' },
    ],
  },
  {
    id: 'government_technology',
    name: 'Government Technology',
    description: 'Government tech roles and programs',
    taxonomyRoots: [
      { taxonomyFile: 'government.yaml', nodeId: 'government.technology_digital' },
      { taxonomyFile: 'opportunities.yaml', nodeId: 'government.government_technology' },
    ],
  },
  {
    id: 'technology_policy',
    name: 'Technology Policy',
    description: 'Technology policy roles',
    taxonomyRoots: [
      { taxonomyFile: 'policy.yaml', nodeId: 'policy.technology_policy' },
      { taxonomyFile: 'government.yaml', nodeId: 'government.public_policy.technology_policy' },
    ],
  },
  {
    id: 'ai_policy',
    name: 'AI Policy',
    description: 'AI policy and governance',
    taxonomyRoots: [
      { taxonomyFile: 'policy.yaml', nodeId: 'policy.ai_policy' },
      { taxonomyFile: 'government.yaml', nodeId: 'government.technology_regulation.ai_regulation' },
    ],
  },
  {
    id: 'cyber_policy',
    name: 'Cyber Policy',
    description: 'Cybersecurity policy',
    taxonomyRoots: [
      { taxonomyFile: 'policy.yaml', nodeId: 'policy.cyber_policy' },
      { taxonomyFile: 'government.yaml', nodeId: 'government.public_policy.cyber_policy' },
    ],
  },
  {
    id: 'international_affairs',
    name: 'International Affairs',
    description: 'International affairs opportunities',
    taxonomyRoots: [
      { taxonomyFile: 'international-affairs.yaml', nodeId: 'international_affairs' },
      { taxonomyFile: 'opportunities.yaml', nodeId: 'international_affairs' },
    ],
  },
  {
    id: 'diplomacy',
    name: 'Diplomacy',
    description: 'Diplomatic roles and fellowships',
    taxonomyRoots: [
      { taxonomyFile: 'international-affairs.yaml', nodeId: 'diplomacy' },
      { taxonomyFile: 'government.yaml', nodeId: 'government.foreign_affairs.diplomacy' },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Research positions and programs',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'technical_experience.research' },
      { taxonomyFile: 'opportunities.yaml', nodeId: 'fellowship.research' },
    ],
  },
  {
    id: 'fellowships',
    name: 'Fellowships',
    description: 'Fellowship programs',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'fellowship' },
      { taxonomyFile: 'fellowships.yaml', nodeId: 'fellowship' },
    ],
  },
  {
    id: 'certifications',
    name: 'Certifications',
    description: 'Professional certifications',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'education.certification' },
      { taxonomyFile: 'certifications.yaml', nodeId: 'certification' },
    ],
  },
  {
    id: 'professional_development',
    name: 'Professional Development',
    description: 'Courses, training, bootcamps',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'education' },
    ],
  },
  {
    id: 'hackathons',
    name: 'Hackathons',
    description: 'Hackathon events',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'technical_experience.hackathon' },
      { taxonomyFile: 'events.yaml', nodeId: 'events' },
    ],
  },
  {
    id: 'competitions',
    name: 'Competitions',
    description: 'Competitions and challenges',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'technical_experience.competition' },
    ],
  },
  {
    id: 'events',
    name: 'Events',
    description: 'Conferences, meetups, workshops',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'events' },
    ],
  },
  {
    id: 'networking',
    name: 'Networking',
    description: 'Networking opportunities',
    taxonomyRoots: [
      { taxonomyFile: 'opportunities.yaml', nodeId: 'events.networking' },
    ],
  },
];

export function getQueryFamily(id: string): QueryFamily | undefined {
  return QUERY_FAMILIES.find(f => f.id === id);
}

export function listQueryFamilies(): QueryFamily[] {
  return QUERY_FAMILIES;
}

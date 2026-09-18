// Synthetic evaluation fixtures - clearly marked as test data
// DO NOT use for production training or real-world claims

import { EvaluationDataset } from './types';

export const EXTRACTION_DATASET: EvaluationDataset<any, any> = {
  name: 'extraction',
  description: 'Extraction test cases - synthetic fixtures',
  version: 'v1',
  items: [
    {
      id: 'ext-001',
      input: { rawData: 'Software Engineer at Google. Python, Java, 5+ years. Remote. $150k-200k. Apply by Jan 15.' },
      expected: { title: 'Software Engineer', organization: 'Google', skills: ['Python', 'Java'], experienceYears: 5, remote: true, salaryMin: 150000, salaryMax: 200000, deadline: '2025-01-15' }
    },
    {
      id: 'ext-002',
      input: { rawData: 'Research Fellowship at MIT. PhD required. ML/AI. 2 years. $60k stipend. Deadline March 1.' },
      expected: { title: 'Research Fellowship', organization: 'MIT', education: 'PhD', skills: ['ML', 'AI'], durationYears: 2, salaryMin: 60000, deadline: '2025-03-01' }
    },
    {
      id: 'ext-003',
      input: { rawData: 'Cybersecurity Analyst - US Citizenship required. TS/SCI clearance. Washington DC. Onsite.' },
      expected: { title: 'Cybersecurity Analyst', citizenshipRequired: true, clearance: 'TS/SCI', location: 'Washington DC', remote: false }
    },
    {
      id: 'ext-004',
      input: { rawData: 'Policy Intern at State Dept. Graduate student. Foreign policy. Summer 2025. Unpaid.' },
      expected: { title: 'Policy Intern', organization: 'State Dept', education: 'Graduate', domain: 'Foreign policy', season: 'Summer 2025', compensation: 'Unpaid' }
    },
    {
      id: 'ext-005',
      input: { rawData: 'AI Research Scientist. 10+ publications. Deep learning. London. Hybrid.' },
      expected: { title: 'AI Research Scientist', publications: 10, skills: ['Deep learning'], location: 'London', remote: 'hybrid' }
    },
    {
      id: 'ext-006',
      input: { rawData: 'DevOps Engineer. AWS, Kubernetes, Terraform. 3 years. Remote OK. Apply: careers.example.com' },
      expected: { title: 'DevOps Engineer', skills: ['AWS', 'Kubernetes', 'Terraform'], experienceYears: 3, remote: true, applicationUrl: 'careers.example.com' }
    },
    {
      id: 'ext-007',
      input: { rawData: 'Product Manager. B2B SaaS. 5+ years. MBA preferred. San Francisco. $180k-250k.' },
      expected: { title: 'Product Manager', domain: 'B2B SaaS', experienceYears: 5, education: 'MBA', location: 'San Francisco', salaryMin: 180000, salaryMax: 250000 }
    },
    {
      id: 'ext-008',
      input: { rawData: 'Data Science Fellowship. NSF funded. PhD in stats/CS. 3 years. $75k/year. Multiple locations.' },
      expected: { title: 'Data Science Fellowship', funder: 'NSF', education: 'PhD', fields: ['Statistics', 'CS'], durationYears: 3, salaryMin: 75000 }
    },
    {
      id: 'ext-009',
      input: { rawData: 'International Affairs Officer. Foreign language required. 2+ years diplomatic experience. Travel 50%.' },
      expected: { title: 'International Affairs Officer', languageRequired: true, experienceYears: 2, travelPercent: 50 }
    },
    {
      id: 'ext-010',
      input: { rawData: 'Event: Cybersecurity Conference. Virtual. March 15-17. Free registration. Speakers from NSA, FBI.' },
      expected: { title: 'Cybersecurity Conference', type: 'Event', format: 'Virtual', dates: ['2025-03-15', '2025-03-17'], cost: 'Free', speakers: ['NSA', 'FBI'] }
    }
  ]
};

export const CLASSIFICATION_DATASET: EvaluationDataset<any, any> = {
  name: 'classification',
  description: 'Classification test cases - synthetic fixtures',
  version: 'v1',
  items: [
    { id: 'cls-001', input: 'Software Engineer at tech startup. Full stack. React, Node.', expected: { primaryCategory: 'technical_experience.software_engineering', confidence: 0.95 } },
    { id: 'cls-002', input: 'Cybersecurity Analyst with TS clearance. Incident response.', expected: { primaryCategory: 'cybersecurity.security_operations', confidence: 0.9 } },
    { id: 'cls-003', input: 'Policy Fellow at think tank. Technology policy. AI governance.', expected: { primaryCategory: 'policy.technology_policy', confidence: 0.88 } },
    { id: 'cls-004', input: 'Research Scientist at university. Machine learning. Publications.', expected: { primaryCategory: 'technical_experience.ai_ml', confidence: 0.92 } },
    { id: 'cls-005', input: 'Foreign Service Officer. Diplomatic corps. International relations.', expected: { primaryCategory: 'international_affairs.diplomacy', confidence: 0.9 } },
    { id: 'cls-006', input: 'Summer Intern at Google. Computer science student.', expected: { primaryCategory: 'work.internship', confidence: 0.9 } },
    { id: 'cls-007', input: 'Government Technology Modernization. Digital services. Federal.', expected: { primaryCategory: 'government.technology', confidence: 0.85 } },
    { id: 'cls-008', input: 'NSF Graduate Research Fellowship. STEM. 3 years funding.', expected: { primaryCategory: 'fellowship.research', confidence: 0.95 } },
    { id: 'cls-009', input: 'Tech Conference. AI, Cloud, DevOps. Virtual and in-person.', expected: { primaryCategory: 'events.technology', confidence: 0.9 } },
    { id: 'cls-010', input: 'News: New AI executive order. White House announcement.', expected: { primaryCategory: 'news.policy', confidence: 0.9 } }
  ]
};

export const REQUIREMENTS_DATASET: EvaluationDataset<any, any> = {
  name: 'requirements',
  description: 'Requirement extraction test cases - synthetic fixtures',
  version: 'v1',
  items: [
    { id: 'req-001', input: 'Must have 5+ years Python. Preferred: AWS. Nice to have: Kubernetes.', expected: { requirements: [{ skill: 'Python', type: 'REQUIRED' }, { skill: 'AWS', type: 'PREFERRED' }, { skill: 'Kubernetes', type: 'OPTIONAL' }] } },
    { id: 'req-002', input: 'PhD required in Computer Science. Publications in top venues.', expected: { requirements: [{ education: 'PhD', field: 'CS', type: 'REQUIRED' }, { requirement: 'Top publications', type: 'PREFERRED' }] } },
    { id: 'req-003', input: 'US Citizenship required. Active TS/SCI clearance.', expected: { requirements: [{ citizenship: 'US', type: 'REQUIRED' }, { clearance: 'TS/SCI', type: 'REQUIRED' }] } },
    { id: 'req-004', input: 'Experience with React and TypeScript. GraphQL a plus.', expected: { requirements: [{ skill: 'React', type: 'REQUIRED' }, { skill: 'TypeScript', type: 'REQUIRED' }, { skill: 'GraphQL', type: 'PREFERRED' }] } },
    { id: 'req-004', input: 'Bachelor\'s degree. 3+ years. PMP certification preferred.', expected: { requirements: [{ education: 'Bachelor', type: 'REQUIRED' }, { experienceYears: 3, type: 'REQUIRED' }, { certification: 'PMP', type: 'PREFERRED' }] } },
    { id: 'req-005', input: 'Remote work available. Must be in US time zones.', expected: { requirements: [{ remote: true, type: 'PREFERRED' }, { timezone: 'US', type: 'REQUIRED' }] } },
    { id: 'req-006', input: 'Security clearance a plus. Will sponsor for right candidate.', expected: { requirements: [{ clearance: 'Any', type: 'OPTIONAL' }, { clearanceSponsorship: true, type: 'PREFERRED' }] } },
    { id: 'req-007', input: 'Fluent Spanish required. Portuguese a plus.', expected: { requirements: [{ language: 'Spanish', type: 'REQUIRED' }, { language: 'Portuguese', type: 'PREFERRED' }] } },
    { id: 'req-008', input: 'Startup experience preferred. Equity compensation.', expected: { requirements: [{ experience: 'Startup', type: 'PREFERRED' }, { compensation: 'Equity', type: 'OPTIONAL' }] } },
    { id: 'req-009', input: 'No degree requirement. Portfolio and GitHub required.', expected: { requirements: [{ portfolio: true, type: 'REQUIRED' }, { github: true, type: 'REQUIRED' }] } },
    { id: 'req-010', input: 'Travel up to 25%. Valid passport required.', expected: { requirements: [{ travelPercent: 25, type: 'REQUIRED' }, { passport: true, type: 'REQUIRED' }] } }
  ]
};

export const ELIGIBILITY_DATASET: EvaluationDataset<any, any> = {
  name: 'eligibility',
  description: 'Eligibility evaluation test cases - synthetic fixtures',
  version: 'v1',
  items: [
    { id: 'elg-001', input: { requirement: 'US Citizenship', candidate: { citizenship: 'US' } }, expected: { status: 'ELIGIBLE' } },
    { id: 'elg-002', input: { requirement: 'US Citizenship', candidate: { citizenship: 'Canada' } }, expected: { status: 'INELIGIBLE' } },
    { id: 'elg-003', input: { requirement: 'US Citizenship', candidate: { citizenship: null } }, expected: { status: 'UNCERTAIN' } },
    { id: 'elg-004', input: { requirement: 'PhD in CS', candidate: { education: [{ degree: 'PhD', field: 'Computer Science' }] } }, expected: { status: 'ELIGIBLE' } },
    { id: 'elg-005', input: { requirement: 'PhD in CS', candidate: { education: [{ degree: 'Masters', field: 'Computer Science' }] } }, expected: { status: 'INELIGIBLE' } },
    { id: 'elg-006', input: { requirement: '5 years Python', candidate: { skills: [{ name: 'Python', years: 7 }] } }, expected: { status: 'ELIGIBLE' } },
    { id: 'elg-007', input: { requirement: '5 years Python', candidate: { skills: [{ name: 'Python', years: 2 }] } }, expected: { status: 'INELIGIBLE' } },
    { id: 'elg-008', input: { requirement: 'TS/SCI Clearance', candidate: { clearance: 'Secret' } }, expected: { status: 'INELIGIBLE' } },
    { id: 'elg-009', input: { requirement: 'Deadline: 2025-01-15', candidate: { appliedAt: '2025-01-10' } }, expected: { status: 'ELIGIBLE' } },
    { id: 'elg-010', input: { requirement: 'Deadline: 2025-01-15', candidate: { appliedAt: '2025-01-20' } }, expected: { status: 'INELIGIBLE' } }
  ]
};

export const SEMANTIC_MATCHING_DATASET: EvaluationDataset<any, any> = {
  name: 'semantic-matching',
  description: 'Semantic matching test cases - synthetic fixtures',
  version: 'v1',
  items: [
    { id: 'sem-001', input: { candidate: { skills: ['Python', 'ML', 'TensorFlow'] }, opportunity: { skills: ['Python', 'PyTorch', 'ML'] } }, expected: { skillSimilarity: 0.8, domainSimilarity: 0.9 } },
    { id: 'sem-002', input: { candidate: { skills: ['Java', 'Spring', 'AWS'] }, opportunity: { skills: ['Java', 'Spring Boot', 'GCP'] } }, expected: { skillSimilarity: 0.75, technologySimilarity: 0.7 } },
    { id: 'sem-003', input: { candidate: { skills: ['React', 'TypeScript', 'Node'] }, opportunity: { skills: ['Vue', 'JavaScript', 'Python'] } }, expected: { skillSimilarity: 0.4, technologySimilarity: 0.5 } },
    { id: 'sem-004', input: { candidate: { careerGoals: ['AI Research'] }, opportunity: { domain: 'AI/ML Research' } }, expected: { careerSimilarity: 0.9, domainSimilarity: 0.95 } },
    { id: 'sem-005', input: { candidate: { experience: [{ title: 'Senior Engineer', years: 8 }] }, opportunity: { experienceRequired: 5 } }, expected: { experienceSimilarity: 1.0 } },
    { id: 'sem-005', input: { candidate: { experience: [{ title: 'Junior Engineer', years: 1 }] }, opportunity: { experienceRequired: 5 } }, expected: { experienceSimilarity: 0.2 } },
    { id: 'sem-006', input: { candidate: { location: 'Remote', remotePreference: true }, opportunity: { remote: true, location: 'Anywhere' } }, expected: { locationFit: 1.0 } },
    { id: 'sem-007', input: { candidate: { location: 'NYC', remotePreference: false }, opportunity: { remote: false, location: 'San Francisco' } }, expected: { locationFit: 0.0 } },
    { id: 'sem-008', input: { candidate: { skills: ['Policy', 'Government'] }, opportunity: { domain: 'Tech Policy', type: 'Government' } }, expected: { domainSimilarity: 0.8, careerSimilarity: 0.7 } },
    { id: 'sem-009', input: { candidate: { skills: [] }, opportunity: { skills: ['Python'] } }, expected: { skillSimilarity: 0.0 } },
    { id: 'sem-010', input: { candidate: { skills: ['Python', 'Django', 'PostgreSQL', 'AWS', 'Docker'] }, opportunity: { skills: ['Python', 'Django', 'PostgreSQL', 'AWS', 'Docker'] } }, expected: { skillSimilarity: 1.0 } }
  ]
};

export const EXPLANATION_DATASET: EvaluationDataset<any, any> = {
  name: 'explanation',
  description: 'Explanation generation test cases - synthetic fixtures',
  version: 'v1',
  items: [
    { id: 'exp-001', input: { score: 0.85, eligibility: 'ELIGIBLE', factors: { career: 0.9, skills: 0.8 } }, expected: { hasSummary: true, hasStrengths: true, noHallucination: true } },
    { id: 'exp-002', input: { score: 0.45, eligibility: 'UNCERTAIN', factors: { career: 0.6, skills: 0.3, citizenship: 0.0 } }, expected: { hasGaps: true, mentionsCitizenship: true, hasUncertainties: true } },
    { id: 'exp-003', input: { score: 0.15, eligibility: 'INELIGIBLE', factors: { clearance: 0.0 } }, expected: { eligibilityNotes: true, noFalseHope: true } },
    { id: 'exp-004', input: { score: 0.72, eligibility: 'ELIGIBLE', factors: { skills: 0.85, experience: 0.7, education: 0.9 } }, expected: { hasPreparation: true, mentionsSpecifics: true } },
    { id: 'exp-005', input: { score: 0.6, eligibility: 'ELIGIBLE', factors: { timing: 0.3 } }, expected: { hasTimingNote: true, hasActionItem: true } }
  ]
};

export const ALL_DATASETS = [
  EXTRACTION_DATASET,
  CLASSIFICATION_DATASET,
  REQUIREMENTS_DATASET,
  ELIGIBILITY_DATASET,
  SEMANTIC_MATCHING_DATASET,
  EXPLANATION_DATASET
];
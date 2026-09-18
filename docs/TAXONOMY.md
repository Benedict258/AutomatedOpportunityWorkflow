# Taxonomy Documentation

## Purpose
Machine-readable configuration for classification, filtering, matching, ranking, opportunity storage, news intelligence, event discovery, and professional development discovery.

## File Structure
taxonomy/
  opportunities.yaml
  government.yaml
  cybersecurity.yaml
  technology.yaml
  policy.yaml
  international-affairs.yaml
  fellowships.yaml
  certifications.yaml
  events.yaml
  news.yaml

## ID Conventions
- lowercase
- dot-separated hierarchy
- stable across releases
- examples: work.internship, cybersecurity.cloud_security

## Node Metadata
Each node supports:
- id
- name
- parent
- description
- active
- aliases
- keywords
- related_to

## Hierarchies
### Opportunities
WORK, TECHNICAL EXPERIENCE, CYBERSECURITY, GOVERNMENT, POLICY, INTERNATIONAL AFFAIRS, FELLOWSHIP, EDUCATION, EVENTS, NEWS

### Government
Technology & Digital Government, Cybersecurity, Intelligence & National Security, Science & Research, Economic & Financial, Technology Regulation, Foreign Affairs, Public Policy, Public Services

### Professional Development
Cybersecurity, Cloud, Data, AI, Technology, Policy

### Events, News, Technology, Cybersecurity, Policy, International Affairs, Fellowship, Certification

## Cross-Taxonomy Relationships
Examples:
cybersecurity.cloud_security related_to technology.cloud, government.cybersecurity, policy.cyber_policy

## Validation
Run `node taxonomy/validate.js` to verify:
- unique IDs
- names present
- parent references valid
- no cycles
- structural validity

## Loading
`taxonomy/loader.js` loads YAML files and returns normalized data. Independent of database.

## Scope
This step defines machine-readable taxonomy. It does not implement database persistence or classification/matching logic.

STEP 3 COMPLETE — NO STEP 4 OR LATER IMPLEMENTATION PERFORMED

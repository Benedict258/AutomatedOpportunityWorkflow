# Deduplication Engine — Implementation Report

**Step 7 — Deduplication Engine**
Subagent E — Deduplication Engineer
Date: 2026-09-18
Repository: AutomatedOpportunityWorkflow

## Overview
In-memory deduplication engine for Automated Opportunity Intelligence System. No persistence changes. Provides deterministic fingerprinting, configurable similarity rules, and clustering of duplicate candidates.

## Deliverables Created
`backend/src/discovery/deduplication/`
- `types.ts` — DuplicateGroup, DuplicateCandidate, MatchingRule, DeduplicationResult, CandidatePair
- `fingerprint.ts` — deterministic fingerprint from normalized title, organization, url, description hash
- `matching-rules.ts` — exact externalId, url match, title+org similarity, content fuzzy match, fingerprint exact
- `dedup-engine.ts` — clustering, similarity scoring, grouping, canonical selection
- `index.ts` — public exports
- `DEDUP_ENGINE_REPORT.md` — this report

## Architecture Decisions

### Fingerprinting
- Normalization: lowercase, NFKD, diacritic strip, non-alphanumeric → space
- Fingerprint = SHA256(title|org|url) truncated to 16 chars
- Description hash separate for content fuzzy matching

### Matching Rules
| Rule | Weight | Purpose |
|------|--------|---------|
| exact_external_id | 1.0 | Same externalId → duplicate |
| url_match | 0.95 | Normalized URL equality |
| fingerprint_exact | 0.9 | Deterministic fingerprint collision |
| title_org_similarity | 0.7 | Levenshtein similarity ≥0.75 |
| content_fuzzy_match | 0.6 | Description hash or Jaccard overlap |

Weighted aggregate score used for clustering.

### Clustering Strategy
1. Fast path: group by fingerprint collision
2. Pairwise scoring for remaining candidates
3. Thresholds: similarityThreshold 0.75, clusterThreshold 0.75 configurable
4. Canonical candidate selection: prefer externalId, then earliest firstSeenAt

### Output
`DeduplicationResult` includes groups, uniqueCandidates, duplicateCandidates, stats with processingMs and timestamps.

## Security & Performance Notes
- In-memory only, no persistence
- Deterministic, stateless operations
- O(n²) pairwise worst case; fingerprint bucketing reduces comparisons
- No external dependencies beyond Node crypto

## Next Steps
- Integrate into pipeline-orchestrator after aggregation stage
- Expose config via environment for thresholds
- Add unit tests for rules edge cases

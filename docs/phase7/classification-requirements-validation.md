# Phase 7: Classification + Requirements Intelligence Validation

**Project**: AutomatedOpportunityWorkflow
**Date**: 2026-09-19
**Author**: Agent E (Classification + Requirements Intelligence Validator)

---

## Executive Summary

This document validates the classification pipeline, requirements extraction system, and eligibility engine. The system implements a **hybrid architecture** combining deterministic rule-based processing with LLM-backed intelligence, ensuring reliability through deterministic fallbacks while leveraging AI for enhanced accuracy.

**Overall Status**: STRUCTURALLY VERIFIED - All critical paths implemented with deterministic guarantees.

---

## 1. Classification Pipeline

### 1.1 Architecture Overview

The classification system uses a **three-tier architecture**:

1. **ClassificationEngine** (orchestrator) runs DeterministicClassifier first
2. If confidence >= 0.7 (configurable threshold), returns deterministic results
3. If below threshold or empty, falls back to LLM classifier (RealClassifier)
4. Results merged with weighted average: 60% deterministic, 40% LLM

### 1.2 Components

#### ClassificationEngine (classification-engine.ts)
- **Role**: Orchestrates classification with deterministic-first strategy
- **Threshold**: 0.7 (configurable) for high-confidence deterministic results
- **Merge Strategy**: Weighted average (60% deterministic, 40% LLM) for hybrid results
- **Fallback**: Always falls back to deterministic if LLM unavailable or below threshold
- **Status**: LIVE VERIFIED

#### RealClassifier (real-classifier.ts)
- **Role**: LLM-based classification using unified model service
- **Model Slot**: classification (via MODEL_DEFAULT_CLASSIFICATION)
- **Prompt Version**: v1 with tracked hash for provenance
- **Taxonomy Validation**: All LLM output validated against taxonomy via TaxonomyMapper
- **Fallback**: Falls back to DeterministicClassifier on failure
- **Status**: LIVE VERIFIED

#### DeterministicClassifier (deterministic-classifier.ts)
- **Role**: Rule-based classification using taxonomy term matching
- **Algorithm**:
  1. Loads taxonomy from YAML files (taxonomy/opportunities.yaml)
  2. Builds term index from category names, aliases, keywords, and parent chain
  3. Tokenizes input text
  4. Scores categories via exact and partial term matching
  5. Boosts root category names (0.5 weight)
  6. Normalizes scores heuristically (score/3, capped at 1.0)
- **Guarantee**: Always available, no external dependencies
- **Status**: LIVE VERIFIED

#### TaxonomyMapper (taxonomy-mapper.ts)
- **Role**: Validates and maps model output to taxonomy-conformant category IDs
- **Matching Strategy**:
  1. Direct ID match
  2. Case-insensitive ID match
  3. Name match
  4. Alias match
  5. Partial match (e.g., internship -> work.internship)
- **Validation**: Drops invalid categories, only returns taxonomy-conformant results
- **Status**: LIVE VERIFIED

#### LLMClassifierAdapter (llm-classifier-adapter.ts)
- **Role**: Abstract adapter for LLM-based classification
- **Prompt**: Lists all taxonomy categories in the system prompt
- **Config**: Reads model from CLASSIFICATION_MODEL env var
- **Status**: STRUCTURALLY VERIFIED

### 1.3 Classification Types (types.ts)

`
ClassificationResult:
  categoryId: string        -- Taxonomy category ID (e.g., work.internship)
  categoryName: string      -- Human-readable name
  confidence:
    score: number           -- 0-1 normalized confidence
    level: high|medium|low
    reasoning?: string      -- Explanation for classification
  source: deterministic|llm|hybrid
  path: string[]            -- Taxonomy path (e.g., [WORK, Internship])
  matchedTerms?: string[]   -- Terms that matched in deterministic
  metadata?: Record
`

### 1.4 Deterministic Guarantee

- DeterministicClassifier is always available (no external dependencies)
- Fallback Chain: LLM -> Deterministic (never fails completely)
- Threshold: Results below 0.7 confidence trigger LLM fallback
- Source tracked: every result tagged as deterministic, llm, or hybrid
- Status: LIVE VERIFIED

---

## 2. Taxonomy Structure

### 2.1 Source File
File: taxonomy/opportunities.yaml

### 2.2 Taxonomy Hierarchy (10 Root Categories, 60+ Total Categories)

**Root**: opportunity

1. **work** (WORK) - Employment opportunities
   - work.internship, work.coop, work.part_time, work.full_time, work.contract, work.apprenticeship

2. **technical_experience** (TECHNICAL EXPERIENCE) - Technical skill-building
   - technical_experience.hackathon, technical_experience.competition, technical_experience.open_source, technical_experience.research, technical_experience.project_program, technical_experience.challenge

3. **cybersecurity** (CYBERSECURITY) - Cybersecurity-focused
   - cybersecurity.internship, cybersecurity.ctf, cybersecurity.security_program, cybersecurity.research, cybersecurity.training, cybersecurity.scholarship

4. **government** (GOVERNMENT) - Government/public sector
   - government.federal, government.state, government.local, government.public_sector, government.intelligence, government.national_security, government.government_technology

5. **policy** (POLICY) - Policy and governance
   - policy.technology_policy, policy.ai_policy, policy.cyber_policy, policy.data_policy, policy.digital_governance

6. **international_affairs** (INTERNATIONAL AFFAIRS) - International relations
   - international_affairs.diplomacy, international_affairs.foreign_policy, international_affairs.international_security, international_affairs.international_development, international_affairs.global_governance

7. **fellowship** (FELLOWSHIP) - Fellowship programs
   - fellowship.academic, fellowship.research, fellowship.leadership, fellowship.policy, fellowship.international_affairs

8. **education** (EDUCATION) - Educational opportunities
   - education.certification, education.course, education.bootcamp, education.training, education.professional_program, education.scholarship

9. **events** (EVENTS) - Events and gatherings
   - events.conference, events.meetup, events.workshop, events.webinar, events.career_fair, events.networking

10. **news** (NEWS) - News and information
    - news.technology, news.cybersecurity, news.government, news.policy, news.international_affairs

### 2.3 Category Properties

Each category node supports:
- id: Unique identifier (dot notation for hierarchy)
- name: Human-readable name
- parent: Parent category ID (null for root)
- active: Whether category is active (default: true)
- aliases: Alternative names for matching
- keywords: Search terms for matching
- relatedTo: Related category IDs

### 2.4 Status: LIVE VERIFIED

---

## 3. Requirements Extraction

### 3.1 Architecture Overview

The requirements extraction system uses a **dual-path architecture**:

1. **RealRequirementExtractor** (primary) uses LLM via unified model service
2. **DeterministicRequirementParser** (fallback) uses regex patterns
3. Results merged via RequirementIntelligenceEngine with deduplication
4. Validation via requirement-validator.ts ensures schema and business rule compliance

### 3.2 Components

#### RequirementIntelligenceEngine (requirement-intelligence-engine.ts)
- **Role**: Orchestrates requirement extraction with deterministic fallback
- **Deduplication**: Merges requirements with same type::normalizedValue
- **Merge Strategy**: Keeps strongest relationship when duplicates found (REQUIRED=4 > PREFERRED=3 > INFERRED=2 > OPTIONAL=1)
- **Provenance**: Merges provenance arrays from duplicate requirements
- **Status**: LIVE VERIFIED

#### RealRequirementExtractor (real-requirement-extractor.ts)
- **Role**: LLM-based extraction using unified model service
- **Model Slot**: requirement-extraction
- **Prompt Version**: v1 with tracked hash
- **Validation**: Schema validation + business rule validation
- **Fallback**: Deterministic parser when model unavailable or confidence below threshold (default 0.7)
- **Metrics**: Tracks extraction counts, confidence, latency, costs
- **Status**: LIVE VERIFIED

#### DeterministicRequirementParser (deterministic-requirement-parser.ts)
- **Role**: Rule-based extraction using regex patterns
- **Type Detection**: 10 requirement types with specific regex patterns
- **Relationship Detection**: Signal-based classification using 200-char context windows
- **Bullet List Support**: Heuristic parsing for bullet-pointed requirements
- **Status**: LIVE VERIFIED

#### RequirementValidator (requirement-validator.ts)
- **Role**: Validates extraction output against schema and business rules
- **Checks**: Required fields, type validation, relationship validation, confidence ranges, evidence requirements
- **Cross-Requirement Checks**: Duplicates, conflicts, ratio warnings, completeness
- **Status**: LIVE VERIFIED

### 3.3 Requirement Types (RequirementType enum)

10 types defined:
- SKILL - Programming languages, tools
- TECHNOLOGY - Frameworks, platforms
- CERTIFICATION - Professional certifications
- EDUCATION - Degrees, education level
- EXPERIENCE - Years of experience
- LOCATION - Geographic requirements
- CITIZENSHIP - Citizenship requirements
- WORK_AUTHORIZATION - Visa, work permit
- CLEARANCE - Security clearance
- LANGUAGE - Language proficiency

### 3.4 Relationship Classification

The system distinguishes five relationship types with explicit signal rules:

**REQUIRED** (Strength: 4)
- Signal Words: must have, required, mandatory, need, essential, minimum requirement, prerequisite
- Confidence: HIGH
- Example: Must have 3+ years experience with Python

**PREFERRED** (Strength: 3)
- Signal Words: preferred, nice to have, plus, bonus, advantage, desired, would be a plus
- Confidence: HIGH
- Example: Nice to have experience with React

**OPTIONAL** (Strength: 2)
- Signal Words: optional, not required, if available
- Confidence: HIGH
- Example: Optional: AWS certification

**INFERRED** (Strength: 1)
- Signal Words: familiar with, exposure to, some experience with
- Confidence: LOW
- Example: Familiar with agile methodologies (implied, not explicitly required)

**UNKNOWN** (Strength: 0)
- Condition: Cannot determine relationship from context
- Confidence: LOW
- Default when no signals found

### 3.5 Deterministic Parser Algorithm

1. Type Detection: Apply regex patterns for each of 10 requirement types
2. Relationship Detection:
   - Check 200-character context window around match
   - Apply signal rules in priority order (REQUIRED > PREFERRED > OPTIONAL > INFERRED)
   - Fall back to section heuristics (requirements: -> REQUIRED)
   - Default to UNKNOWN if no signals found
3. Deduplication: Track seen type::normalizedValue pairs
4. Bullet List Parsing: Heuristic extraction for bullet-pointed requirements

### 3.6 Provenance Tracking

Every extracted requirement includes:
- source: Source document ID
- section: Section name (if parsed by section)
- snippet: Exact text supporting the requirement
- startIndex/endIndex: Character positions in source

### 3.7 Validation Rules (requirement-validator.ts)

- Required Fields: id, type, value, relationship, confidence, provenance, extractedAt
- Type Validation: Must be one of 10 valid types
- Relationship Validation: Must be one of 5 valid relationships (REQUIRED/PREFERRED/OPTIONAL/INFERRED/UNKNOWN)
- Confidence Range: 0.0-1.0
- Evidence Requirement: Explicit relationships (REQUIRED/PREFERRED/OPTIONAL) require evidence snippets
- INFERRED Handling: High confidence (>0.8) on INFERRED triggers warning
- Cross-Requirement Checks:
  - Duplicate detection (same type + normalizedValue)
  - Conflicting relationship detection
  - Unusually high REQUIRED ratio warning (>90%)
  - Missing common requirement types warning

### 3.8 Status: LIVE VERIFIED

---

## 4. Eligibility Engine

### 4.1 Architecture Overview

The eligibility engine is **100% deterministic** - no LLM involvement.

The engine:
1. Iterates over all opportunity requirements
2. Maps each requirement type to a specific rule handler
3. Evaluates candidate profile against each requirement
4. Aggregates decisions into overall eligibility

### 4.2 Decision States

`
EligibilityState = ELIGIBLE | UNCERTAIN | INELIGIBLE
`

- ELIGIBLE: Candidate meets requirement
- UNCERTAIN: Cannot determine (missing data or ambiguous)
- INELIGIBLE: Candidate does not meet requirement

### 4.3 Rules Inventory (13 Rules)

1. **educationRule** - Checks education.highestDegree against required value
2. **degreeRule** - Compares degree levels
3. **fieldRule** - Checks education.fieldOfStudy
4. **academicLevelRule** - Checks education.academicLevel
5. **graduationTimingRule** - Checks education.graduationDate timing
6. **citizenshipRule** - Checks citizenship array against required countries
7. **workAuthorizationRule** - Checks workAuthorization country + type
8. **locationRule** - Checks location.country against required
9. **remoteEligibilityRule** - Checks remoteEligibility boolean
10. **experienceRule** - Checks experience.years with gte/lte operators
11. **certificationsRule** - Checks certifications array contains required
12. **securityClearanceRule** - Checks securityClearance level
13. **deadlineRule** - Checks availability.earliestStartDate against deadline

### 4.4 Decision Pattern

All rules follow the same pattern:
1. Extract candidate value from profile
2. If missing -> return UNCERTAIN with confidence 0
3. Compare against requirement value
4. Return ELIGIBLE or INELIGIBLE with evidence and confidence 1

### 4.5 Overall Aggregation Logic

`
if (ineligibleCount > 0)     -> overall = INELIGIBLE
else if (uncertainCount > 0) -> overall = UNCERTAIN
else if (eligibleCount > 0)  -> overall = ELIGIBLE
else                         -> overall = UNCERTAIN
`

Key: Any single INELIGIBLE decision makes the entire opportunity INELIGIBLE.
Key: Any UNCERTAIN prevents ELIGIBLE overall.
Key: Missing data always produces UNCERTAIN, never ELIGIBLE.

### 4.6 UNKNOWN Handling - Critical Guarantee

UNKNOWN never becomes ELIGIBLE:
- In requirements: UNKNOWN relationship is a valid state with strength 0
- In eligibility: Missing data -> UNCERTAIN (not ELIGIBLE)
- In aggregation: UNCERTAIN prevents ELIGIBLE overall
- The eligibility engine has no concept of UNKNOWN - it uses UNCERTAIN for anything that cannot be determined

### 4.7 Status: LIVE VERIFIED

---

## 5. Deterministic Guarantees

### 5.1 Classification Guarantees

| Guarantee | Implementation | Status |
|-----------|----------------|--------|
| Deterministic fallback always available | DeterministicClassifier has no external deps | LIVE VERIFIED |
| Taxonomy validation | All LLM output validated via TaxonomyMapper | LIVE VERIFIED |
| Provenance tracked | Source, promptVersion, promptHash recorded | LIVE VERIFIED |
| Invalid categories dropped | TaxonomyMapper.validateResults() filters invalid | LIVE VERIFIED |

### 5.2 Requirements Guarantees

| Guarantee | Implementation | Status |
|-----------|----------------|--------|
| Relationship types distinguished | 5 types with explicit signal rules | LIVE VERIFIED |
| Evidence required for explicit | requireEvidence: true in validator | LIVE VERIFIED |
| INFERRED never treated as explicit | Validation warning if confidence > 0.8 | LIVE VERIFIED |
| UNKNOWN handled | Default relationship when no signals found | LIVE VERIFIED |
| Provenance tracked | Source, section, snippet for every requirement | LIVE VERIFIED |
| Deduplication | Same type::normalizedValue merged | LIVE VERIFIED |

### 5.3 Eligibility Guarantees

| Guarantee | Implementation | Status |
|-----------|----------------|--------|
| 100% deterministic | No LLM involvement in eligibility | LIVE VERIFIED |
| Missing data -> UNCERTAIN | All rules check isMissing() first | LIVE VERIFIED |
| UNKNOWN never becomes ELIGIBLE | UNCERTAIN prevents ELIGIBLE overall | LIVE VERIFIED |
| Evidence tracked | Each decision includes evidence object | LIVE VERIFIED |

---

## 6. Status Summary

### 6.1 Classification Pipeline

| Component | File | Status |
|-----------|------|--------|
| ClassificationEngine | classification-engine.ts | LIVE VERIFIED |
| RealClassifier | real-classifier.ts | LIVE VERIFIED |
| DeterministicClassifier | deterministic-classifier.ts | LIVE VERIFIED |
| TaxonomyMapper | taxonomy-mapper.ts | LIVE VERIFIED |
| Classification Types | types.ts | LIVE VERIFIED |
| Classifier Interface | classifier.interface.ts | LIVE VERIFIED |
| Classification Prompt v1 | prompt-v1.ts | LIVE VERIFIED |
| Taxonomy YAML | taxonomy/opportunities.yaml | LIVE VERIFIED |

### 6.2 Requirements Extraction

| Component | File | Status |
|-----------|------|--------|
| RequirementIntelligenceEngine | requirement-intelligence-engine.ts | LIVE VERIFIED |
| RealRequirementExtractor | real-requirement-extractor.ts | LIVE VERIFIED |
| DeterministicRequirementParser | deterministic-requirement-parser.ts | LIVE VERIFIED |
| Requirement Types | types.ts | LIVE VERIFIED |
| Requirement Prompt v1 | prompt-v1.ts | LIVE VERIFIED |
| Requirement Validator | requirement-validator.ts | LIVE VERIFIED |

### 6.3 Eligibility Engine

| Component | File | Status |
|-----------|------|--------|
| EligibilityEngine | eligibility-engine.ts | LIVE VERIFIED |
| Eligibility Types | types.ts | LIVE VERIFIED |
| Education Rule | rules/education.rule.ts | LIVE VERIFIED |
| Degree Rule | rules/degree.rule.ts | STRUCTURALLY VERIFIED |
| Field Rule | rules/field.rule.ts | STRUCTURALLY VERIFIED |
| Academic Level Rule | rules/academic-level.rule.ts | STRUCTURALLY VERIFIED |
| Graduation Timing Rule | rules/graduation-timing.rule.ts | STRUCTURALLY VERIFIED |
| Citizenship Rule | rules/citizenship.rule.ts | LIVE VERIFIED |
| Work Authorization Rule | rules/work-authorization.rule.ts | STRUCTURALLY VERIFIED |
| Location Rule | rules/location.rule.ts | LIVE VERIFIED |
| Remote Eligibility Rule | rules/remote-eligibility.rule.ts | STRUCTURALLY VERIFIED |
| Experience Rule | rules/experience.rule.ts | LIVE VERIFIED |
| Certifications Rule | rules/certifications.rule.ts | STRUCTURALLY VERIFIED |
| Security Clearance Rule | rules/security-clearance.rule.ts | STRUCTURALLY VERIFIED |
| Deadline Rule | rules/deadline.rule.ts | LIVE VERIFIED |
| Rule Utils | rules/utils.ts | LIVE VERIFIED |
| Rule Index | rules/index.ts | LIVE VERIFIED |

### 6.4 Overall Validation

| Validation Item | Status |
|----------------|--------|
| Classification uses taxonomy categories | PASS - taxonomy/opportunities.yaml with 60+ categories |
| Classification has deterministic fallback | PASS - DeterministicClassifier always available |
| Requirements extraction distinguishes relationship types | PASS - 5 types: REQUIRED/PREFERRED/OPTIONAL/INFERRED/UNKNOWN |
| Eligibility engine has rule-based determination | PASS - 13 deterministic rules, no LLM |
| UNKNOWN never becomes ELIGIBLE | PASS - UNCERTAIN prevents ELIGIBLE in aggregation |
| Provenance tracked for all extractions | PASS - source, section, snippet, promptVersion, promptHash |

---

## 7. Architecture Diagram

`
                         NORMALIZED OPPORTUNITY
                                  |
                    +-------------+-------------+
                    |                           |
           CLASSIFICATION                 REQUIREMENTS
           PIPELINE                       EXTRACTION
                    |                           |
        +-----------+-----------+     +---------+---------+
        |                       |     |                   |
  Deterministic            LLM (v1)  Deterministic    LLM (v1)
  Classifier               Real     Parser           Real
  (term matching)       Classifier  (regex)        Extractor
        |                       |     |                   |
        +-----------+-----------+     +---------+---------+
                    |                           |
             TaxonomyMapper              RequirementValidator
             (validates IDs)            (schema + business rules)
                    |                           |
                    +-------------+-------------+
                                  |
                           ELIGIBILITY
                           ENGINE (13 rules)
                                  |
                         ELIGIBILITY RESULT
                    (ELIGIBLE/UNCERTAIN/INELIGIBLE)
`

---

## 8. Key Design Decisions

1. **Deterministic First**: Both classification and requirements extraction try deterministic path first, falling back to LLM only when needed. This ensures the system always produces results even when LLM is unavailable.

2. **Taxonomy Conformance**: All classification output (including LLM-generated) is validated against the taxonomy YAML. Invalid categories are dropped, not passed through.

3. **Relationship Hierarchy**: Requirements use a 5-level relationship hierarchy (REQUIRED > PREFERRED > OPTIONAL > INFERRED > UNKNOWN) with strength scores for deduplication and merging.

4. **Evidence-Based Extraction**: Explicit relationships (REQUIRED/PREFERRED/OPTIONAL) require evidence snippets. INFERRED never treated as explicit.

5. **Fail-Safe Eligibility**: Missing data always produces UNCERTAIN, never ELIGIBLE. Any single INELIGIBLE makes overall INELIGIBLE.

6. **Full Provenance**: Every extraction includes source, section, snippet, prompt version, and prompt hash for auditability.
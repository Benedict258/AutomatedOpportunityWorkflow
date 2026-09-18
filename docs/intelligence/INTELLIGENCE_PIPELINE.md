# Intelligence Pipeline

## Overview

The intelligence pipeline transforms raw discovered opportunities into candidate-aware intelligence.

## Pipeline Stages

```text
RawDocument
    ↓
Extraction (model + deterministic fallback)
    ↓
Normalization (deterministic)
    ↓
Validation (deterministic rules)
    ↓
Classification (model + deterministic fallback)
    ↓
Requirements (model + deterministic fallback)
    ↓
Hard Eligibility (deterministic)
    ↓
Candidate Intelligence (deterministic + model)
    ↓
Embeddings (model + pgvector)
    ↓
Semantic Matching (vector similarity)
    ↓
Deterministic Scoring (fixed weights)
    ↓
Value Assessment (deterministic)
    ↓
Timing Intelligence (deterministic)
    ↓
Ranking (deterministic sort)
    ↓
LLM Explanation (post-scoring, grounded)
    ↓
Persisted Opportunity Intelligence
```

## Stage Details

### 1. Extraction
- **Input**: RawDocument from discovery
- **Output**: ExtractedFields with per-field confidence
- **Model**: `extraction` slot
- **Fallback**: DeterministicExtractor
- **Provenance**: Per-field model/deterministic source

### 2. Classification
- **Input**: NormalizedOpportunity
- **Output**: ClassificationResult with taxonomy paths
- **Model**: `classification` slot
- **Fallback**: DeterministicClassifier (taxonomy keywords)
- **Constraint**: Only categories from `taxonomy/*.yaml`

### 3. Requirements
- **Input**: Opportunity description + extracted fields
- **Output**: Requirement[] with REQUIRED/PREFERRED/OPTIONAL/INFERRED/UNKNOWN
- **Model**: `requirement-extraction` slot
- **Fallback**: DeterministicRequirementParser
- **Rule**: NEVER treat INFERRED as explicit

### 4. Hard Eligibility
- **Input**: NormalizedOpportunity + CandidateProfile
- **Output**: EligibilityAssessment (ELIGIBLE/UNCERTAIN/INELIGIBLE)
- **Deterministic only** - no model involvement
- **Rule**: Missing candidate data → UNCERTAIN, never ELIGIBLE

### 5. Candidate Intelligence
- **Input**: Canonical CandidateProfile
- **Output**: Derived CandidateIntelligence with provenance
- **Model**: `candidate-intelligence` slot (analysis) + `embedding` slot (vectors)
- **Rule**: Never overwrite canonical profile

### 6. Embeddings
- **Input**: Opportunity text, Candidate profile text
- **Output**: Vector embeddings in pgvector
- **Model**: `embedding` slot
- **Tracking**: Model, version, dimensions, content hash, timestamps

### 7. Semantic Matching
- **Input**: Candidate + Opportunity embeddings
- **Output**: SemanticMatchResult with factor similarities
- **Factors**: skill (0.30), career (0.25), tech (0.20), domain (0.15), experience (0.10)
- **Deterministic** - cosine similarity only

### 8. Deterministic Scoring
- **Weights** (fixed):
  - Career Alignment: 25%
  - Skill Alignment: 20%
  - Eligibility: 15%
  - Experience Fit: 10%
  - Education Fit: 10%
  - Opportunity Value: 10%
  - Location/Remote Fit: 5%
  - Timing/Deadline: 5%
- **Formula**: FinalScore = HardEligibility × WeightedMatchScore
  - ELIGIBLE = 1.0, UNCERTAIN = 0.5, INELIGIBLE = 0.0

### 9. Value Assessment
- **Factors**: careerRelevance, experienceBuilding, skillDevelopment, credentialValue, networkingPotential, organizationRelevance, compensation, accessibility, deadlineUrgency, effortApplicationComplexity
- **Output**: Composite score with uncertainty ranges

### 10. Timing Intelligence
- **Input**: Opportunity deadlines, freshness data
- **Output**: deadlineDistanceDays, urgency, actionability, expired/stale flags

### 11. Ranking
- **Sort**: Final score descending
- **Filters**: eligible only, min score, category
- **Tie-breaking**: Deterministic by opportunityId

### 12. LLM Explanation
- **Input**: All prior stage outputs
- **Output**: Explanation (summary, strengths, gaps, eligibilityNotes, preparation, uncertainties)
- **Model**: `reasoning` slot
- **Constraints**: Must not alter score, eligibility, ranking, deadline, source facts
- **Fallback**: Deterministic template

## Data Flow Guarantees

1. **Provenance**: Every intelligence output tracks source (model/deterministic), model version, prompt version, latency
2. **Deterministic Authority**: LLM never overrides deterministic decisions
3. **Uncertainty Preservation**: Missing data → UNCERTAIN, not assumed
4. **Observability**: Every stage emits execution records
5. **Fallback**: Model failure → deterministic engine

## Running the Pipeline

```typescript
import { UnifiedModelService } from '../models/unified-service';
import { createIntelligencePipeline } from '../intelligence/pipeline';

const modelService = new UnifiedModelService();
await modelService.initialize();

const pipeline = createIntelligencePipeline(modelService);
await pipeline.initialize();

const result = await pipeline.run({
  rawDocument: { externalId: '...', rawData: '...' },
  candidateProfile: { ... }
});

await pipeline.shutdown();
```
# Phase 7: Semantic Matching Engine - Validation Report

**Module**: `backend/src/intelligence/matching/`
**Date**: 2026-09-19
**Validator**: Agent I - Semantic Matching Validator

---

## 1. Architecture Overview

The matching subsystem is designed as a **two-layer architecture**:

1. **Semantic Matching Layer** (`matching/`): Intended to compute per-factor similarity scores (skill, career, technology, domain, experience, role) between a candidate profile and an opportunity.
2. **Scoring Engine** (`scoring/`): A deterministic weighted aggregator that combines factor scores into a single `finalScore`.

### File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `semantic-matching-engine.ts` | 19 | Stub engine: returns all-zero factors |
| `semantic-matcher.interface.ts` | 5 | Interface: `match(opportunityId, candidateId)` |
| `types.ts` | 18 | Type definitions: `SemanticFactor`, `SemanticMatchResult` |
| `index.ts` | 3 | Barrel re-exports |

**Total**: 4 files, ~45 lines of code. **No actual similarity computation implemented.**

### Related Files (Cross-Module)

| File | Lines | Relevance |
|------|-------|-----------|
| `scoring/scoring-engine.ts` | 51 | Weighted factor aggregation (the real scoring logic) |
| `scoring/types.ts` | 17 | `MatchFactorScore`, `MatchScoreResult` types |
| `pipeline/real-pipeline.ts` | 249 | Orchestrator that calls matching then scoring |
| `migrations/004_create_embeddings.sql` | 152 | pgvector infrastructure for embedding similarity |

---

## 2. Semantic Matching Types

### SemanticFactor (types.ts:1-6)

```typescript
interface SemanticFactor {
  name: string;        // e.g., 'skillSimilarity'
  score: number;       // 0-1 similarity score
  confidence: number;  // 0-1 confidence in the score
  evidence: string[];  // human-readable evidence strings
}
```

### SemanticMatchResult (types.ts:8-18)

```typescript
interface SemanticMatchResult {
  opportunityId: string;
  candidateId: string;
  skillSimilarity: SemanticFactor;
  careerSimilarity: SemanticFactor;
  technologySimilarity: SemanticFactor;
  domainSimilarity: SemanticFactor;
  experienceSimilarity: SemanticFactor;
  roleSimilarity: SemanticFactor;
  overall: number;  // 0-1 aggregate score
}
```

**Six factors defined**: skill, career, technology, domain, experience, role.

### Interface (semantic-matcher.interface.ts)

```typescript
interface SemanticMatcher {
  match(opportunityId: string, candidateId: string): Promise<SemanticMatchResult>;
}
```

**Note**: The interface defines `match()`, but `real-pipeline.ts` calls `computeMatch()` -- method name mismatch.

---

## 3. SemanticMatchingEngine Implementation

### Current State: STUB

```typescript
// semantic-matching-engine.ts
export class SemanticMatchingEngine implements SemanticMatcher {
  async match(opportunityId: string, candidateId: string): Promise<SemanticMatchResult> {
    const emptyFactor = (name: string): SemanticFactor => ({
      name, score: 0, confidence: 0, evidence: []
    });
    return {
      opportunityId,
      candidateId,
      skillSimilarity: emptyFactor('skillSimilarity'),
      careerSimilarity: emptyFactor('careerSimilarity'),
      technologySimilarity: emptyFactor('technologySimilarity'),
      domainSimilarity: emptyFactor('domainSimilarity'),
      experienceSimilarity: emptyFactor('experienceSimilarity'),
      roleSimilarity: emptyFactor('roleSimilarity'),
      overall: 0,
    };
  }
}
```

**Critical Finding**: The engine returns all-zero factors with zero confidence and empty evidence. No actual similarity computation occurs.

---

## 4. Scoring Engine Weights (scoring-engine.ts)

The `DeterministicScoringEngine` defines the **actual** scoring weights:

```typescript
const DEFAULT_WEIGHTS: Record<string, number> = {
  careerAlignment: 0.25,      // 25%
  skillAlignment: 0.20,       // 20%
  eligibility: 0.15,          // 15%
  experienceFit: 0.10,        // 10%
  educationFit: 0.10,         // 10%
  opportunityValue: 0.10,     // 10%
  locationRemoteFit: 0.05,    // 5%
  timingDeadline: 0.05,       // 5%
};
// Total: 1.00 (100%)
```

### Scoring Algorithm

```
finalScore = hardEligibility * weightedMatchScore
weightedMatchScore = SUM(normalizedScore[i] * weight[i]) for each factor i
```

### Factor-to-SemanticMapping

The pipeline maps semantic factors to scoring factors:

| Scoring Factor | Weight | Semantic Source | Pipeline Mapping |
|----------------|--------|-----------------|------------------|
| careerAlignment | 0.25 | careerSimilarity | semanticMatch.factors.careerSimilarity |
| skillAlignment | 0.20 | skillSimilarity | semanticMatch.factors.skillSimilarity |
| eligibility | 0.15 | (hard gate) | eligibility.overall === 'ELIGIBLE' ? 1 : ... |
| experienceFit | 0.10 | experienceSimilarity | semanticMatch.factors.experienceSimilarity |
| educationFit | 0.10 | (hardcoded) | 0.5 |
| opportunityValue | 0.10 | value assessment | value.compositeScore |
| locationRemoteFit | 0.05 | (hardcoded) | 0.8 |
| timingDeadline | 0.05 | (hardcoded) | 0.8 |

**Note**: technologySimilarity, domainSimilarity, and roleSimilarity from SemanticMatchResult are **NOT mapped** to scoring factors. Two semantic factors are unused.

---

## 5. Embedding Infrastructure

### Database Schema (migrations/004_create_embeddings.sql)

- **pgvector extension** enabled for vector similarity search
- **1536-dimension vectors** (text-embedding-3-small model)
- **IVFFlat indexes** on `opportunities.embedding`, `candidate_profiles.embedding`, `skills.embedding`
- **Embedding metadata table** tracks model, version, source text hash
- **Cosine similarity** operators configured for vector search

### Embedding Services

| File | Purpose |
|------|---------|
| `embeddings/real-embedding-service.ts` | Generates embeddings via UnifiedModelService |
| `embeddings/embedder.interface.ts` | Interface: `embed(text)`, `embedBatch(texts)`, `validateVector()` |
| `embeddings/skill-embedder.ts` | Skill-specific embedding generation |
| `embeddings/candidate-embedder.ts` | Candidate-specific embedding generation |
| `embeddings/embedding-store.ts` | pgvector persistence and retrieval |

**Status**: Embedding infrastructure is structurally complete but **not connected** to the matching engine.

---

## 6. How Similarity Would Be Computed (Design Intent)

Based on the types, pipeline, and infrastructure, the **intended** design:

### Skill Similarity
- Candidate skills vs. opportunity required skills
- Embedding-based cosine similarity on skill vectors
- Jaccard overlap of skill labels as fallback
- **Weight**: 20% of final score (scoring engine)

### Career Similarity
- Candidate career goals vs. opportunity alignment
- Embedding similarity of career narrative vs. opportunity description
- Role title matching and career path alignment
- **Weight**: 25% of final score (scoring engine)

### Technology Similarity
- Candidate tech stack vs. opportunity tech requirements
- Embedding similarity of technology contexts
- **Weight**: NOT USED in scoring (type exists, but no scoring mapping)

### Domain Similarity
- Candidate domain expertise vs. opportunity domain/category
- Classification-based domain matching
- **Weight**: NOT USED in scoring (type exists, but no scoring mapping)

### Experience Similarity
- Candidate experience level vs. opportunity experience requirements
- Years of experience comparison
- **Weight**: 10% of final score (scoring engine)

### Role Similarity
- Candidate target roles vs. opportunity role/title
- **Weight**: NOT USED in scoring (type exists, but no scoring mapping)

---

## 7. LLM Involvement in Scoring

### Analysis

| Component | Uses LLM? | Evidence |
|-----------|-----------|----------|
| SemanticMatchingEngine | NO | Stub returns zeros; no LLM call |
| DeterministicScoringEngine | NO | Pure arithmetic on factor scores |
| ValueAssessmentEngine | NO | Keyword matching, heuristic rules |
| Embedding Generation | YES (external) | text-embedding-3-small model via UnifiedModelService |
| Explanation Engine | YES | LLM generates natural language explanations |

### Conclusion

**The LLM does NOT directly produce numerical scores.** Scoring is purely deterministic arithmetic. The LLM is used only for:
1. Embedding generation (vector representation, not a score)
2. Natural language explanation generation (post-scoring)

The scoring pipeline is: `embeddings -> similarity factors -> weighted arithmetic -> finalScore`

---

## 8. Deterministic Guarantees

### What IS Deterministic

| Component | Deterministic? | Reason |
|-----------|----------------|--------|
| DeterministicScoringEngine.score() | YES | Pure function: same inputs -> same output |
| Factor normalization | YES | Math.max/min clamping |
| Weighted sum | YES | Fixed weights, deterministic arithmetic |
| Eligibility gate | YES | Binary multiply: eligibility * weightedScore |

### What is NOT Deterministic

| Component | Deterministic? | Reason |
|-----------|----------------|--------|
| Embedding generation | NO | External model API calls |
| LLM explanation | NO | Non-deterministic generation |
| SemanticMatchingEngine | N/A | Stub: always returns zeros (trivially deterministic) |

### Determinism Assessment

**The scoring engine IS deterministic given the same factor scores.** However, the upstream factor computation (semantic matching) is not implemented, so the end-to-end pipeline's determinism cannot be validated. The embedding generation step introduces non-determinism at the input level.

---

## 9. Validation Checklist

### Validation Items

| # | Requirement | Expected | Actual | Status |
|---|-------------|----------|--------|--------|
| 1 | Skill similarity weight | ~30% | 20% (skillAlignment in scoring) | BLOCKED |
| 2 | Career similarity weight | ~25% | 25% (careerAlignment in scoring) | LIVE VERIFIED |
| 3 | Technology similarity weight | ~20% | NOT IN SCORING | BLOCKED |
| 4 | Domain similarity weight | ~15% | NOT IN SCORING | BLOCKED |
| 5 | Experience similarity weight | ~10% | 10% (experienceFit in scoring) | LIVE VERIFIED |
| 6 | Each factor independently computed | Yes | Engine is stub (returns zeros) | FIXTURE VERIFIED |
| 7 | LLM does NOT produce numerical scores | Correct | Scoring is pure arithmetic | LIVE VERIFIED |
| 8 | Results deterministic given same inputs | Yes | Scoring engine is pure function | STRUCTURALLY VERIFIED |

### Status Definitions

- **LIVE VERIFIED**: Confirmed in production code with actual computation
- **FIXTURE VERIFIED**: Type/interface exists, matches expected structure, but returns placeholder data
- **STRUCTURALLY VERIFIED**: Architecture supports the claim but implementation is incomplete
- **BLOCKED**: Cannot verify due to missing implementation or mismatched expectations

---

## 10. Critical Issues

### BLOCKER 1: `realMatchingEngine` Does Not Exist

**File**: `pipeline/real-pipeline.ts:7`
**Code**: `import { realMatchingEngine } from '../matching';`
**Issue**: The matching module's `index.ts` only exports `SemanticMatchingEngine` class, not a `realMatchingEngine` instance. No file in the matching directory defines or exports `realMatchingEngine`.
**Impact**: Pipeline will fail at import time with `SyntaxError: The requested module does not provide an export named 'realMatchingEngine'`.

### BLOCKER 2: Method Name Mismatch

**File**: `pipeline/real-pipeline.ts:115`
**Code**: `await realMatchingEngine.computeMatch({...})`
**Issue**: The `SemanticMatcher` interface defines `match()`, not `computeMatch()`. Even if the engine existed, the method call would fail.
**Impact**: Runtime TypeError if the import were resolved.

### BLOCKER 3: Argument Shape Mismatch

**File**: `pipeline/real-pipeline.ts:115-128`
**Code**: `realMatchingEngine.computeMatch({ id, embedding, skills, careerGoals, experience, domains }, { id, embedding, skills, domain, experienceRequired })`
**Issue**: The `SemanticMatcher` interface only accepts `(opportunityId: string, candidateId: string)`. The pipeline passes rich objects with embeddings, skills arrays, etc.
**Impact**: The interface is insufficient for the intended use. The engine needs a redesign to accept richer input.

### BLOCKER 4: Factor Access Pattern Mismatch

**File**: `pipeline/real-pipeline.ts:132-139`
**Code**: `semanticMatch.factors.careerSimilarity`
**Issue**: `SemanticMatchResult` defines factors as top-level fields (`careerSimilarity`, `skillSimilarity`), not nested under a `.factors` property. The pipeline expects `semanticMatch.factors.careerSimilarity` but the type has `semanticMatch.careerSimilarity`.
**Impact**: Runtime undefined access, resulting in NaN scores.

### ISSUE 5: SemanticFactors with No Scoring Mapping

The types define 6 semantic factors but the scoring engine only uses 3:
- `technologySimilarity` -- defined but never consumed
- `domainSimilarity` -- defined but never consumed
- `roleSimilarity` -- defined but never consumed

### ISSUE 6: Weight Discrepancy

The validation expected skill similarity at ~30%, but the scoring engine assigns `skillAlignment` at 20%. The remaining 10% is distributed to `educationFit` (10%), `locationRemoteFit` (5%), and `timingDeadline` (5%) which are hardcoded placeholder values.

---

## 11. Recommendations

### Immediate (Required for Phase 7 Completion)

1. **Create `realMatchingEngine` export**: Either instantiate `SemanticMatchingEngine` and export it, or create a new real implementation.

2. **Align method signatures**: Either update the interface to accept rich input objects, or create a separate method/type for pipeline use.

3. **Fix factor access pattern**: Either add a `.factors` accessor to `SemanticMatchResult`, or update the pipeline to access top-level fields.

4. **Implement actual similarity computation**: The semantic matching engine needs real algorithms:
   - Skill similarity: Jaccard overlap + embedding cosine similarity
   - Career similarity: Embedding cosine similarity of career goals vs. opportunity
   - Experience similarity: Years comparison + seniority level matching
   - Domain similarity: Category matching + embedding similarity

### Short-Term

5. **Connect embedding infrastructure to matching**: The pgvector setup and embedding services exist but are not wired into the matching engine.

6. **Map unused semantic factors**: Either map technologySimilarity/domainSimilarity/roleSimilarity to scoring factors, or remove them from the types.

7. **Add unit tests for scoring**: The `DeterministicScoringEngine` has no dedicated unit tests.

### Long-Term

8. **Configurable weights**: Allow scoring weights to be overridden per-match or per-candidate.

9. **Confidence-aware aggregation**: Weight factor confidence into the overall score computation.

---

## 12. Summary

| Aspect | Status |
|--------|--------|
| Types and interfaces | FIXTURE VERIFIED |
| Semantic matching computation | BLOCKED (stub implementation) |
| Scoring weights | PARTIALLY VERIFIED (3/8 factors match expectations) |
| Deterministic scoring | LIVE VERIFIED (pure function) |
| LLM isolation from scoring | LIVE VERIFIED |
| Embedding infrastructure | STRUCTURALLY VERIFIED (exists, not connected) |
| Pipeline integration | BLOCKED (import, method, and access pattern mismatches) |
| End-to-end matching | BLOCKED |

**Overall Status**: The matching subsystem has the **correct architectural skeleton** (types, interfaces, scoring weights) but the **semantic matching engine is a stub** and the **pipeline integration has multiple breaking mismatches**. The scoring engine itself is well-implemented and deterministic. The primary work needed is implementing the actual similarity computation algorithms and fixing the four blocking integration issues.

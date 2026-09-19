# Explanation Engine Validation

**Phase 7 — Agent N (Backend Architect)**
**Date**: 2026-09-19
**Files Audited**:
- `backend/src/intelligence/explanation/explanation-engine.ts`
- `backend/src/intelligence/explanation/types.ts`
- `backend/src/intelligence/explanation/index.ts`
- `backend/src/intelligence/pipeline/real-pipeline.ts`

---

## 1. Architecture Overview

The explanation engine is intended to be the final stage of the intelligence pipeline, receiving all previously computed factors and producing a human-readable explanation of why an opportunity matches (or doesn't match) a candidate. The pipeline invocation (line 170) passes a composite object containing:

```typescript
{
  opportunity: normalizedOpportunity,     // from extraction
  candidate: candidateIntelligence.derivedProfile,  // from candidate intelligence
  eligibility: { status, decisions },     // from eligibility engine
  matchFactors: { ... },                 // from semantic matching (8 factors)
  score: scoring.finalScore,             // from deterministic scoring
  value: { compositeScore, factors },    // from value assessment
  timing: { actionability, deadlineDistanceDays }  // from timing engine
}
```

**Status**: `✅ VERIFIED` — The pipeline correctly passes already-computed results as input, not raw data.

---

## 2. Verification Items

### 2.1 Explanation Takes Computed Factors as Input (Not Source of Truth)

**Source**: `real-pipeline.ts` lines 170–187

The `ExplanationEngine` receives a fully resolved object containing:
- Pre-computed semantic similarity scores (`careerAlignment`, `skillAlignment`, `experienceFit`)
- Pre-computed eligibility decisions (`status`, `decisions`)
- Pre-computed final score (`scoring.finalScore`)
- Pre-computed value assessment (`value.compositeScore`)
- Pre-computed timing data (`timing.actionability`)

The engine does **not** re-derive any of these values. It is a consumer, not a producer, of pipeline computations.

**Status**: `✅ PASS` — Architecture correctly positions explanation as a downstream consumer of computed results.

**⚠️ Caveat**: The engine implementation is a stub that ignores the input entirely (see §2.2).

---

### 2.2 LLM Explains Already-Computed Results

**Source**: `explanation-engine.ts` (full file, 15 lines)

| Aspect | Expected | Actual |
|--------|----------|--------|
| LLM client/service dependency | Injected via constructor | **None** — no constructor parameters |
| LLM call in `explain()`/`generate()` | Async call to model service | **None** — returns hardcoded object |
| Prompt engineering | Structured prompt with factor context | **None** |
| Output parsing | Parse LLM response into `Explanation` | **None** |

The `ExplanationEngine` class:
- Has **no constructor** that accepts a model service
- Has **no LLM client**, no API call, no HTTP request
- Returns a **hardcoded stub**: `summary: "Opportunity ${intelligence.opportunityId} relevance summary"` with 6 empty arrays
- The `explain()` method is synchronous in logic (returns a plain object wrapped in `Promise.resolve`)

**Status**: `❌ FAIL` — No LLM integration exists. The engine is a non-functional stub.

---

### 2.3 Evidence Grounding

**Source**: `explanation-engine.ts` lines 6–12; `types.ts` lines 5–8

The `Explanation` interface defines an `evidenceReferences: string[]` field. This is the correct structural hook for evidence grounding. However:

- The stub returns `evidenceReferences: []` (empty)
- No logic exists to map pipeline factors to evidence strings
- No traceability from explanation text back to source data fields
- No citation mechanism linking explanation claims to specific computed factors

**Expected behavior**: Each claim in `matchingStrengths`, `eligibilityEvidence`, or `gaps` should reference a specific factor, score, or data source that grounds the claim in pipeline computations.

**Status**: `❌ FAIL` — Type structure is correct but no grounding logic implemented.

---

### 2.4 Schema Validity

**Source**: `types.ts`

```typescript
export interface Explanation {
  summary: string;
  matchingStrengths: string[];
  eligibilityEvidence: string[];
  gaps: string[];
  uncertainties: string[];
  actionConsiderations: string[];
  evidenceReferences: string[];
}
```

| Check | Status |
|-------|--------|
| All fields have explicit types | ✅ PASS |
| No `any` types in the interface | ✅ PASS |
| Nullable/optional fields are not needed (all required) | ✅ PASS |
| Fields cover reasoning dimensions (strengths, gaps, uncertainties, actions) | ✅ PASS |
| `evidenceReferences` field present for grounding | ✅ PASS |

**However**, the pipeline type system is weak:
- `IntelligencePipelineOutput.explanation` is typed as `any` (line 34)
- `ExplanationEngine.explain()` parameter is `intelligence: any` (line 4)
- No validation that the engine's output conforms to `Explanation` at runtime

**Status**: `⚠️ PARTIAL` — Interface schema is well-designed. Runtime type safety is absent (`any` types throughout pipeline and engine parameter).

---

### 2.5 Hallucination Resistance

**Source**: `explanation-engine.ts`

Hallucination resistance requires:
1. **Constrained generation** — LLM output must be constrained to reference only provided factors
2. **Output validation** — Validate that explanation claims map to actual pipeline data
3. **Fact-checking layer** — Cross-reference explanation text against computed scores/decisions
4. **Fallback on inconsistency** — If LLM produces claims unsupported by data, discard or flag

None of these exist because there is no LLM integration. The stub returns empty arrays which cannot hallucinate, but this is a trivially safe behavior, not a designed safeguard.

**Status**: `❌ FAIL` — No hallucination resistance mechanisms. No LLM integration means the entire concern is unaddressed.

---

### 2.6 Fallback Behavior When Model Fails

**Source**: `explanation-engine.ts`; `real-pipeline.ts` line 170

Expected fallback behaviors:
- **LLM timeout**: Return deterministic explanation from factor scores
- **LLM error**: Degrade to template-based summary using raw numbers
- **LLM garbage output**: Validate structure, fall back if invalid
- **Rate limiting**: Queue and retry with backoff

The current stub always succeeds (returns hardcoded response) so it cannot fail, but this is not a designed fallback — it is a non-implementation.

When a real LLM is integrated, the pipeline has **no try/catch** around the explanation call (line 170). If `realExplanationEngine.generate()` throws, the entire `run()` method will throw, aborting the pipeline and losing all upstream computations.

**Status**: `❌ FAIL` — No fallback behavior. No error handling around explanation call. Pipeline crash risk.

---

## 3. Critical Bug: Broken Import / Missing Export

**Source**: `real-pipeline.ts` line 8; `index.ts`

```typescript
// real-pipeline.ts line 8
import { realExplanationEngine } from '../explanation';
```

```typescript
// index.ts
export * from './types';
export * from './explanation-engine';
```

The `index.ts` exports:
- `Explanation` interface (from `types.ts`)
- `ExplanationEngine` class (from `explanation-engine.ts`)

It does **not** export `realExplanationEngine`. No file in the `explanation/` directory defines or exports a `realExplanationEngine`.

Additionally, the pipeline calls `realExplanationEngine.generate(...)` (line 170), but `ExplanationEngine` only defines `explain(...)` (line 4), not `generate(...)`.

**Impact**: This will cause a **compile-time or runtime import error** when `real-pipeline.ts` is executed.

**Status**: `🔴 CRITICAL BUG` — The pipeline references a non-existent export (`realExplanationEngine`) and a non-existent method (`generate`). This code path is broken.

---

## 4. Validation Checklist

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Explanation receives computed factors (not raw data) | ✅ PASS | `real-pipeline.ts` lines 170–187 passes pre-computed results |
| 2 | LLM explains already-computed results | ❌ FAIL | No LLM integration; stub returns hardcoded object |
| 3 | Evidence grounding logic | ❌ FAIL | `evidenceReferences` field exists in type but populated as `[]` |
| 4 | Schema validity (Explanation interface) | ⚠️ PARTIAL | Interface is well-designed; pipeline uses `any` types |
| 5 | Hallucination resistance | ❌ FAIL | No LLM = no output validation or constraint mechanisms |
| 6 | Fallback when model fails | ❌ FAIL | No error handling; pipeline will crash on explanation failure |
| 7 | `realExplanationEngine` export exists | 🔴 FAIL | Not exported from `index.ts`; import will fail |
| 8 | `generate()` method exists | 🔴 FAIL | Engine has `explain()`, not `generate()`; call will fail |
| 9 | Tests exist for explanation engine | ❌ FAIL | No test files found |

**Overall Score**: 1/9 checks pass (1 partial). **Status: NOT PRODUCTION READY**.

---

## 5. Recommendations

### P0 — Fix Broken Import (Immediate)
1. Either rename `explain()` to `generate()` in `ExplanationEngine` and add an instance export:
   ```typescript
   // index.ts
   export { ExplanationEngine };
   export const realExplanationEngine = new ExplanationEngine();
   ```
2. Or update the pipeline import to match the actual API.

### P1 — Implement LLM-Powered Explanation (Core Feature)
1. Accept a `UnifiedModelService` (or equivalent LLM client) via constructor injection
2. Design a structured prompt that includes all 8 match factors, eligibility decisions, score, value, and timing
3. Parse LLM output into the `Explanation` interface with validation
4. Add response schema validation (JSON schema or Zod) to catch malformed LLM output

### P2 — Add Evidence Grounding
1. Require each explanation claim to cite a factor name and value
2. Add a `factCheck()` method that validates claims against pipeline data
3. Cross-reference `matchingStrengths` against `matchFactors` keys
4. Cross-reference `eligibilityEvidence` against `eligibility.decisions`

### P3 — Add Fallback and Error Handling
1. Wrap explanation call in try/catch within pipeline `run()`
2. On LLM failure, generate a deterministic template-based explanation from raw factor scores:
   ```typescript
   // Fallback template
   summary: `Score: ${score}/1.0. Top factors: career(${matchFactors.careerAlignment}), skill(${matchFactors.skillAlignment}).`
   ```
3. Add circuit breaker pattern for repeated LLM failures
4. Implement retry with exponential backoff for transient failures

### P4 — Add Runtime Type Safety
1. Replace `any` types in `IntelligencePipelineOutput.explanation` with `Explanation`
2. Add runtime validation (Zod schema) for engine input/output
3. Add unit tests covering: normal explanation, empty factors, LLM timeout, malformed LLM output

---

*Validated by Agent N — Backend Architect, Phase 7*

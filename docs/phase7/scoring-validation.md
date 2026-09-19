# Scoring & Value Assessment Validation

**Phase 7 — Agent J (Backend Architect)**
**Date**: 2026-09-19
**Files Audited**:
- `backend/src/intelligence/scoring/scoring-engine.ts`
- `backend/src/intelligence/scoring/types.ts`
- `backend/src/intelligence/scoring/index.ts`
- `backend/src/intelligence/value/value-assessment-engine.ts`
- `backend/src/intelligence/value/types.ts`
- `backend/src/intelligence/pipeline/real-pipeline.ts`
- `backend/src/intelligence/eligibility/eligibility-engine.ts`

---

## 1. Scoring Factors & Weights

**Source**: `scoring-engine.ts` lines 3–12 (`DEFAULT_WEIGHTS`)

| Factor              | Weight | Category       |
|---------------------|--------|----------------|
| `careerAlignment`   | 0.25   | Semantic match |
| `skillAlignment`    | 0.20   | Semantic match |
| `eligibility`       | 0.15   | Hard gate      |
| `experienceFit`     | 0.10   | Semantic match |
| `educationFit`      | 0.10   | Static         |
| `opportunityValue`  | 0.10   | Value engine   |
| `locationRemoteFit` | 0.05   | Static         |
| `timingDeadline`    | 0.05   | Static         |
| **Total**           | **1.00** |              |

**Status**: `✅ VERIFIED` — All 8 factors defined; weights sum to 1.0.

**Note**: `educationFit`, `locationRemoteFit`, and `timingDeadline` are hardcoded to `0.5`, `0.8`, and `0.8` in `real-pipeline.ts` lines 136–139. These are placeholders, not derived from any engine. Factor inputs are currently static in the pipeline and do not feed from dedicated assessment engines for those factors.

---

## 2. Scoring Formula

**Source**: `scoring-engine.ts` line 40

```
finalScore = hardEligibility × weightedMatchScore
```

Where:
- `weightedMatchScore = Σ (normalizedScore_i × weight_i)` for all 8 factors
- `normalizedScore` = `max(0, min(1, rawScore))` — clamped to [0, 1]
- `hardEligibility` is an external multiplier (0.0, 0.5, or 1.0)

**Status**: `✅ VERIFIED` — Formula confirmed at line 40. No LLM call occurs within the scoring engine. The engine class is named `DeterministicScoringEngine` and contains a single pure `score()` method with no async operations, no external calls.

---

## 3. Eligibility Mapping (hardEligibility Multiplier)

**Source**: `real-pipeline.ts` line 146; `eligibility-validation.md` lines 164–170, 393

| Eligibility State | `hardEligibility` Multiplier |
|-------------------|------------------------------|
| `ELIGIBLE`        | `1.0`                        |
| `UNCERTAIN`       | `0.5`                        |
| `INELIGIBLE`      | `0.0`                        |

**Status**: `✅ VERIFIED` — Mapping confirmed in `real-pipeline.ts`:
```typescript
hardEligibility: eligibility.overall === 'ELIGIBLE' ? 1
               : eligibility.overall === 'UNCERTAIN' ? 0.5
               : 0
```

**Consequence**:
- `ELIGIBLE` → full `weightedMatchScore` passes through
- `UNCERTAIN` → score halved (50% penalty)
- `INELIGIBLE` → `finalScore = 0.0` regardless of all other factors (hard gate)

---

## 4. LLM Cannot Alter Scores

**Source**: `scoring-engine.ts`, `classification-engine.ts`, `real-pipeline.ts`

| Component             | LLM Involvement              | Evidence |
|-----------------------|-------------------------------|----------|
| `DeterministicScoringEngine` | **NONE** | Class has no LLM client, no async, no external calls. Pure arithmetic on pre-computed factor scores. |
| `ValueAssessmentEngine` | **NONE** | All assessment methods (`assessCareerRelevance`, `assessCompensation`, etc.) are private synchronous methods using deterministic heuristics. No LLM calls. |
| `EligibilityEngine` | **NONE** | Pure rule-based evaluation. 13 rule handlers are deterministic functions. |
| `ClassificationEngine` | **LLM fallback** | Uses LLM only for text classification, not scoring. Results feed *into* factor scores but do not directly manipulate them. |
| `RequirementExtractor` | **LLM for extraction** | Extracts requirements from text. Output feeds into eligibility rules, not directly into scoring formula. |

**Status**: `✅ VERIFIED` — The scoring formula (`DeterministicScoringEngine.score()`) and value assessment (`ValueAssessmentEngine.assess()`) are both pure deterministic functions with zero LLM dependency. LLM results flow *indirectly* through upstream pipeline stages (classification, requirement extraction, semantic matching) but cannot alter the scoring formula itself. The multiplier `hardEligibility` is derived from deterministic eligibility rules, not from LLM classification.

---

## 5. Opportunity Value Factors

**Source**: `value/types.ts` lines 70–81; `value-assessment-engine.ts` lines 14–25

| Factor                      | Weight | Assessment Method                | Evidence Source |
|-----------------------------|--------|----------------------------------|-----------------|
| `careerRelevance`           | 0.15   | Title/industry match to candidate targets | `opportunity.title`, `opportunity.industry` |
| `experienceBuildingValue`   | 0.15   | Responsibility signals + time commitment | `opportunity.description`, `opportunity.duration` |
| `skillDevelopment`          | 0.12   | Skill novelty relative to candidate | `opportunity.skills`, `candidate.skills` |
| `effortApplicationComplexity` | 0.12 | Steps, materials, requirement count | `opportunity.application`, `opportunity.requirements` |
| `compensation`              | 0.10   | Type + amount vs candidate preference | `opportunity.compensation` |
| `credentialValue`           | 0.08   | Certificate signals + org reputation | `opportunity.benefits`, `opportunity.organization` |
| `networkingPotential`       | 0.08   | Community signals + org size | `opportunity.description`, `opportunity.organization` |
| `organizationRelevance`     | 0.08   | Industry alignment | `opportunity.organization`, `opportunity.industry` |
| `accessibility`             | 0.07   | Remote/location + application friction | `opportunity.remote`, `opportunity.application` |
| `deadlineUrgency`           | 0.05   | Days until deadline | `opportunity.application.deadline` |
| **Total**                   | **1.00** |                                  |                 |

**Status**: `✅ VERIFIED` — All 10 factors defined in `ValueFactors` interface. Weights are configurable via constructor options. The `ValueAssessmentEngine` constructor normalizes weights to sum to 1.0 (lines 67–70). Each factor returns an `EvidencedScore` with `value`, `confidence`, `uncertainty`, `range`, `evidence[]`, and `rationale`.

**Weight Normalization**: The constructor (lines 67–70) divides all weights by their sum, ensuring they always sum to 1.0 even with user overrides. A second normalization occurs in `assess()` (lines 79–82) for `weightingProfile` overrides.

**Composite Score**: `computeComposite()` (line 368) produces a `valueScore` (weighted sum normalized to [0,1]), overall `confidence`, `uncertainty` level, and plausible `range`.

---

## 6. Value Assessment Architecture

**Source**: `value-assessment-engine.ts` lines 61–111

Each factor assessment method follows a consistent pattern:
1. Initialize with neutral defaults (`score = 0.5`, `confidence = 0.5–0.6`)
2. Extract evidence from `opportunity` and optional `candidate` profile
3. Apply deterministic heuristics (keyword matching, thresholds, arithmetic)
4. Return `EvidencedScore` with bounded values and confidence

**Uncertainty Model** (`lines 31–35`):
- `confidence >= 0.8` → `low` uncertainty
- `confidence >= 0.5` → `medium` uncertainty
- `confidence < 0.5` → `high` uncertainty

**Confidence-to-Range Mapping** (`lines 37–42`):
```
spread = (1 - confidence) × 0.4
range = [max(0, value - spread), min(1, value + spread)]
```

**Status**: `✅ VERIFIED` — Consistent pattern across all 10 factor assessors.

---

## 7. Pipeline Integration Summary

**Source**: `real-pipeline.ts` lines 130–167

```
Extraction → Classification → Requirements → Eligibility
                                                  ↓
                                          hardEligibility (0/0.5/1)
                                                  ↓
SemanticMatching → FactorScores → DeterministicScoringEngine → finalScore
                                                                      ↓
ValueAssessment → valueScore (separate composite)       RankingEngine ← finalScore
```

**Key Observation**: The `ValueAssessmentEngine` result (`value.compositeScore`) is passed into `explanation` (line 180) but is **NOT** fed into the `DeterministicScoringEngine` factor scores. The `opportunityValue` factor in scoring is hardcoded to `0.7` (line 137). This means the value assessment engine runs but its output does not currently influence the final score.

**Status**: `⚠️ NOTABLE GAP` — `ValueAssessmentEngine` output is computed but not integrated into scoring. The `opportunityValue` factor score is a static placeholder.

---

## 8. Validation Checklist

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | 8 scoring factors defined | ✅ PASS | `scoring-engine.ts` lines 3–12 |
| 2 | Weights sum to 1.0 | ✅ PASS | 0.25+0.20+0.15+0.10+0.10+0.10+0.05+0.05 = 1.00 |
| 3 | FinalScore = hardEligibility × weightedMatchScore | ✅ PASS | `scoring-engine.ts` line 40 |
| 4 | ELIGIBLE=1.0, UNCERTAIN=0.5, INELIGIBLE=0.0 | ✅ PASS | `real-pipeline.ts` line 146 |
| 5 | Scores clamped to [0,1] | ✅ PASS | `Math.max(0, Math.min(1, ...))` at line 26 |
| 6 | Scoring engine is deterministic (no LLM) | ✅ PASS | `DeterministicScoringEngine` has no async/LLM calls |
| 7 | Value engine is deterministic (no LLM) | ✅ PASS | All methods are synchronous, no external calls |
| 8 | Eligibility engine is deterministic (no LLM) | ✅ PASS | Rule-based with no external calls |
| 9 | 10 value factors defined | ✅ PASS | `value/types.ts` lines 70–81 |
| 10 | Value weights normalize to 1.0 | ✅ PASS | Constructor + assess() both normalize |
| 11 | Each factor returns EvidencedScore | ✅ PASS | All 10 methods return `makeScore()` |
| 12 | Uncertainty model implemented | ✅ PASS | 3-level model with confidence thresholds |
| 13 | ValueAssessment feeds into scoring | ⚠️ GAP | `opportunityValue` factor is hardcoded to 0.7 |
| 14 | Rankings filter by eligibility | ✅ PASS | `filterEligibleOnly` uses `ELIGIBLE` state |

---

## 9. Recommendations

1. **Wire ValueAssessment into Scoring**: The `ValueAssessmentEngine` produces `composite.valueScore` but it is not passed to `DeterministicScoringEngine`. The `opportunityValue` factor (weight 0.10) should receive `value.composite.valueScore` instead of the hardcoded `0.7`.

2. **Wire Other Static Factors**: `educationFit` (0.10), `locationRemoteFit` (0.05), and `timingDeadline` (0.05) are hardcoded in the pipeline. These should be sourced from their respective engines (eligibility rules, timing engine) for consistency.

3. **Add Unit Tests for Score Bounds**: No tests verify that `finalScore` is always in [0, 1]. Add property-based tests asserting `0 <= finalScore <= 1` for all input combinations.

4. **Document Weight Tuning**: The scoring weights are constants. Consider making them configurable per-deployment or per-tenant via the pipeline constructor, similar to how `ValueAssessmentEngine` accepts weight overrides.

---

*Validated by Agent J — Backend Architect, Phase 7*

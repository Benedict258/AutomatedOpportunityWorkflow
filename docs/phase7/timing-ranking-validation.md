# Phase 7: Timing Intelligence & Ranking Validation

**Files Reviewed:**
- `backend/src/intelligence/timing/timing-intelligence-engine.ts`
- `backend/src/intelligence/timing/types.ts`
- `backend/src/intelligence/ranking/ranking-engine.ts`
- `backend/src/intelligence/ranking/types.ts`
- `backend/src/intelligence/pipeline/real-pipeline.ts` (wiring context)
- `backend/src/intelligence/scoring/scoring-engine.ts` (wiring context)

---

## Verification Checklist

### 1. Deadline Extraction
**Status: PASS**

`TimingIntelligenceEngine.assess()` extracts the deadline from the opportunity object:

```typescript
const deadline = opportunity.deadline ? new Date(opportunity.deadline) : null;
```

The pipeline feeds `normalizedOpportunity` where `deadline` is populated from extraction fields (`fields.deadline || null`). The nullable path is handled — opportunities without a deadline produce `deadline = null` with no runtime errors.

---

### 2. Normalization
**Status: PASS**

Two values are normalized:

| Output | Formula | Range |
|---|---|---|
| `deadlineDistanceDays` | `Math.ceil(deltaMs / 86_400_000)` | Integer days (ceiling) |
| `actionability` | `Math.min(1, Math.max(0, 1 - distance / 90))` | [0.0, 1.0] |

- Distance is normalized to whole days via ceiling division of the millisecond delta.
- Actionability is clamped to [0, 1] against a 90-day horizon, preventing overflow.
- Raw scores in `DeterministicScoringEngine` are similarly clamped: `Math.max(0, Math.min(1, input.rawScore))`.

---

### 3. Timezone Handling
**Status: PASS (correct by construction)**

Both timestamps are created via `new Date()`:

```typescript
const now = new Date();                                    // local parse
const deadline = new Date(opportunity.deadline);            // ISO parse
```

JavaScript `Date` stores UTC epoch milliseconds internally regardless of the input string's timezone representation. The difference `deadline.getTime() - now.getTime()` is always computed in a single reference frame (UTC epoch), so timezone offset cannot corrupt the delta. No external timezone library is needed for a simple difference calculation.

---

### 4. Expired Detection
**Status: PASS**

```typescript
const isExpired = distance !== null && distance < 0;
```

Correctly returns `true` only when a deadline exists AND is in the past. Opportunities with no deadline (`distance === null`) are never marked expired. The `isExpired` flag propagates through to:
- `deadlineUrgency = 'expired'`
- `actionability = 0`

---

### 5. Days Remaining
**Status: PASS**

`deadlineDistanceDays` (aliased from `distance`) represents the ceiling number of whole days until the deadline. When no deadline exists, the value is `null`, which is correctly typed as `number | null` in `TimingAssessment`.

Edge cases:
- `distance = 0` → deadline is today (within 24 hours). Urgency maps to `'high'`.
- `distance = 1` → tomorrow. Urgency maps to `'high'`.
- `distance = null` → no deadline. Urgency maps to `'low'`.

---

### 6. Urgency Classification
**Status: PASS**

```typescript
const urgency =
  isExpired       ? 'expired' :
  distance === null ? 'low'    :  // rolling/no deadline
  distance <= 7    ? 'high'   :  // ≤ 1 week
  distance <= 30   ? 'medium' :  // ≤ 1 month
                     'low';       // > 1 month
```

| Condition | Urgency |
|---|---|
| Past deadline | `expired` |
| No deadline (null) | `low` |
| ≤ 7 days | `high` |
| 8–30 days | `medium` |
| > 30 days | `low` |

Classification is exhaustive and mutually exclusive. Type constraint `'low' | 'medium' | 'high' | 'expired'` is respected — no value can violate the union.

---

### 7. Rolling Applications (No Deadline)
**Status: PASS**

When `opportunity.deadline` is falsy (`null`, `undefined`, empty string):

| Field | Value | Rationale |
|---|---|---|
| `deadlineDistanceDays` | `null` | No date to compute from |
| `deadlineUrgency` | `'low'` | Non-urgent, apply anytime |
| `isExpired` | `false` | Cannot be expired without a deadline |
| `actionability` | `0.5` | Neutral midpoint — neither urgent nor stale |

The engine does not treat missing deadlines as errors or as expired. Rolling opportunities receive a neutral 0.5 actionability score, allowing them to rank on other factors.

---

### 8. Ranking Consumes Computed Scores
**Status: PASS**

The `RankingEngine.rank()` method signature accepts pre-computed scores:

```typescript
rank(scores: {
  opportunityId: string;
  finalScore: number;
  hardEligibility: number;
  factors: any
}[], options?: RankingOptions): RankedOpportunity[]
```

In the pipeline (`real-pipeline.ts:167`):

```typescript
const ranking = this.rankingEngine.rank(
  [scoring],   // ← output of DeterministicScoringEngine.score()
  { filterEligibleOnly: eligibility.overall === 'ELIGIBLE' }
);
```

The `scoring` object contains `finalScore` (computed as `hardEligibility * weightedSum`) and `hardEligibility` (derived from eligibility assessment). The ranking engine reads these values as-is for filtering and sorting.

---

### 9. Stable Ordering
**Status: PASS**

```typescript
items.sort((a, b) => {
  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  return a.opportunityId.localeCompare(b.opportunityId);
});
```

- **Primary sort**: `finalScore` descending (highest first).
- **Tiebreaker**: `opportunityId` ascending via `localeCompare` (lexicographic).
- **Guarantee**: Two opportunities with identical `finalScore` values will always produce the same relative order regardless of input permutation, because `localeCompare` is deterministic for equal strings.

The sort result is then mapped with ordinal rank (`idx + 1`), preserving sort order.

---

### 10. No Score Invention
**Status: PASS**

`RankingEngine.rank()` performs exactly three operations:
1. **Copy**: `scores.slice()` — does not mutate input.
2. **Filter**: Optional `filterEligibleOnly` and `minScore` — removes items, never modifies values.
3. **Sort**: Reorders by existing `finalScore` — never recomputes.
4. **Map**: Adds `rank` ordinal — does not touch `finalScore`, `hardEligibility`, or `factors`.

The ranking engine has zero arithmetic on scores. It is a pure sort-and-project operation.

---

## Summary

| # | Check | Status |
|---|---|---|
| 1 | Deadline extraction | PASS |
| 2 | Normalization | PASS |
| 3 | Timezone handling | PASS |
| 4 | Expired detection | PASS |
| 5 | Days remaining | PASS |
| 6 | Urgency classification | PASS |
| 7 | Rolling applications | PASS |
| 8 | Ranking consumes computed scores | PASS |
| 9 | Stable ordering | PASS |
| 10 | No score invention | PASS |

**Overall: 10/10 PASS**

---

## Observations (Non-Blocking)

### Observation A: Timing Actionability Not Wired Into Scoring Factor

In `real-pipeline.ts:139`, the `timingDeadline` scoring factor is hardcoded:

```typescript
timingDeadline: { rawScore: 0.8, confidence: 0.7, evidence: [] }
```

This is a static value and does not consume `timing.actionability` from the `TimingIntelligenceEngine`. The timing engine runs at step 11 but its output is only passed to the explanation engine (step 13), not back into scoring (step 9). In a future iteration, `timing.actionability` should feed into the `timingDeadline` factor score for a fully data-driven pipeline.

### Observation B: Dead Field in RankingOptions

`RankingOptions.category` (types.ts line 12) is declared but never read by `RankingEngine.rank()`. This is dead interface surface area and could be removed or implemented in a future pass.

### Observation C: Single-Item Ranking in Pipeline

The pipeline currently ranks a single item (`this.rankingEngine.rank([scoring], ...)`). The ranking engine is designed for multi-item comparison but the pipeline invocation only feeds it one score per run. Multi-opportunity ranking would require a batch-level orchestrator outside the per-opportunity pipeline.

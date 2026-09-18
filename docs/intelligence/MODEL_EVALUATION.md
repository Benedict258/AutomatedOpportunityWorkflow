# Model Evaluation Framework

## Overview

The evaluation framework provides systematic assessment of model performance across intelligence tasks.

## Datasets

Located in `backend/src/intelligence/evaluation/dataset.ts`:

| Dataset | Size | Description |
|---------|------|-------------|
| Extraction | 10 | Structured field extraction from job postings |
| Classification | 10 | Taxonomy category assignment |
| Requirements | 10 | REQUIRE/PREFERRED/OPTIONAL/INFERRED/UNKNOWN |
| Eligibility | 10 | ELIGIBLE/UNCERTAIN/INELIGIBLE decisions |
| Semantic Matching | 10 | Vector similarity factors |
| Explanation | 5 | Post-scoring explanation quality |

All datasets are **synthetic fixtures** - clearly marked as test data.

## Metrics

| Task | Metrics |
|------|---------|
| Classification | Accuracy, Precision, Recall, F1 |
| Extraction | Field Precision, Recall, F1, Schema Validity |
| Eligibility | Decision Accuracy, False Eligible/Ineligible, Uncertainty Accuracy |
| Semantic Matching | Similarity Error, Ranking Consistency |
| Explanation | Schema Validity, Grounding Score, Hallucination Rate |

## Running Evaluations

```typescript
import { UnifiedModelService } from '../../models/unified-service';
import { EvaluationRunner } from '../intelligence/evaluation';

const modelService = new UnifiedModelService();
await modelService.initialize();

const runner = new EvaluationRunner(modelService);
await runner.run({
  modelIds: ['gpt-4o-mini'],
  operations: ['extraction', 'classification', 'requirement-extraction', 'eligibility', 'reasoning'],
  outputDir: './eval-results'
});

await modelService.shutdown();
```

## Model Comparison

The framework supports comparing multiple models:
- Quality (accuracy, F1, grounding)
- Latency (avg ms per request)
- Cost (estimated from token usage)
- Reliability (fallback rate, error rate)
- Structured output validity

## Current Status

| Model | Extraction | Classification | Requirements | Eligibility | Reasoning | Status |
|-------|------------|----------------|--------------|-------------|-----------|--------|
| gpt-4o-mini | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | No API key |
| nemotron-3-ultra | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | No API key |
| text-embedding-3-small | NOT RUN | N/A | N/A | N/A | N/A | No API key |

**No live model benchmarks have been executed.** Evaluation framework is implemented but requires API credentials to run.
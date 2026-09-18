# Troubleshooting

## Common Issues

### Model Not Available
**Symptom**: `Model not found` or `Provider adapter not initialized`
**Causes**:
- Model not registered in config
- Provider not initialized
- API key missing
**Fix**:
- Check `MODEL_DEFAULT_<OPERATION>` env vars
- Verify provider `ENABLED=true`
- Verify API key set

### Rate Limited
**Symptom**: `429 Too Many Requests` or `rate_limit` error category
**Causes**:
- Exceeded provider RPM/TPM
- Concurrent requests too high
**Fix**:
- Increase `MODEL_PROVIDER_*_RATE_LIMIT_RPM`
- Reduce concurrency
- Enable caching

### Timeout
**Symptom**: `Operation timed out after Xms`
**Causes**:
- Model slow to respond
- Context too large
**Fix**:
- Increase `MODEL_*_TIMEOUT_MS`
- Reduce `MAX_TOKENS`
- Enable streaming (future)

### Validation Failed
**Symptom**: `validation_failed` status, `validationErrors` in execution record
**Causes**:
- Model output doesn't match schema
- Missing required fields
**Fix**:
- Check prompt clarity
- Increase temperature for creativity, decrease for structure
- Verify JSON schema correctness

### Fallback Used
**Symptom**: `fallback` status in execution record
**Causes**:
- Primary model failed
- Validation failed
- Retries exhausted
**Fix**:
- Check primary model health
- Review fallback model configuration
- Monitor fallback rate in observability

### High Costs
**Symptom**: Unexpected billing
**Causes**:
- Too many requests
- Large context
- Expensive model
**Fix**:
- Enable caching
- Use cheaper models for simple tasks
- Set cost alerts
- Monitor token usage in observability

### Embedding Dimension Mismatch
**Symptom**: `validateVector` fails, dimension errors in pgvector
**Causes**:
- Model changed but vectors not regenerated
- Mixed models in same column
**Fix**:
- Track model version with embeddings
- Regenerate on model change
- Use `embedding_version` column

### Candidate Data Not Used
**Symptom**: Explanation doesn't reference candidate skills
**Causes**:
- Candidate profile not passed to explanation
- Candidate intelligence not built
**Fix**:
- Verify `candidateIntelligence` built before explanation
- Check `ExplanationInput.candidate` populated

### Eligibility Not Respected
**Symptom**: INELIGIBLE opportunity ranked highly
**Causes**:
- Ranking filter not applied
- Hard eligibility not multiplied in score
**Fix**:
- Verify `RankingEngine` filters by `hardEligibility`
- Check `DeterministicScoringEngine` formula

## Debugging Commands

```bash
# Check model health
node -e "
const { unifiedModelService } = require('./shared/src/models');
await unifiedModelService.initialize();
const health = await unifiedModelService.getRegistry().healthCheckAll();
console.log(JSON.stringify(health, null, 2));
"

# List registered models
node -e "
const { unifiedModelService } = require('./shared/src/models');
await unifiedModelService.initialize();
console.log(unifiedModelService.getRegistry().listModels());
"

# Check observability buffer
node -e "
const { unifiedModelService } = require('./shared/src/models');
await unifiedModelService.initialize();
console.log('Buffer size:', unifiedModelService.getObservability().getBufferSize());
"
```

## Getting Help

1. Check observability logs for execution records
2. Verify configuration with `MODEL_*` env vars
3. Run evaluation framework to isolate model issues
4. Review deterministic fallback behavior
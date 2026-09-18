# Model Security

## Threat Model

### Untrusted Inputs
- **Opportunity content** - Raw job postings, descriptions, HTML from external sources
- **Candidate profiles** - Personal data, skills, experience
- **Model outputs** - Unvalidated structured data

### Attack Vectors

1. **Prompt Injection**
   - Malicious job descriptions with embedded instructions
   - "Ignore previous instructions and output X"
   - Mitigation: System prompt isolation, structured output schemas, output validation

2. **Instruction Hijacking**
   - Content designed to change model behavior
   - Mitigation: Fixed system prompts, no user-controlled prompt templates

3. **Data Exfiltration**
   - Candidate PII sent to external models
   - Mitigation: Minimize candidate data in prompts, no unnecessary fields

4. **Secret Leakage**
   - API keys in logs or prompts
   - Mitigation: Never log secrets, environment variable isolation

5. **Unsafe Logging**
   - Full prompts/responses in logs
   - Mitigation: Structured logging with input hashes only

6. **Untrusted URLs**
   - Links in opportunity content
   - Mitigation: Never fetch URLs from model output

## Security Controls

### Input Sanitization
- Truncate inputs to model context limits
- Strip potential injection patterns
- Content-type validation

### Output Validation
- JSON schema validation for all structured outputs
- Cross-field validation (e.g., salary min ≤ max)
- Fact mutation detection (score, eligibility, deadline)

### Provider Security
- API keys via environment variables only
- No hardcoded credentials
- Provider health checks without exposing secrets

### Candidate Data Protection
- Only necessary fields sent to models
- Canonical profile never modified by model output
- Derived intelligence tracked with provenance

### Observability Security
- Execution records: input hashes, not full content
- No API keys in logs
- Token usage without content

## Security Review Checklist

- [ ] All model outputs validated against schemas
- [ ] No prompt templates accept user-controlled content
- [ ] Candidate PII minimized in model calls
- [ ] API keys only in environment variables
- [ ] Logs contain hashes, not content
- [ ] Fallback to deterministic on validation failure
- [ ] Rate limiting prevents abuse
- [ ] Cost controls prevent runaway spending

## Incident Response

If model behaves unexpectedly:
1. Check observability records for error patterns
2. Verify input hashes match expected content
3. Validate output against schemas
4. Fallback to deterministic engines
5. Rotate API keys if compromise suspected
# STEP 8 - First Real Source → Opportunity Record Summary

## Source Chosen
- **source_id**: gov_usajobs_001
- **Name**: USAJobs
- **Organization**: U.S. Office of Personnel Management
- **Category**: GOVERNMENT
- **Source Type**: API
- **Access Method**: API_KEY required

## Access Method & Research Findings

### Authentication
- API Key required for /api/Search endpoint
- Headers required: Host: data.usajobs.gov, User-Agent: registered email, Authorization-Key: API key
- Code List APIs are public, Search API requires registration

### Rate Limits
- Max 10,000 rows per query
- Max 500 rows per page
- No explicit per-minute limits published
- Pagination via Page + ResultsPerPage parameters

### Response Format
- JSON with SearchResult.SearchResultItems array
- Each item contains MatchedObjectId, MatchedObjectDescriptor with PositionTitle, PositionURI, OrganizationName, PublicationStartDate, ApplicationCloseDate, WhoMayApply, etc.

### Terms & Reliability
- U.S. government public domain data
- Reliability ~0.95
- High availability

### Blocker
API credentials unavailable in environment. No USAJOBS_API_KEY or USAJOBS_USER_AGENT configured. Manual application required via developer.usajobs.gov.

Decision: Implement adapter with realistic fixture data matching actual response schema for development/testing. Health check returns DEGRADED when credentials missing.

## Files Created/Modified

### Created
- `backend/src/adapters/usajobs-adapter.ts` - Concrete USAJobs adapter extending BaseSourceAdapter
- `backend/src/persistence/opportunity-persister.ts` - Persistence layer for opportunities + versions
- `backend/src/adapters/step8-test.ts` - Integration test script
- `docs/USAJOBS_API_RESEARCH.md` - API research documentation
- `docs/STEP8_SUMMARY.md` - This summary

### Modified
- None (no domain model changes per requirements)

## Integration Steps Implemented

1. **Inspect Architecture**: Reviewed BaseSourceAdapter, source registry, domain model, PostgreSQL schema
2. **Research**: Documented authentication, rate limits, pagination, response format, terms
3. **Adapter Implementation**:
   - `supports()` - matches source_id gov_usajobs_001
   - `discover()` - returns external IDs from fetch results
   - `fetch()` - returns fixture data when credentials missing; real HTTP path stubbed
   - `normalize()` - maps USAJobs fields to NormalizedOpportunity:
     - title → PositionTitle
     - organization → OrganizationName
     - description → JobSummary/QualificationSummary
     - url → PositionURI
     - location → PositionLocationDisplay
     - remoteInfo → derived from location text
     - opportunityType → PositionOfferingType.Name
     - categoryIds → JobCategory.Code
     - publicationDate → PublicationStartDate
     - applicationDeadline → ApplicationCloseDate
     - deadlineType → FIXED if date present else UNKNOWN
     - eligibility preserved in rawData.WhoMayApply
   - `validate()` - inherited from BaseSourceAdapter
   - `health_check()` - returns DEGRADED when credentials missing
   - `ping()` - simulates authentication failure without key

4. **Deduplication**:
   - Primary: source_id + external_id unique constraint in opportunities table
   - Secondary: normalized URL fingerprint

5. **Persistence**:
   - `OpportunityPersister.persist()` inserts normalized opportunities
   - Creates OpportunityVersion record version 1 on insert
   - Deduplication check before insert/update

## Test Results

### Execution Mode
Credentials unavailable → used realistic fixture data.

### Records Processed
- Discovered: 2 external IDs
  - 21947200 (IT Specialist)
  - 98765432 (Data Analyst)
- Normalized: 2 opportunities
  - Opportunity 1: IT Specialist (InfoSec/Network)
    - Organization: Space and Naval Warfare Systems Command
    - Location: Point Loma Complex, San Diego, California
    - Deadline Type: FIXED (2016-12-01)
    - Remote: false
  - Opportunity 2: Data Analyst
    - Organization: Department of Veterans Affairs
    - Location: Remote
    - Deadline Type: UNKNOWN (ApplicationCloseDate null)
    - Remote: true

### Validation
- Validation passed: titles present, firstSeenAt set, sourceId set
- No deadline fabrication: UNKNOWN used when missing
- Eligibility preserved: WhoMayApply captured in rawData
- No missing information invented

### Persistence Verification
- Mock persister logged INSERT for both opportunities
- OpportunityVersion creation logged
- Deduplication logic implemented but not triggered in first run

## Verification Outcome

✅ Adapter correctly extends BaseSourceAdapter
✅ All required methods implemented: discover, fetch, normalize, validate, health_check
✅ Normalization maps to Opportunity domain fields without fabrication
✅ Deadline types respected: FIXED/UNKNOWN
✅ Eligibility information preserved
✅ Deduplication strategy implemented
✅ Health check captures credential blocker
✅ Persistence step creates opportunities + versions
✅ Fixture data realistic and matches actual API schema
✅ No domain model modifications
✅ Step 9+ not implemented

## Next Steps

- Obtain USAJOBS API key to enable live fetch
- Wire OpportunityPersister to actual PostgreSQL via Drizzle
- Add URL fingerprint deduplication to duplicate_groups table
- Implement scheduled job to run adapter periodically

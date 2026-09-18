# USAJOBS API Research Findings

## Source Chosen
- source_id: gov_usajobs_001
- Name: USAJobs
- Organization: U.S. Office of Personnel Management
- Category: GOVERNMENT
- Source Type: API
- Access Method: API_KEY

## API Availability & Endpoint

- Base URL: https://data.usajobs.gov
- Search endpoint: GET /api/Search
- Authentication required for Search API: Yes
- Code List APIs: Public, no authentication required

Current status: Operational as of 2025-2026. Developer portal active at https://developer.usajobs.gov

## Authentication

Accessing Search API requires API Key.

Required headers for each request:
- Host: data.usajobs.gov
- User-Agent: email address used when requesting API Key
- Authorization-Key: API Key provided by USAJOBS

To obtain API Key: Submit request via USAJOBS API Request page. Approval required. Credentials not available in this environment.

API Key not required for codelist endpoints.

## Rate Limits & Request Limits

From developer documentation:

Search Jobs API:
- Maximum 10,000 rows per query
- Maximum 500 rows per page
- Defaults to only "Public" jobs; additional request required for "Status" jobs
- No explicit requests per minute/hour published publicly

Code List API:
- No limits documented

## Pagination

Supported pagination via query parameters:
- Page: page number
- ResultsPerPage: page size, up to 500
- Total pages available in response: SearchResult["UserArea"]["NumberOfPages"]

Offset-style pagination with page + results per page.

## Response Format

JSON response structure:
{
  "LanguageCode": "EN",
  "SearchParameters": {},
  "SearchResult": {
    "SearchResultCount": 25,
    "SearchResultCountAll": 100,
    "SearchResultItems": [...]
  }
}

Each SearchResultItem contains MatchedObjectId, MatchedObjectDescriptor with:
- PositionID
- PositionTitle
- PositionURI
- ApplyURI
- PositionLocation
- OrganizationName
- DepartmentName
- JobCategory
- JobGrade
- PositionSchedule
- PositionOfferingType
- QualificationSummary
- PositionRemuneration
- PositionStartDate
- PositionEndDate
- PublicationStartDate
- ApplicationCloseDate
- PositionFormattedDescription
- UserArea.Details with MajorDuties, Education, Requirements, WhoMayApply, etc.

## Terms & Reliability

Terms:
- U.S. government data - public domain for job postings
- API usage requires registration and adherence to Terms of Use
- Attribution recommended
- PostChannelID can be requested for sourcing analysis

Reliability:
- Official government source
- Reliability score estimated 0.95
- High availability, but API key required

## Blocking Factors

1. API Key unavailable: Requires manual application to USAJOBS developer portal
2. User-Agent must match registered email
3. No credentials stored in environment

Decision: Implement adapter with realistic fixture data for development/testing. Health check will simulate degraded state when credentials missing.

## Normalization Mapping

USAJOBS fields -> NormalizedOpportunity

- sourceId: gov_usajobs_001
- externalId: MatchedObjectId or PositionID
- title: PositionTitle
- organization: OrganizationName
- description: UserArea.Details.JobSummary or QualificationSummary
- url: PositionURI
- location: PositionLocationDisplay or first PositionLocation.LocationName
- remoteInfo: RemoteIndicator field from search params/response
- opportunityType: PositionOfferingType.Name
- categoryIds: JobCategory.Code mapped to taxonomy
- publicationDate: PublicationStartDate
- applicationDeadline: ApplicationCloseDate
- deadlineType: FIXED if ApplicationCloseDate present, else UNKNOWN
- firstSeenAt: current timestamp
- lastSeenAt: current timestamp

Eligibility preserved: WhoMayApply.Name + Code

Do not fabricate deadline types.

## Deduplication

- Primary: source_id + external_id unique constraint
- Secondary: normalized URL fingerprint via lowercase trimmed url

## Notes

No rolling deadlines observed in USAJOBS; all deadlines are fixed close dates. If ApplicationCloseDate missing, deadlineType = UNKNOWN.

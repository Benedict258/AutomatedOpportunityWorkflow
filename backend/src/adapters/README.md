# Source Adapters

Provider-agnostic adapter architecture for Automated Opportunity Intelligence System.

## Architecture Principles

- **Separation of Concerns**: Discovery, Fetch, Normalization, Validation, Persistence are distinct steps
- **Provider Agnostic**: Adapters implement common interfaces, not concrete source logic
- **Domain Compatible**: All adapters produce `NormalizedOpportunity` mapping to `Opportunity` domain entity
- **Error Handling**: Custom error types with retryability flags

## Structure

```
adapters/
  types.ts                      # Shared types for adapters
  errors.ts                     # AdapterError hierarchy
  source-adapter.interface.ts   # SourceAdapter & AdapterFactory interfaces
  search-provider.interface.ts  # SearchProvider interface
  base-adapter.ts               # Abstract BaseSourceAdapter with common logic
  generic-api-adapter.skeleton.ts  # Skeleton for REST API adapters
  index.ts                      # Public exports
```

## Interfaces

### SourceAdapter
- `discover(options)` -> `string[]` - Find available resource IDs
- `fetch(options)` -> `unknown` - Retrieve raw data
- `normalize(raw, sourceId)` -> `NormalizedOpportunity[]` - Map to domain
- `validate(normalized)` -> `ValidationResult` - Check integrity
- `get_metadata()` -> `AdapterMetadata`
- `health_check(sourceId)` -> `HealthCheckResult`

### SearchProvider
- `search(query)` -> `NormalizedOpportunity[]`
- `get_metadata()` -> `AdapterMetadata`
- `health_check(sourceId)` -> `HealthCheckResult`

## Error Types

- `AuthenticationFailureError` - Non-retryable
- `RateLimitingError` - Retryable with backoff
- `NetworkFailureError` - Retryable
- `MalformedResponseError` - Non-retryable
- `SourceUnavailableError` - Retryable
- `ParsingFailureError` - Non-retryable
- `UnsupportedSourceError` - Non-retryable

## Domain Mapping

`NormalizedOpportunity` maps to `Opportunity` domain entity:
- sourceId -> sourceId
- externalId -> externalId
- title -> title
- organization -> organization
- description -> description
- url -> url
- location -> location
- opportunityType -> opportunityType
- categoryIds -> categoryIds
- status -> status
- publicationDate -> publicationDate
- applicationDeadline -> applicationDeadline
- deadlineType -> deadlineType
- firstSeenAt -> firstSeenAt
- lastSeenAt -> lastSeenAt

## Usage

Extend `BaseSourceAdapter` or `GenericApiAdapter` for new sources.
Do not modify domain model.

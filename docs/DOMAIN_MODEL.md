# Domain Model

## Scope
Step 2 defines the domain model but does not implement the PostgreSQL schema.

## ID Conventions
IDs are stable strings suitable for future PostgreSQL implementation. Persistence-agnostic.

## Timestamp Conventions
All timestamps are ISO 8601 UTC strings.

## Entities

### User
id, email, name, createdAt, updatedAt

### CandidateProfile
userId, education, skills, experience, projects, certifications, careerTargets, sectors, preferredLocations, remotePreference, workAuthorization, eligibilityInfo, opportunityPreferences, etc.

### Source
id, name, url, sourceType, metadata

### Opportunity
stableId, sourceId, externalId, title, organization, description, url, location, remoteInfo, opportunityType, categoryIds, status, publicationDate, applicationDeadline, deadlineType, firstSeenAt, lastSeenAt, lastVerifiedAt, closedAt

### OpportunityVersion
id, opportunityId, versionNumber, capturedAt, title, description, applicationDeadline, deadlineType, location, url, status, changeMetadata

### OpportunityCategory
id, name, parentId, metadata

### Skill
id, name, normalizedName, description, category

### OpportunitySkill
opportunityId, skillId, relationType: REQUIRED|PREFERRED, proficiencyContext

### EligibilityRequirement
id, name, requirementType, value, details, isRequired, sourceEvidence

### OpportunityEligibility
opportunityId, requirementId, eligibilityState: ELIGIBLE|INELIGIBLE|UNCERTAIN

### DuplicateGroup
id, fingerprint, canonicalOpportunityId, duplicateState: CANONICAL|DUPLICATE|POSSIBLE_DUPLICATE

### NewsItem
id, title, sourceId, url, summary, publishedAt, discoveredAt, topic, organization, sector, geography, relevance, relatedOpportunityIds

### Event
id, name, organizer, description, url, eventType, location, remoteInfo, startDate, endDate, registrationDeadline, sourceId, status

### Certification
id, provider, title, description, url, category, costInfo, deadline, duration, eligibility, status, sourceId

### Fellowship
id, name, organization, description, url, fellowshipType, location, remoteInfo, deadline, eligibility, duration, stipendInfo, sourceId, status

### Notification
id, userId, type, title, message, relatedEntityType, relatedEntityId, scheduledAt, sentAt, status

### NotificationHistory
id, notificationId, userId, channel, sentAt, deliveryStatus, errorInfo

### ApplicationReference
id, opportunityId, userId, externalId, applicationUrl, status, notes, metadata

### SystemConfiguration
id, key, value, description, metadata

### BenchmarkSample
id, sourceData, expectedExtraction, expectedClassification, expectedEligibility, expectedRelevance, category, metadata

### BenchmarkResult
id, sampleId, modelTask, accuracy, jsonValidity, hallucinationIndicators, latencyMs, tokenUsage, cost, evaluationTimestamp

## Enums
OpportunityStatus, DeadlineType, EligibilityState, DuplicateState, SkillRelationType, NotificationStatus, NotificationChannel, DeliveryStatus, OpportunityLifecycle, RemotePreference, RequirementType

## Validation Principles
- Required IDs cannot be empty
- Dates must be logically valid
- FIXED deadline requires deadline value; ROLLING must not have artificial date
- Status values must be valid enum members
- Relationships must reference valid entity types

## Persistence-Agnostic Design
Domain model is decoupled from PostgreSQL, Prisma/Drizzle/TypeORM, MongoDB, AWS, LLM providers.

## Scope Boundary
STEP 2 COMPLETE — NO STEP 3 OR LATER IMPLEMENTATION PERFORMED

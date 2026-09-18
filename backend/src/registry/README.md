# Source Registry - STEP 6

## Overview
Source Registry provides centralized management of data sources for Automated Opportunity Intelligence System.
Implements register, enable/disable, priority update, health check, lookup by id/category.

## Architecture
- Domain model `Source` remains unchanged (id, name, url, sourceType, metadata)
- Registry fields stored in `sources.metadata` JSONB column to avoid schema migration
- Shared types in `shared/src/registry/types.ts`
- Service implementation in `backend/src/registry/source-registry.service.ts`
- Repository mapping in `backend/src/registry/source-registry.repository.ts`

## Source Categories
EMPLOYMENT, GOVERNMENT, RESEARCH, INTERNATIONAL, STUDENT, TECHNICAL, POLICY, FELLOWSHIP, EVENT, NEWS, PROFESSIONAL_DEVELOPMENT

## CRUD Operations
- register
- update
- enable/disable
- updatePriority
- healthCheck
- getById
- listByCategory
- listEnabled

## Seed Data
See `shared/config/sources.seed.yaml` for example sources.

## Notes
- No scraping implemented
- Health check is lightweight endpoint check only
- Future sources can be enabled/disabled/prioritized/health-checked/configured/monitored

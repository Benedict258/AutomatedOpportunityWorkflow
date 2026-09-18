# Security Assumptions – Phase 1

## Least Privilege
- Database user `opp_user` has read/write only to `opportunity_intelligence` schema. No superuser privileges.
- API keys and secrets are stored only in environment variables, never in YAML configuration or source code.
- Adapters run with read-only external access; no outbound write to sources.
- Configuration loader validates merged YAML with Zod schema and rejects unknown keys.

## Secrets Management
- `.env` is gitignored. `.env.example` contains placeholders only.
- Docker Compose uses environment variable substitution for POSTGRES_* variables.
- No secrets committed to repository.

## Input Validation
- All external source responses are validated via `BaseSourceAdapter.validate()`.
- URLs from sources are treated as untrusted; only assigned to domain fields, never fetched automatically in Phase 1.
- SQL queries use parameterized statements `$1`, `$2`, etc.

## Error Handling
- Adapter errors do not leak secrets. Messages are generic with code and sourceId.
- Health checks return status without exposing credentials.

## Audit
- Source health and registry changes are recorded with timestamps.
- No user data separation implemented yet – planned for Phase 2.

This document reflects Phase 1 foundation only.

# Database Migrations

Migrations are raw SQL files ordered numerically.

## Apply migrations locally

```bash
docker compose up -d postgres
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/001_create_extensions.sql
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/002_create_schema.sql
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/003_create_indexes.sql
docker exec -i opportunity_postgres psql -U opp_user -d opportunity_intelligence < backend/migrations/004_create_embeddings.sql
```

## Verification

```bash
node backend/scripts/verify-db.js
```

## Notes

- Extension `vector` enabled for pgvector embeddings.
- Embedding dimension placeholder: 1536 (configurable).
- Schema is decoupled from application code, consistent with `shared/src/domain/`.
- Migration 004 creates embedding tables with pgvector support for opportunities, candidates, and skills.
- No production connection.

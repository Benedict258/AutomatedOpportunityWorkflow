# Architecture Overview

## High Level
Monorepo with separation of concerns between frontend, backend, and shared code.

## Frontend
- React + Vite + TypeScript
- Location: `frontend/`
- Future: UI for opportunity intelligence control plane

## Backend
- Node.js + TypeScript + Express
- Location: `backend/`
- Future: API layer for opportunity pipeline

## Shared
- Types and utilities shared between frontend and backend
- Location: `shared/`

## Configuration
Centralized environment variables via `.env.example`

## Future Considerations
PostgreSQL + pgvector, source adapters, matching engine, LLM integration will be added in later phases.

## Current Status
Foundation only. No implementation.

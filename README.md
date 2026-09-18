# Automated Opportunity Workflow

Automated Opportunity Intelligence System - Phase 1 Foundation

## Overview
This project is being built incrementally. Current work is **Phase 1, Step 1: Project / Repository Foundation** only.

The system will provide automated opportunity intelligence with source adapters, matching engine, and LLM integration. No business logic is implemented in this step.

## Architecture
Monorepo with clear separation:
- `frontend/` - React + Vite UI
- `backend/` - Node.js + TypeScript API
- `shared/` - Shared types and utilities
- `docs/` - Documentation

## Prerequisites
- Node.js 20+
- npm 10+

## Environment Setup
1. Copy `.env.example` to `.env`
2. Fill required variables

## Local Development
```bash
npm install
npm run dev
```

## Scripts
- `npm run dev` - Start frontend and backend
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run typecheck` - TypeScript check
- `npm run test` - Run tests
- `npm run build` - Build workspaces

## Current Status
**STEP 1 COMPLETE — NO LATER PHASES IMPLEMENTED**

Foundation established. No domain models, no PostgreSQL schema, no source adapters, no LLM integration.

## Next Steps
Phase 1 Step 2 and beyond will be implemented in separate sessions.

# Foundation Document

## Project Identity
Name: Automated Opportunity Workflow
Purpose: Automated Opportunity Intelligence System

## Current Phase
Phase 1 - Step 1: Project / Repository Foundation

## Scope Boundary
This step establishes only:
- Repository structure
- Configuration and environment management
- Git hygiene
- Development tooling
- Documentation

Explicitly out of scope:
- Domain models
- Database schema
- Source adapters
- Matching engine
- LLM integration
- AWS infrastructure
- Notification system

## Repository Structure
```
AutomatedOpportunityWorkflow/
├── frontend/          # React + Vite UI
├── backend/           # Node.js + TypeScript API
├── shared/            # Shared types/utilities
├── docs/              # Documentation
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Configuration
Environment variables centralized in `.env.example`. No secrets committed.

## Tooling
- TypeScript for type safety
- ESLint for linting
- Prettier for formatting
- Vitest for testing foundation

## Verification
Foundation files created and verified. No business logic implemented.

## Status
STEP 1 COMPLETE — NO LATER PHASES IMPLEMENTED

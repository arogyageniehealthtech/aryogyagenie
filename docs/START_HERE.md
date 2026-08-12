# Start Here - ArogyaGenie Developer & AI Handoff Guide

Welcome to **ArogyaGenie**! This document is the immediate entry point for developers and AI agents (Replit Agent, Gemini, Antigravity, Copilot, Cursor) joining this codebase.

> [!IMPORTANT]
> **READ THIS FIRST BEFORE WRITING ANY CODE**
> 1. **DO NOT rebuild the application.**
> 2. **DO NOT replace the tech stack** (pnpm workspaces, React, Vite, Tailwind CSS, Express 5, PostgreSQL + Drizzle ORM, Clerk, Orval, OpenAPI, Zod).
> 3. **DO NOT rewrite existing backend routes or database schema.**
> 4. **CURRENT STATE VERIFIED**: Milestone 1 (Patient Portal UI & Ollama AI Gateway) is **COMPLETED**. All 10 patient UI subpages are wired in [App.tsx](file:///c:/Users/User/Desktop/Arogya-Genie/artifacts/arogyagenie/src/App.tsx), and the local Ollama AI Gateway with fallback heuristics is active in [aiGateway.ts](file:///c:/Users/User/Desktop/Arogya-Genie/artifacts/api-server/src/services/aiGateway.ts). Full workspace typechecking (`npx pnpm run typecheck`) passes with 0 errors.
> 5. **NEXT TASK**: Proceed to [NEXT_TASK.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/NEXT_TASK.md) to implement **Milestone 2: Doctor Portal UI**.

---

## Quick Navigation & Core Map

| File | Purpose |
| --- | --- |
| [MASTER_CONTEXT.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/MASTER_CONTEXT.md) | High-level vision, business rules, patient journey, stack guidelines, and design principles. |
| [CURRENT_STATUS.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/CURRENT_STATUS.md) | Exact implementation status of every module, UI page, API endpoint, and DB table (`COMPLETED`, `PARTIALLY COMPLETED`, `PLACEHOLDER`, `NOT IMPLEMENTED`). |
| [NEXT_TASK.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/NEXT_TASK.md) | **Immediate task instruction prompt for the next AI agent**: Milestone 2 - Doctor Portal UI Implementation. |
| [ARCHITECTURE.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/ARCHITECTURE.md) | System architecture diagram, monorepo layout, codegen pipelines, and AI Gateway layer design. |
| [DATABASE.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/DATABASE.md) | Full Postgres table schemas (12 tables), Drizzle ORM models, relationships, and future schema recommendations. |
| [API.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/API.md) | 40+ REST API endpoints documented with HTTP methods, auth requirements, request/response payloads, and status. |
| [AI_ARCHITECTURE.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/AI_ARCHITECTURE.md) | Free local AI strategy (Ollama REST), fallback heuristic engine, emergency detection, and future RAG/OCR plans. |
| [SECURITY.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/SECURITY.md) | Clerk authentication, RBAC middleware (`requireAuth`, `requireRole`), JIT user provisioning, CORS, and health data privacy. |
| [ROADMAP.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/ROADMAP.md) | 5-milestone roadmap tracking progress from Patient Portal to RAG & OCR integrations. |
| [DECISIONS.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/DECISIONS.md) | Key Architectural Decision Records (ADRs). |
| [BUGS.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/BUGS.md) | Known gotchas, active environment requirements, and resolved architectural disconnects. |
| [KNOWN_LIMITATIONS.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/KNOWN_LIMITATIONS.md) | Prototype boundaries and unbuilt future features. |
| [CHANGELOG.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/CHANGELOG.md) | Historical project evolution record. |
| [PROMPT_HISTORY.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/PROMPT_HISTORY.md) | Audit trail of session prompts and agent executions. |

---

## Machine-Readable State (`docs/machine/`)

For AI assistants parsing system state programmatically:
- [project_state.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/project_state.json) — Overall status, active milestone, completion phase.
- [modules.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/modules.json) — Workspace packages and component inventory.
- [routes.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/routes.json) — Frontend Wouter routes and Express backend API endpoints.
- [database_schema.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/database_schema.json) — Schema definitions of all 12 Postgres tables.
- [dependencies.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/dependencies.json) — Dependency graph between modules and healthcare entities.
- [ai_models.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/ai_models.json) — Active local Ollama models (`llama3:8b`) vs planned models.
- [milestones.json](file:///c:/Users/User/Desktop/Arogya-Genie/docs/machine/milestones.json) — Progress across all 5 prototype milestones.

---

## How to Run & Operate the Workspace

```bash
# 1. Full typecheck across all 9 workspace packages
npx pnpm run typecheck

# 2. Run the Express API Backend server (port 5000)
npx pnpm --filter @workspace/api-server run dev

# 3. Run the Frontend React / Vite web app
npx pnpm --filter @workspace/arogyagenie run dev

# 4. Regenerate React Query hooks and Zod schemas after openapi.yaml edits
npx pnpm --filter @workspace/api-spec run codegen

# 5. Push database schema changes to PostgreSQL (dev mode)
npx pnpm --filter @workspace/db run push
```

> [!NOTE]
> On Windows PowerShell/CMD environments, run `npx pnpm install --ignore-scripts` if running package installation manually.

---

## Immediate Action Item

Proceed directly to [NEXT_TASK.md](file:///c:/Users/User/Desktop/Arogya-Genie/docs/NEXT_TASK.md) to begin implementation of Milestone 2 (Doctor Portal UI).

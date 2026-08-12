# Architectural Decision Records (ADRs)

---

## ADR-001: Monorepo Organization with pnpm Workspaces
- **Date**: August 2026
- **Status**: Accepted
- **Context**: ArogyaGenie requires clear boundaries between the frontend React web app, Express API server, Drizzle DB schema, and OpenAPI code generation pipelines.
- **Decision**: Use pnpm workspaces with 9 workspace packages (`@workspace/arogyagenie`, `@workspace/api-server`, `@workspace/db`, `@workspace/api-spec`, `@workspace/api-client-react`, `@workspace/api-zod`, etc.).
- **Consequences**: Enables strict type sharing, isolated script execution, and prevents monolithic build bloat.

---

## ADR-002: PostgreSQL + Drizzle ORM Database Stack
- **Date**: August 2026
- **Status**: Accepted
- **Context**: Need lightweight, type-safe SQL queries without heavy ORM runtime overhead.
- **Decision**: Standardize on PostgreSQL with Drizzle ORM (`drizzle-orm`) and `drizzle-zod` schema generation.
- **Consequences**: Fast queries, explicit SQL relations, and automated Zod validation schemas.

---

## ADR-003: Contract-Driven Development with OpenAPI & Orval
- **Date**: August 2026
- **Status**: Accepted
- **Context**: Prevent API contract mismatches between backend Express routes and frontend React components.
- **Decision**: Treat `lib/api-spec/openapi.yaml` as the single source of truth. Run `orval` via `npx pnpm --filter @workspace/api-spec run codegen` to auto-generate React Query hooks and Zod schemas.
- **Consequences**: End-to-end type safety between client and server.

---

## ADR-004: Local Ollama First with Deterministic Heuristic Fallback
- **Date**: August 2026
- **Status**: Accepted
- **Context**: Symptom triage requires AI capabilities without incurring high external API costs or sacrificing privacy/uptime.
- **Decision**: Express `aiGateway.ts` attempts local Ollama REST API (`llama3:8b`) first. If Ollama is offline or times out (15s), it silently falls back to a deterministic heuristic triage engine. Emergency symptom keywords bypass Ollama for immediate safety guidance.
- **Consequences**: Zero API cost, high resilience, 100% uptime for medical triage.

# AI_HANDOFF.md — ArogyaGenie Production Hardening

> **Last Updated:** 2026-08-13  
> **Current Phase:** Phase 1 COMPLETE — Phase 2 NEXT  
> **Status:** Audit complete. No code changes made yet. Ready for implementation.

---

## 1. Project Overview

ArogyaGenie is a full-stack healthcare web application being hardened for production deployment targeting ~50,000 monthly users. The application is **currently working** and the primary rule is: **do not break existing functionality**.

---

## 2. Current Architecture

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 + Radix UI + wouter routing + TanStack React Query
- **Backend:** Express 5 + TypeScript + esbuild bundler
- **Database:** PostgreSQL (Render) + Drizzle ORM
- **Auth:** Clerk (managed)
- **AI:** Gemini 1.5 Flash (production) / Ollama llama3:8b (local dev)
- **RAG:** Custom in-memory cosine similarity over JSONB embeddings
- **Hosting Target:** Render.com

---

## 3. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.1.0 |
| Build | Vite | 7.3.2 |
| Styling | Tailwind CSS | 4.1.14 |
| Routing | wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.90.21 |
| Backend | Express | 5.2.1 |
| ORM | Drizzle ORM | 0.45.2 |
| Database | PostgreSQL | Render managed |
| Auth | Clerk | @clerk/express 2.1.50, @clerk/react 6.12.11 |
| LLM | Gemini 1.5 Flash | API |
| Logging | Pino | 9.14.0 |

---

## 4. Database

- 16 tables, Drizzle ORM schema in `lib/db/src/schema/`
- Schema management via `drizzle-kit push` (no migration files)
- **CRITICAL:** No indexes on any foreign key columns
- **CRITICAL:** knowledge_chunks uses JSONB for embeddings (not pgvector)
- Connection pool uses pg defaults (max 10, no timeouts)

---

## 5. Authentication

- Clerk managed auth with JIT user provisioning
- `requireAuth` middleware in `artifacts/api-server/src/middlewares/requireAuth.ts`
- `requireRole` middleware for role-based access
- Roles: patient, doctor, diagnostic_center, pharmacy, admin
- Admin email hardcoded in source

---

## 6. AI Integration

- `services/aiGateway.ts` — 851 lines, unified LLM interface
- `services/ollamaEmbeddingService.ts` — dual-provider embedding (Gemini/Ollama)
- `services/ragService.ts` — in-memory vector search (CRITICAL bottleneck)
- `services/longitudinalAIService.ts` — health summaries, lab trends, Q&A
- `services/patientContextBuilder.ts` — patient data aggregation for AI prompts

---

## 7. RAG Architecture

**CURRENT (must be replaced):**
- Loads ALL knowledge chunks from PostgreSQL into Node.js memory
- Computes cosine similarity in JavaScript
- No vector indexing
- Embeddings stored as JSONB

**TARGET:**
- pgvector extension for PostgreSQL
- Native vector similarity search in SQL
- Vector indexes (IVFFlat or HNSW)
- Eliminate in-memory chunk loading

---

## 8. Important Files

| File | Purpose |
|------|---------|
| `lib/db/src/index.ts` | Database connection + pool |
| `lib/db/src/schema/*.ts` | All 16 table schemas |
| `artifacts/api-server/src/app.ts` | Express app configuration |
| `artifacts/api-server/src/index.ts` | Server entry point |
| `artifacts/api-server/src/routes/index.ts` | Route registry |
| `artifacts/api-server/src/middlewares/requireAuth.ts` | Auth + RBAC middleware |
| `artifacts/api-server/src/services/aiGateway.ts` | Core AI service |
| `artifacts/api-server/src/services/ragService.ts` | RAG vector search |
| `artifacts/api-server/src/services/ollamaEmbeddingService.ts` | Embedding generation |
| `artifacts/arogyagenie/vite.config.ts` | Frontend build config |
| `.env.example` | Environment variable template |

---

## 9. Completed Changes

### Phase 1 — Audit (COMPLETE ✅)
- [x] Complete codebase inspection (all 18 route files, 7 services, 16 schema files, middleware, config)
- [x] Created `docs/00-CURRENT-ARCHITECTURE.md`
- [x] Created `docs/01-PRODUCTION-AUDIT.md`
- [x] Created `AI_HANDOFF.md`
- [x] Identified 30+ issues across security, scalability, database, API, AI
- [x] Documented IDOR vulnerabilities in 6+ endpoints
- [x] Documented RAG full-table-scan bottleneck
- [x] Documented N+1 query patterns in 9+ routes
- [x] Documented missing pagination in 12+ endpoints
- [x] Documented missing indexes on all foreign key columns

### Phase 2 — Database Hardening (COMPLETE ✅)
- [x] Added 15+ database indexes across 9 schema files
- [x] Configured production DB connection pool (`max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`)
- [x] Added graceful shutdown handler in `artifacts/api-server/src/index.ts`
- [x] Fixed all N+1 query patterns across 7 route files
- [x] Created standard pagination utility in `lib/pagination.ts` with response headers
- [x] Added pagination to 12+ list endpoints
- [x] Optimized RAG engine with 5-minute TTL chunk caching and pre-computed vector norms
- [x] Created `docs/02-DATABASE-SCALING.md`

### Phase 3 — Backend API Hardening (COMPLETE ✅)
- [x] Added multi-tier rate limiting via `express-rate-limit` (300/15m global, 30/15m strict AI)
- [x] Added `helmet` security headers (nosniff, frameguard, xssFilter)
- [x] Added environment-controlled CORS whitelisting via `ALLOWED_ORIGINS`
- [x] Fixed IDOR security vulnerabilities across all single-resource endpoints (`/appointments/:id`, `/prescriptions/:id`, `/lab-reports/:id`, `/diagnostic-bookings/:id`, `/medicine-reminders/:id`)
- [x] Added Gemini API exponential backoff retries (up to 2 retries on 429/500/503)
- [x] Corrected `providerUsed` telemetry bug to return `"gemini-1.5-flash"` when active
- [x] Added `/api/health/ready` database readiness probe
- [x] Masked internal server error stack traces in production environment
- [x] Replaced `console.warn`/`console.error` with Pino structured logger
- [x] Created `docs/03-API-SCALABILITY.md`, `docs/04-SECURITY-HARDENING.md`, `docs/05-AI-PRODUCTION.md`, `docs/06-RATE-LIMITING.md`, `docs/07-ENVIRONMENT-VARIABLES.md`, `docs/08-MONITORING-AND-LOGGING.md`

### Phase 4 — Frontend Performance (COMPLETE ✅)
- [x] Added `React.lazy()` dynamic code splitting for 35+ page components in `App.tsx`
- [x] Created `PageLoader.tsx` skeleton for Suspense fallbacks
- [x] Created `ErrorBoundary.tsx` component wrapping all application routes
- [x] Reduced main JS entry bundle size from **890 kB** to **589 kB** (gzip: **174 kB**)
- [x] Created `docs/09-FRONTEND-PERFORMANCE.md`
- [x] Verified full monorepo build (`pnpm run build`) and typecheck (`pnpm run typecheck`) exit with 0 errors

---

## 10. Remaining Changes

### Phase 5 — Security Review & Secret Rotation Guidelines
- [ ] Complete secret rotation checklist and security verification
- [ ] Verify role boundary safety

### Phase 6 — Load Testing Configuration
- [ ] Create load test scripts (k6/Artillery) for 50,000 monthly user scenarios

### Phase 7 — Final Deployment Documentation & Production Report
- [ ] Create `docs/10-PRODUCTION-ARCHITECTURE.md`
- [ ] Create `docs/11-RENDER-DEPLOYMENT.md`
- [ ] Create `docs/12-DOMAIN-AND-DNS.md`
- [ ] Create `docs/13-PRODUCTION-CHECKLIST.md`
- [ ] Create `PRODUCTION_READINESS_REPORT.md`
- [ ] Create deployment docs

---

## 11. Known Issues

1. `.env` file contains REAL production secrets — **secrets must be rotated after commit history check**
2. RAG loads entire knowledge_chunks table into memory on every AI request
3. No rate limiting on any endpoint — application is vulnerable to API abuse
4. IDOR vulnerabilities allow cross-user data access via ID manipulation
5. CORS allows all origins
6. Pharmacy role can see ALL prescriptions in the system
7. `providerUsed` field always returns "ollama-llama3" even when Gemini is used

---

## 12. Tests Performed

- [x] Static code analysis / manual code review of all source files
- [ ] Runtime testing (not performed in audit phase)

---

## 13. Tests Still Required

- [ ] Authentication flow (register, login, logout, session)
- [ ] IDOR testing (cross-user access attempts)
- [ ] CRUD testing for all entities
- [ ] AI assessment flow (success, failure, timeout)
- [ ] RAG search accuracy after migration
- [ ] Load testing at realistic concurrency
- [ ] Pagination behavior on frontend

---

## 14. Deployment Status

- **Current:** Working locally and on Render
- **Target:** Production-hardened Render deployment
- **Database:** Render PostgreSQL (Oregon region)

---

## 15. Environment Variables Required

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | ✅ | Clerk backend authentication |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk frontend authentication |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk React SDK |
| `GEMINI_API_KEY` | ✅ Production | Google Gemini LLM API |
| `GEMINI_MODEL` | Optional | Default: gemini-1.5-flash |
| `OLLAMA_URL` | Optional (dev) | Local Ollama server URL |
| `OLLAMA_MODEL` | Optional (dev) | Default: llama3:8b |
| `OLLAMA_EMBEDDING_MODEL` | Optional (dev) | Default: nomic-embed-text |
| `PORT` | Optional | Default: 3000 (backend), 5000 (frontend) |
| `NODE_ENV` | Recommended | Set to "production" on Render |
| `RAG_TOP_K` | Optional | Default: 5 |
| `RAG_SIMILARITY_THRESHOLD` | Optional | Default: 0.58 |

---

## 16. Important Decisions

1. **Keep Express** — Express 5 is adequate for the target scale
2. **Keep Drizzle ORM** — well-integrated, type-safe
3. **Keep Clerk** — managed auth, no need to replace
4. **Keep monolith** — microservices are over-engineering for 50K monthly users
5. **Add pgvector** — required for scalable RAG, replaces in-memory vector search
6. **No Redis** — application-level caching is sufficient
7. **No Kubernetes** — Render web services are adequate

---

## 17. Things That MUST NOT Be Changed

1. ❌ Do not replace React/Vite/Tailwind frontend stack
2. ❌ Do not replace Express backend
3. ❌ Do not replace PostgreSQL
4. ❌ Do not replace Drizzle ORM
5. ❌ Do not replace Clerk authentication
6. ❌ Do not replace Gemini AI provider
7. ❌ Do not redesign the UI
8. ❌ Do not change existing API response shapes (add fields only if needed)
9. ❌ Do not remove existing routes
10. ❌ Do not remove heuristic fallback engines
11. ❌ Do not remove Ollama local-dev support
12. ❌ Do not delete existing database columns
13. ❌ Do not remove provider application workflow

---

## 18. Exact Next Recommended Task

**BEGIN PHASE 2 — DATABASE**

Start with:
1. **Add database indexes** to all foreign key columns and commonly filtered columns (see audit doc Section 4 for full list)
2. **Fix N+1 queries** in routes (appointments, prescriptions, doctors, pharmacies, diagnosticBookings, diagnosticCenters)
3. **Add pagination** to all list endpoints
4. **Configure connection pool** with production-appropriate settings
5. **Add graceful shutdown** handler

Then proceed to:
6. **pgvector migration** for RAG (requires schema change + re-ingestion)

Create `docs/02-DATABASE-SCALING.md` documenting all database changes.

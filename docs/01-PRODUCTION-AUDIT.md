# ArogyaGenie — Production Audit Report

> **Audit Date:** 2026-08-13  
> **Target:** 50,000 monthly users  
> **Auditor:** AI Production Hardening Agent (Phase 1)

---

## 1. Current Strengths

| # | Strength | Detail |
|---|----------|--------|
| 1 | **Well-structured monorepo** | pnpm workspace with clear separation of concerns (db, api-server, frontend, scripts) |
| 2 | **Type-safe schema** | Drizzle ORM with Zod validation schemas |
| 3 | **Dual AI provider** | Gemini (production) + Ollama (local dev) with automatic detection |
| 4 | **Heuristic fallbacks** | Every AI feature has a deterministic fallback when LLM fails |
| 5 | **Structured logging** | Pino with header redaction |
| 6 | **Input validation** | Symptom input validation with multiple heuristic checks |
| 7 | **Emergency detection** | Safety-first emergency keyword detection before AI processing |
| 8 | **Supply-chain protection** | pnpm `minimumReleaseAge` setting for package security |
| 9 | **Health endpoint** | Basic `/api/health` exists |
| 10 | **Role-based access** | `requireAuth` + `requireRole` middleware pattern |

---

## 2. Current Weaknesses

### 2.1 CRITICAL — Security

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| S1 | **`.env` contains production secrets** (DB password, Clerk secret, Gemini key) in working directory | 🔴 CRITICAL | `.env` |
| S2 | **CORS is completely open** (`origin: true`) — allows any domain | 🔴 CRITICAL | `app.ts` L39 |
| S3 | **No authorization on single-resource endpoints** — `GET /appointments/:id`, `GET /prescriptions/:id`, `GET /lab-reports/:id` do NOT verify the requesting user owns the record (IDOR vulnerability) | 🔴 CRITICAL | Multiple route files |
| S4 | **`PATCH /appointments/:id`** does not verify ownership — any authenticated user can modify any appointment | 🔴 CRITICAL | `appointments.ts` L82-101 |
| S5 | **`PATCH /prescriptions/:id`** does not verify ownership | 🔴 CRITICAL | `prescriptions.ts` L71-85 |
| S6 | **`PATCH /lab-reports/:id`** does not verify ownership | 🔴 CRITICAL | `labReports.ts` L76-85 |
| S7 | **`PATCH /diagnostic-bookings/:id`** does not verify ownership | 🔴 CRITICAL | `diagnosticBookings.ts` L34-43 |
| S8 | **`PATCH /medicine-reminders/:id`** and `DELETE` do not verify ownership | 🔴 CRITICAL | `medicineReminders.ts` L30-48 |
| S9 | **`/api/medical-knowledge/search`** has NO authentication — public RAG search with no rate limiting | 🟡 HIGH | `medicalKnowledge.ts` |
| S10 | **Pharmacy sees ALL prescriptions** regardless of pharmacy assignment | 🟡 HIGH | `prescriptions.ts` L18, `pharmacies.ts` L52 |
| S11 | **No security headers** (HSTS, X-Content-Type-Options, X-Frame-Options, CSP) | 🟡 HIGH | `app.ts` |
| S12 | **Admin email hardcoded** in source code | 🟡 MEDIUM | `requireAuth.ts` L73 |
| S13 | **Error handler leaks error messages** to clients | 🟡 MEDIUM | `app.ts` L60 |

### 2.2 CRITICAL — RAG/Vector Search Scalability

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| R1 | **RAG loads ENTIRE knowledge_chunks table** into Node.js memory on every query | 🔴 CRITICAL | `ragService.ts` L86 |
| R2 | **Cosine similarity computed in JavaScript** — O(n) full scan of all chunks | 🔴 CRITICAL | `ragService.ts` L98-151 |
| R3 | **Embeddings stored as JSONB** — not a native vector type, no vector index | 🔴 CRITICAL | `knowledge_vectors.ts` L40 |
| R4 | **Every AI request triggers a full table scan** of knowledge chunks | 🔴 CRITICAL | `ragService.ts` |

### 2.3 HIGH — Database

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| D1 | **No indexes on foreign keys** — patient_id, doctor_id, diagnostic_center_id have no indexes on any table | 🔴 CRITICAL | All schema files |
| D2 | **No indexes on status/date columns** used for filtering | 🟡 HIGH | All schema files |
| D3 | **Connection pool uses pg defaults** (max 10, no timeouts) | 🟡 HIGH | `lib/db/src/index.ts` |
| D4 | **No graceful shutdown** — server doesn't close pool on SIGTERM | 🟡 HIGH | `index.ts` |
| D5 | **Admin stats route loads ALL rows from 7 tables** — `db.select().from(table)` with no filters | 🔴 CRITICAL | `admin.ts` L10-18 |

### 2.4 HIGH — N+1 Queries

| # | Issue | Files | Impact |
|---|-------|-------|--------|
| N1 | **appointments.ts GET** — For each appointment, 3 individual queries (doctor, doctorUser, patient) | `appointments.ts` L17-31 | O(3n) DB calls |
| N2 | **prescriptions.ts GET** — For each prescription, 3 individual queries | `prescriptions.ts` L23-35 | O(3n) DB calls |
| N3 | **doctors.ts /me/appointments** — For each appointment, 2 individual queries | `doctors.ts` L244-257 | O(2n) DB calls |
| N4 | **doctors.ts /me/patients** — For each patient, individual user lookup | `doctors.ts` L270-287 | O(n) DB calls |
| N5 | **doctors.ts /me/dashboard recentPatients** — `Promise.all` of individual queries | `doctors.ts` L190-207 | O(n) DB calls |
| N6 | **diagnosticBookings.ts GET** — For each booking, individual center lookup | `diagnosticBookings.ts` L11-15 | O(n) DB calls |
| N7 | **diagnosticCenters.ts /me/bookings** — For each booking, individual patient lookup | `diagnosticCenters.ts` L87-90 | O(n) DB calls |
| N8 | **pharmacies.ts /me/prescriptions** — For each prescription, 3 individual queries | `pharmacies.ts` L55-59 | O(3n) DB calls |
| N9 | **admin.ts /admin/stats** — Loads entire tables then filters in JS | `admin.ts` L10-18 | Full table scans |

### 2.5 HIGH — No Pagination

| # | Endpoint | Current Behavior |
|---|----------|-----------------|
| P1 | `GET /appointments` | Returns ALL patient appointments |
| P2 | `GET /prescriptions` | Returns ALL prescriptions (pharmacy gets ALL in system) |
| P3 | `GET /lab-reports` | Returns ALL patient lab reports |
| P4 | `GET /symptom-assessments` | Returns ALL patient assessments |
| P5 | `GET /medicine-reminders` | Returns ALL patient reminders |
| P6 | `GET /timeline` | Returns ALL patient timeline events |
| P7 | `GET /diagnostic-bookings` | Returns ALL patient bookings |
| P8 | `GET /doctors` | Returns ALL active doctors |
| P9 | `GET /diagnostic-centers` | Returns ALL active centers |
| P10 | `GET /admin/users` | Returns ALL users |
| P11 | `GET /admin/appointments` | Returns ALL appointments |
| P12 | `GET /admin/provider-applications` | Returns ALL applications |

### 2.6 MEDIUM — API / AI Resilience

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| A1 | **No rate limiting on ANY endpoint** | 🟡 HIGH | All routes |
| A2 | **No retry logic for Gemini calls** — single attempt, then fallback | 🟡 MEDIUM | `aiGateway.ts` |
| A3 | **Gemini timeout uses OLLAMA_TIMEOUT_MS constant name** (30s) | 🟢 LOW | `aiGateway.ts` L103 |
| A4 | **No request body size validation per route** — global 10MB limit | 🟡 MEDIUM | `app.ts` L40 |
| A5 | **LLM prompt size not bounded** — large inputs become large prompts | 🟡 MEDIUM | `aiGateway.ts` |
| A6 | **No duplicate-request protection** for AI endpoints | 🟡 MEDIUM | symptomAssessments, healthIntelligence |
| A7 | **providerUsed field always returns "ollama-llama3"** even when Gemini used | 🟢 LOW | `aiGateway.ts` L568, L805 |

### 2.7 MEDIUM — Frontend Performance

| # | Issue | Severity |
|---|-------|----------|
| F1 | **No lazy loading / code splitting** — all pages bundled together | 🟡 MEDIUM |
| F2 | **No error boundaries** around AI-dependent features | 🟡 MEDIUM |

### 2.8 LOW — Observability

| # | Issue | Severity |
|---|-------|----------|
| O1 | **Health endpoint doesn't verify database connectivity** | 🟢 LOW |
| O2 | **No request correlation IDs** beyond pino-http's auto id | 🟢 LOW |
| O3 | **`console.warn` used in production code** instead of logger | 🟢 LOW |

---

## 3. Scalability Bottlenecks (Ranked by Impact)

| Rank | Bottleneck | Impact at 50K users | Fix Difficulty |
|------|-----------|---------------------|----------------|
| 1 | **RAG full-table scan** | Every symptom check / AI query loads all chunks. With concurrent users, memory exhaustion and severe latency. | MEDIUM — pgvector migration |
| 2 | **N+1 queries everywhere** | API latency scales linearly with data volume. 100 appointments = 300 DB queries. | LOW — batch queries with joins/IN |
| 3 | **No database indexes** | Every `WHERE patient_id = X` is a sequential scan. Appointment/prescription lookups degrade with data growth. | LOW — add targeted indexes |
| 4 | **Admin stats loads all tables** | Single admin dashboard load = 7 full table scans | LOW — use COUNT queries |
| 5 | **No pagination** | Client receives unbounded result sets. Memory/bandwidth grows linearly. | LOW — add limit/offset |
| 6 | **No rate limiting** | Single abusive client can exhaust AI quota, DB connections, and server resources. | LOW — express-rate-limit |
| 7 | **Connection pool defaults** | 10 max connections is tight for 50K monthly users with concurrent peaks. | LOW — configuration |

---

## 4. Database Bottlenecks

### Missing Indexes (Immediate Priority)

| Table | Column(s) | Reason |
|-------|-----------|--------|
| appointments | patient_id | Filtered on every patient dashboard/list load |
| appointments | doctor_id | Filtered on every doctor dashboard/list load |
| appointments | status | Frequently filtered |
| appointments | appointment_date | Frequently filtered, sorted |
| prescriptions | patient_id | Filtered on every patient/pharmacy view |
| prescriptions | doctor_id | Filtered on every doctor view |
| lab_reports | patient_id | Filtered on every patient view |
| diagnostic_bookings | patient_id | Filtered on every patient view |
| diagnostic_bookings | diagnostic_center_id | Filtered on every center view |
| medicine_reminders | patient_id | Filtered on every patient view |
| timeline_events | patient_id | Filtered on every patient view |
| timeline_events | event_date | Sorted on every timeline view |
| symptom_assessments | patient_id | Filtered on every patient view |
| provider_applications | status | Admin filtering |
| provider_applications | email | Duplicate check lookups |
| knowledge_chunks | document_id | Join/filter during RAG |

---

## 5. AI / Gemini Bottlenecks

| # | Bottleneck | Impact |
|---|-----------|--------|
| 1 | **No retry with backoff** for Gemini 429/503 errors | Single point of failure for all AI features |
| 2 | **30-second timeout** is reasonable but no circuit breaker for sustained failures | Cascading slow responses |
| 3 | **RAG fetches all chunks per request** | Memory pressure under concurrent AI requests |
| 4 | **No response caching** for identical RAG queries | Redundant embedding generation |
| 5 | **Gemini free tier: 1,500 req/day** | ~50 req/day budget at 50K monthly users. Need quota awareness. |

---

## 6. Security Issues Summary

| Priority | Count | Category |
|----------|-------|----------|
| 🔴 CRITICAL | 8 | IDOR vulnerabilities, secrets in repo, RAG memory loading |
| 🟡 HIGH | 5 | Open CORS, no rate limiting, no security headers, pharmacy data leak |
| 🟡 MEDIUM | 3 | Hardcoded admin, error leakage |
| 🟢 LOW | 3 | Observability gaps |

---

## 7. Existing Features That MUST NOT Be Affected

1. ✅ Patient symptom assessment 2-stage flow (follow-up questions → assessment)
2. ✅ Emergency keyword detection and routing
3. ✅ Appointment CRUD for patients and doctors
4. ✅ Prescription management with doctor/pharmacy roles
5. ✅ Lab report creation with AI analysis
6. ✅ Medicine reminder CRUD
7. ✅ Timeline event tracking
8. ✅ Diagnostic center booking flow
9. ✅ Provider application submission and admin review workflow
10. ✅ Admin dashboard with stats
11. ✅ User onboarding flow (role selection → profile creation)
12. ✅ Clerk authentication (login/register/session)
13. ✅ Health intelligence (summaries, episodes, lab trends, AI assistant)
14. ✅ OCR text extraction
15. ✅ RAG medical knowledge search (functionality, not implementation)
16. ✅ Gemini + Ollama dual-provider architecture
17. ✅ Heuristic fallback engine

---

## 8. Recommended Changes (Prioritized)

### Phase 2 — Database (LOW RISK)
1. Add all missing indexes
2. Fix N+1 queries with batch queries / joins
3. Add pagination to all list endpoints
4. Configure connection pool
5. Replace RAG JSONB storage with pgvector
6. Add graceful shutdown
7. Convert admin stats to COUNT queries

### Phase 3 — Backend (MEDIUM RISK)
1. Add rate limiting (express-rate-limit)
2. Fix IDOR vulnerabilities (ownership checks)
3. Add security headers (helmet)
4. Restrict CORS
5. Add Gemini retry with exponential backoff
6. Enhance health check with DB connectivity
7. Add request body validation per route
8. Replace console.warn with logger
9. Bound LLM prompt sizes
10. Fix providerUsed field

### Phase 4 — Frontend (LOW RISK)
1. Add React.lazy / code splitting for heavy pages
2. Add error boundaries

### Phase 5 — Security (HIGH IMPORTANCE)
1. Verify all secrets removed from repo history
2. IDOR verification across all endpoints
3. Restrict pharmacy prescription access

---

## 9. Changes That Are NOT Necessary

| Proposed Change | Why NOT Needed |
|----------------|----------------|
| Migrate from Express to Fastify | Express 5 is adequate for 50K monthly users |
| Introduce Redis | Application-level caching is sufficient at this scale |
| Introduce Kubernetes | Single Render web service is adequate |
| Introduce message queues (Kafka/RabbitMQ) | No async processing requirements |
| Migrate from Drizzle to Prisma | Drizzle is performing well |
| Replace Clerk auth | Clerk is a solid managed auth solution |
| Redesign the UI | UI is functional and complete |
| Switch from PostgreSQL | PostgreSQL is the right choice |
| Introduce microservices | Monolith is appropriate at this scale |
| Add Elasticsearch | PostgreSQL full-text search or pgvector is sufficient |

---

## 10. Risk Assessment of Every Proposed Modification

| Change | Risk Level | Mitigation |
|--------|-----------|------------|
| Add database indexes | 🟢 LOW | Non-destructive, additive |
| Fix N+1 queries | 🟢 LOW | Replace individual queries with batch, verify response shape |
| Add pagination | 🟡 LOW-MEDIUM | Must ensure frontend handles paginated responses |
| pgvector migration | 🟡 MEDIUM | Requires re-ingestion of embeddings, schema change |
| Add rate limiting | 🟢 LOW | Additive middleware, configurable |
| Fix IDOR | 🟡 MEDIUM | Must test that authorized access still works |
| Add security headers | 🟢 LOW | Additive, no behavior change |
| Restrict CORS | 🟡 MEDIUM | Must configure correct production domains |
| Gemini retry logic | 🟢 LOW | Must prevent infinite retry loops |
| Connection pool config | 🟢 LOW | Configuration-only change |
| Frontend code splitting | 🟢 LOW | Standard Vite/React patterns |
| Graceful shutdown | 🟢 LOW | Additive, no functional impact |

# ArogyaGenie — Current Architecture Documentation

> **Audit Date:** 2026-08-13  
> **Auditor:** AI Production Hardening Agent (Phase 1)  
> **Codebase State:** Working full-stack healthcare application

---

## 1. High-Level Overview

ArogyaGenie is a full-stack healthcare web application providing:
- Patient symptom assessment via AI (Gemini / Ollama)
- Doctor, pharmacy, and diagnostic center portals
- Appointment management
- Prescription management
- Lab report management with AI analysis
- Medicine reminders
- Health timeline
- Health intelligence / longitudinal AI summaries
- RAG (Retrieval-Augmented Generation) over medical knowledge
- Admin portal for user/provider management

---

## 2. Repository Structure

```
Arogya-Genie/                        # Root — pnpm workspace monorepo
├── artifacts/
│   ├── api-server/                   # Express.js backend API
│   ├── arogyagenie/                  # React + Vite frontend
│   └── mockup-sandbox/              # Design sandbox (not production)
├── lib/
│   ├── db/                           # @workspace/db — Drizzle ORM + PostgreSQL schema
│   ├── api-spec/                     # OpenAPI specification (orval)
│   ├── api-zod/                      # Shared Zod schemas
│   └── api-client-react/             # Generated React Query API client
├── scripts/                          # DB seed, reset, admin grant, RAG ingestion
├── docs/                             # Documentation
├── .env                              # Environment variables (MUST NOT be committed)
├── .env.example                      # Template (safe for version control)
├── pnpm-workspace.yaml               # Workspace config with catalog versions
├── package.json                      # Root workspace scripts
└── tsconfig.base.json                # Shared TypeScript config
```

---

## 3. Frontend Architecture

| Aspect | Detail |
|--------|--------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 7 |
| **Styling** | Tailwind CSS 4 + Radix UI + shadcn/ui components |
| **Routing** | `wouter` (lightweight client-side router) |
| **State / Data** | TanStack React Query v5 (via generated `@workspace/api-client-react`) |
| **Auth** | `@clerk/react` (frontend SDK) |
| **Dev Server** | Vite dev server with proxy to `http://127.0.0.1:3000/api` |

### Frontend Pages

| Role | Pages |
|------|-------|
| **Public** | Landing, Auth, Onboarding, 404 |
| **Patient** | Dashboard, Appointments, Doctors, Prescriptions, LabReports, MedicineReminders, DiagnosticBookings, SymptomCheck, Timeline, Profile |
| **Doctor** | Dashboard, Appointments, Patients, Prescriptions, PrescribeModal, Profile |
| **Admin** | Dashboard, Users, Doctors, Patients, Appointments, Pharmacies, DiagnosticCenters, PendingApplications, Settings |
| **Diagnostic Center** | Dashboard, Profile, Bookings |
| **Pharmacy** | Dashboard, Profile, Prescriptions |
| **Provider** | Application status page |

---

## 4. Backend Architecture

| Aspect | Detail |
|--------|--------|
| **Framework** | Express 5 (TypeScript, ESM) |
| **Build** | esbuild (single ESM bundle → `dist/index.mjs`) |
| **Auth Middleware** | Clerk Express SDK (`@clerk/express`) |
| **Logging** | Pino + pino-http (structured JSON in production, pretty in dev) |
| **ORM** | Drizzle ORM (`drizzle-orm/node-postgres`) |
| **Database** | PostgreSQL (pg Pool) |
| **API Prefix** | `/api/*` |
| **CORS** | `cors({ credentials: true, origin: true })` — OPEN to all origins |
| **Body Limit** | 10 MB (`express.json({ limit: "10mb" })`) |

### API Routes (18 route files)

| Route File | Base Path | Auth | Notable |
|------------|-----------|------|---------|
| health | `/api/health`, `/api/healthz` | None | Returns `{ status: "ok" }` |
| users | `/api/users/me`, `/api/users/me/onboard` | requireAuth | JIT user provisioning |
| doctors | `/api/doctors`, `/api/doctors/me/*` | Mixed | Public listing + auth'd operations |
| appointments | `/api/appointments` | requireAuth | Patient scoped |
| prescriptions | `/api/prescriptions` | requireAuth + role | Role-dependent query logic |
| labReports | `/api/lab-reports` | requireAuth | AI analysis on creation |
| diagnosticCenters | `/api/diagnostic-centers` | Mixed | Public listing + auth'd profile |
| diagnosticBookings | `/api/diagnostic-bookings` | requireAuth | Patient scoped |
| medicineReminders | `/api/medicine-reminders` | requireAuth | CRUD |
| timeline | `/api/timeline` | requireAuth | Patient scoped |
| symptomAssessments | `/api/symptom-assessments` | requireAuth | AI-powered 2-stage flow |
| pharmacies | `/api/pharmacies/me/*` | requireAuth + role | Pharmacy portal |
| admin | `/api/admin/*` | requireAuth + admin role | Stats, user management |
| medicalKnowledge | `/api/medical-knowledge/search` | **NONE** | Public RAG search |
| ocr | `/api/ocr/extract` | requireAuth | Text extraction |
| healthIntelligence | `/api/patients/me/*`, `/api/ai/*` | requireAuth | Longitudinal AI |
| providerApplications | `/api/provider-applications` | Mixed | Public submission + admin review |

### Services (7 files)

| Service | Responsibility |
|---------|---------------|
| `aiGateway.ts` | Unified LLM interface (Gemini/Ollama), symptom assessment, lab report analysis, heuristic fallbacks |
| `ragService.ts` | Medical knowledge vector search — loads ALL chunks from DB, computes cosine similarity in Node.js |
| `ollamaEmbeddingService.ts` | Dual-provider embedding generation (Gemini text-embedding-004 / Ollama nomic-embed-text) |
| `documentIngestionService.ts` | Medical document chunking + embedding pipeline |
| `patientContextBuilder.ts` | Aggregates patient health data across 8 tables for AI prompts |
| `longitudinalAIService.ts` | Health summaries, lab trends, doctor briefings, health assistant |
| `ocrService.ts` | Local text-based OCR parsing (no actual image OCR — simulated) |

---

## 5. Database Architecture

**Engine:** PostgreSQL (hosted on Render)  
**ORM:** Drizzle ORM with `pg` Pool driver  
**Schema Management:** `drizzle-kit push` (schema push, no migration files)

### Tables (16)

| Table | Key Columns | Foreign Keys | Indexes |
|-------|------------|--------------|---------|
| `users` | id (serial PK), clerk_id (unique), email (unique), role, status | — | clerk_id unique, email unique |
| `doctors` | id (serial PK), user_id (unique), specialty, status | user_id → users(id) implied | user_id unique |
| `appointments` | id, patient_id, doctor_id, appointment_date, status | **None declared** | **None** |
| `prescriptions` | id, patient_id, doctor_id, appointment_id, status | **None declared** | **None** |
| `lab_reports` | id, patient_id, diagnostic_center_id, test_date, status | **None declared** | **None** |
| `diagnostic_centers` | id, user_id (unique), name, status | — | user_id unique |
| `diagnostic_bookings` | id, patient_id, diagnostic_center_id, booking_date, status | **None declared** | **None** |
| `medicine_reminders` | id, patient_id, is_active | **None declared** | **None** |
| `timeline_events` | id, patient_id, event_type, event_date | **None declared** | **None** |
| `symptom_assessments` | id, patient_id, symptoms, urgency_level | **None declared** | **None** |
| `pharmacies` | id, user_id (unique), name, status | — | user_id unique |
| `health_episodes` | id, patient_id | patient_id → users(id) ON DELETE CASCADE | — |
| `patient_ai_summaries` | id, patient_id, summary_type | patient_id → users(id) ON DELETE CASCADE | — |
| `knowledge_documents` | id, document_id (unique) | — | document_id unique |
| `knowledge_chunks` | id, document_id, chunk_index, embedding (JSONB) | **None declared** | **None** |
| `provider_applications` | id, type, status, user_id, email | **None declared** | **None** |

---

## 6. AI / Gemini Integration

- **Primary LLM:** Gemini 1.5 Flash (production, when `GEMINI_API_KEY` is set)
- **Fallback LLM:** Ollama llama3:8b (local development)
- **Embedding:** Gemini text-embedding-004 (production) / Ollama nomic-embed-text (local)
- **Vector Dimensions:** 768 (both providers)
- **AI Features:**
  - Symptom follow-up question generation
  - Structured symptom assessment with RAG
  - Lab report AI analysis
  - Health summaries
  - Doctor patient briefings
  - Longitudinal health assistant (Q&A)
- **Heuristic Fallback:** Built-in deterministic engine when LLM fails

---

## 7. RAG Architecture (CRITICAL BOTTLENECK)

**Current implementation:**
1. User query → generate embedding via Gemini/Ollama
2. **Load ENTIRE `knowledge_chunks` table** into Node.js memory
3. Compute cosine similarity in JavaScript for every chunk
4. Sort and return top-K results

**Embedding storage:** JSONB column (not a vector type)  
**No vector index exists** — full table scan on every RAG query.

---

## 8. Authentication & Authorization

- **Provider:** Clerk (managed auth service)
- **Frontend:** `@clerk/react` with proxy through backend
- **Backend:** `@clerk/express` middleware → `requireAuth` custom middleware
- **JIT Provisioning:** User records auto-created on first authenticated request
- **Role System:** `patient`, `doctor`, `diagnostic_center`, `pharmacy`, `admin`
- **Status System:** `pending`, `active`, `suspended`, `rejected`
- **Admin Detection:** Hardcoded admin email (`arogyageniehealthtech.tech@gmail.com`)

---

## 9. Connection Pool

**Current configuration:**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
});
```

- **No max connections configured** (pg default: 10)
- **No idle timeout**
- **No connection timeout**
- **No query timeout**
- **No graceful shutdown**

---

## 10. Build & Deployment

- **Frontend Build:** `vite build` → static assets in `dist/public`
- **Backend Build:** esbuild → single `dist/index.mjs`
- **Schema Deployment:** `pnpm run db:push` (drizzle-kit push)
- **RAG Ingestion:** `pnpm run rag:ingest`
- **Target Platform:** Render (PostgreSQL + Web Services)

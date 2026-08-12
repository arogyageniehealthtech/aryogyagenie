# System Architecture - ArogyaGenie

## 1. Overview Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|  React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + shadcn/ui + Lucide Icons       |
|  Client Routing: Wouter 3 | Auth Widget: Clerk (@clerk/react)                    |
|  State & Query Caching: TanStack React Query v5                                   |
+-----------------------------------------------------------------------------------+
                                       |
                                       | HTTPS (JSON REST API)
                                       v
+-----------------------------------------------------------------------------------+
|                                 BACKEND API SERVER                                |
|  Express 5 + TypeScript (Node 24)                                                 |
|  Middlewares: requireAuth (Clerk JWT Validation & JIT User Sync), RBAC Middleware |
+-----------------------------------------------------------------------------------+
          |                                       |
          | SQL (Drizzle ORM)                     | HTTP REST
          v                                       v
+-----------------------+              +----------------------------------+
|    DATABASE LAYER     |              |           AI GATEWAY             |
| PostgreSQL Database   |              | Express aiGateway Service        |
| Drizzle ORM (12 Tables|              | Primary: Local Ollama (llama3:8b)|
|  + drizzle-zod)       |              | Fallback: Heuristic Engine       |
+-----------------------+              +----------------------------------+
```

---

## 2. Monorepo Package Structure

ArogyaGenie uses **pnpm workspaces** to separate concerns across independent packages:

```
Arogya-Genie/
├── artifacts/
│   ├── arogyagenie/       # React 19 Frontend Web Application (Vite dev server)
│   ├── api-server/        # Express 5 Backend API Server & AI Gateway
│   └── mockup-sandbox/    # UI Component Sandbox
├── lib/
│   ├── db/                # PostgreSQL Drizzle ORM schemas & database client
│   ├── api-spec/          # OpenAPI 3.0 YAML specification & Orval configuration
│   ├── api-client-react/  # Auto-generated React Query hooks (via Orval)
│   └── api-zod/           # Auto-generated Zod validation schemas (via Orval)
├── docs/                  # Human & Machine Developer Documentation
└── scripts/               # Helper build and post-merge scripts
```

---

## 3. Core Component Architecture

### A. Frontend Layer (`@workspace/arogyagenie`)
- **Routing**: Client-side routing managed by **Wouter** in `App.tsx`.
- **Auth Guard**: `<ProtectedRoute>` wrapper validates Clerk authentication state and user role via `useGetMe()` before rendering protected role routes.
- **API Integration**: Frontend components consume backend endpoints via auto-generated React Query hooks in `@workspace/api-client-react` (`useGetPatientDashboard`, `useListAppointments`, `useCreateSymptomAssessment`, etc.).

### B. Backend API Layer (`@workspace/api-server`)
- **Express Server**: Express 5 application configured in `app.ts` and `index.ts`.
- **Auth & Provisioning Middleware**: `requireAuth` validates incoming Clerk session tokens, extracts Clerk User ID, and auto-provisions a corresponding database record in `usersTable` on first login (Just-In-Time provisioning).
- **Role Control**: `requireRole(["doctor"])` ensures role-restricted endpoints reject unauthorized access attempts.

### C. Database & ORM Layer (`@workspace/db`)
- **Database Engine**: PostgreSQL connected via Drizzle ORM driver.
- **Schemas**: 12 structured schemas in `lib/db/src/schema/`:
  - User & Profiles: `usersTable`, `doctorsTable`, `pharmaciesTable`, `diagnosticCentersTable`
  - Patient Workflow: `symptomAssessmentsTable`, `appointmentsTable`, `prescriptionsTable`, `labReportsTable`, `diagnosticBookingsTable`, `medicineRemindersTable`, `timelineEventsTable`

### D. Code Generation Pipeline (`@workspace/api-spec`)
```
lib/api-spec/openapi.yaml (Source of Truth)
            |
            v  (npx pnpm --filter @workspace/api-spec run codegen)
   +--------+--------+
   |                 |
   v                 v
lib/api-client-react  lib/api-zod
(React Query Hooks)   (Zod Schemas)
```

---

## 4. AI Gateway & Model Architecture

```
Patient Initial Symptoms (POST /api/symptom-assessments/follow-up)
                       |
                       v
    Emergency Symptom Keyword Check (Precedence Layer)
       ├──> MATCH: Returns Immediate EMERGENCY Urgency & Guidance (Bypasses Follow-up & RAG)
       └──> NO MATCH: Fetches Patient Context + Prompts Ollama llama3:8b
                  ├──> Generates 3-5 Relevant Clinical Follow-up Questions
                  └──> Patient Submits Answers (POST /api/symptom-assessments)
                             |
                             v
                  Vector RAG Semantic Retrieval (nomic-embed-text)
                             |
                             v
                  Ollama llama3:8b Structured Assessment Generation
                             ├──> SUCCESS: Returns JSON Assessment & Specialty Recommendation
                             └──> TIMEOUT/FAIL: Invokes Structured Heuristic Fallback Engine
```

- **Two-Stage Workflow**:
  1. **Stage 1 (Follow-up Generation)**: Emergency check executes FIRST. If safe, AI inspects authorized patient profile data (Age, Gender, Conditions) to generate 3–5 targeted follow-up questions for missing context.
  2. **Stage 2 (Final Assessment & RAG Integration)**: Synthesizes complete symptom context + follow-up Q&A, queries PostgreSQL vector knowledge base using `nomic-embed-text` embeddings, and prompts `llama3:8b` for structured JSON output (`possibleConditions` with qualitative confidence & reasoning, `urgencyLevel`, `riskFactors`, `recommendedSpecialty`, `recommendedAction`, `disclaimer`, `sources`).
- **Doctor Referral Connection**: `recommendedSpecialty` (e.g. ENT, Cardiology, General Practice) links directly to doctor search (`/patient/doctors?specialty=...`) to recommend registered doctors without fabricating records.
- **Local AI Strategy**: Free local LLM triage using Ollama (`OLLAMA_URL`, defaulting to `http://localhost:11434`, model `llama3:8b`, embeddings `nomic-embed-text`).
- **Resilience**: Automatic fallback to deterministic heuristic rules ensures 100% API uptime even when Ollama is offline.
- **Medical Safety**: Emergency safety filter executes FIRST; medical safety disclaimer attached to all outputs.

---

## 5. Future Architecture Extensions

- **Prescription OCR Pipeline**: Tesseract / LayoutLM engine for parsing handwritten paper prescriptions into structured medication schemas.

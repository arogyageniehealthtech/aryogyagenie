# Project Changelog

All notable changes to the ArogyaGenie codebase are documented in this file.

---

## [1.9.0-provider-onboarding] - 2026-08-11

### Added
- **Provider Onboarding + Admin Approval Workflow**:
  - Created `provider_applications` database table (`providerApplicationsTable`) storing provider registrations, approval/rejection status (`PENDING`, `APPROVED`, `REJECTED`), specialty, contact details, review timestamps, and rejection reasons.
  - Implemented tailored registration forms for Doctors (with 18 medical specialties), Diagnostic Centers, and Pharmacies in `Onboarding.tsx`.
  - Configured submission notice: `"Application submitted successfully. Our team will review your details and contact you shortly. Portal access will be provided after approval."`.
  - Added Backend API endpoints: `POST /api/provider-applications`, `GET /api/provider-applications/me`, `GET /api/admin/provider-applications`, `POST /api/admin/provider-applications/:id/approve`, `POST /api/admin/provider-applications/:id/reject`.
  - Added Backend & Frontend authorization enforcement: PENDING and REJECTED providers are strictly blocked from accessing provider portals (`/doctor/*`, `/diagnostic/*`, `/pharmacy/*`).
  - Created `ProviderStatusPage.tsx` rendering pending/rejected notice to logged-in providers without active access.
  - Built `PendingApplications.tsx` in Admin Portal with `[View]`, `[Approve]`, and `[Reject]` actions, applicant contact info, specialty, address, and registration dates.
  - Added "Pending Applications" navigation link with badge to Admin Sidebar.
  - Preserved Patient registration and login flow without any changes.
  - Created automated test suite `providerOnboardingApproval.test.ts` — Passed 25/25 tests cleanly.

---

## [1.8.0-rag-health-assistant] - 2026-08-10

### Added
- **Real Local Vector RAG for AI Health Assistant**:
  - Connected `POST /api/ai/health-assistant` to real local Ollama services (`nomic-embed-text` embeddings + `llama3:8b` grounded generation).
  - Implemented PostgreSQL vector similarity search in `ragService.ts` (`searchMedicalKnowledge` with `DEFAULT_RAG_THRESHOLD = 0.58` and `DEFAULT_RAG_TOP_K = 5`).
  - Implemented relevance threshold filtering in `longitudinalAIService.ts` returning clean refusal (`usedRag: false`) when queries lack matching medical evidence (preventing hallucination).
  - Added medical guideline corpus documents: `HEMAT-002_iron_deficiency_anemia_guidelines.md` and `PULM-002_pneumonia_clinical_guidelines.md`.
  - Expanded `CARD-001` (Heart Attack Warning Signs) and `CARD-002` (Hypertension Classification).
  - Added `npm run rag:ingest` script executing medical knowledge base ingestion to PostgreSQL vector store.
  - Built interactive `HealthAssistantChat.tsx` component with message thread, prompt suggestions, expandable clinical evidence drawer with document title/publisher/section/page metadata, and emergency safety alert banner.
  - Embedded `HealthAssistantChat` on the Patient Dashboard page.
  - Created automated test suite `healthAssistantRag.test.ts` (16/16 passed) verifying real Ollama embedding generation, RAG queries for Anemia, Hypertension, Heart Attack, Pneumonia, fictional condition refusal (XYZ-123), cross-domain relevance filtering, and emergency safety precedence.

---

## [1.7.0-profile-sync] - 2026-08-09

### Added
- **Milestone 7 Completed — Prototype Hardening & Advanced Health Intelligence**:
  - Created `scripts/src/seed.ts`: Synthetic demo seed system populating interconnected test data across all 5 ecosystem roles (Patient, Doctor, Diagnostic Center, Pharmacy, Admin).
  - Created `artifacts/api-server/src/__tests__/m7Verification.test.ts`: Automated verification test suite covering emergency safety intercepts, RAG retrieval accuracy, OCR parsing, and RBAC authorization. Passed 8/8 tests.
  - Created `docs/PROTOTYPE_READINESS.md`: Official prototype readiness scorecard across 18 platform dimensions (`READY`).
  - Hardened emergency keyword regex in `aiGateway.ts` (adding stroke, loss of consciousness, fainting, coughing blood, anaphylaxis, severe allergic reaction).

### Verified
- Executed `npx pnpm run typecheck` across all 9 workspace projects — **Passed cleanly with 0 errors**.
- Executed `npx tsx artifacts/api-server/src/__tests__/m7Verification.test.ts` — **Passed 8/8 tests**.

---

## [1.5.0-milestone6] - 2026-08-09

### Added
- **Milestone 6 Completed — Longitudinal AI Health Intelligence Platform**:
  - Created Patient Health Context Layer, Longitudinal AI Summaries, Health Episode Grouping, Lab Result Trend Analysis, Doctor Consultation Briefings, and Context-Aware AI Health Assistant.

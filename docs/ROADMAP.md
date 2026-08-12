# ArogyaGenie Product Development Roadmap

---

## Milestone Status Overview

```
[Milestone 1: Patient Portal & AI Gateway] -------------> COMPLETED
[Milestone 2: Doctor Portal UI & Dashboard] ------------> NEXT (IN PROGRESS)
[Milestone 3: Diagnostic & Pharmacy Portals] -----------> PLANNED
[Milestone 4: Admin Portal & AI Report Analysis] -------> PLANNED
[Milestone 5: Medical RAG & Prescription OCR] -----------> PLANNED
```

---

## Milestone Details

### Milestone 1: Patient Portal & AI Gateway (`COMPLETED`)
- All 10 patient UI page components created in `src/pages/patient/`.
- All patient routes registered in Wouter router in `App.tsx`.
- Express AI Gateway implemented with local Ollama (`llama3:8b`) REST integration and fallback heuristics.
- Workspace typecheck (`npx pnpm run typecheck`) passing with 0 errors.

### Milestone 2: Doctor Portal UI & Dashboard (`NEXT`)
- Create `artifacts/arogyagenie/src/pages/doctor/` subpages (`Dashboard.tsx`, `Appointments.tsx`, `Patients.tsx`, `Profile.tsx`).
- Wire `/doctor/dashboard`, `/doctor/appointments`, `/doctor/patients`, `/doctor/profile` routes in `App.tsx`.
- Implement prescription issuance modal (`POST /api/prescriptions`).
- Update Sidebar navigation links for doctor role.

### Milestone 3: Diagnostic Center & Pharmacy Portals (`PLANNED`)
- Build Diagnostic Center Portal UI (`/diagnostic/dashboard`, test booking management, uploading lab test results).
- Build Pharmacy Portal UI (`/pharmacy/dashboard`, managing digital prescriptions, marking dispensed status).

### Milestone 4: Admin Portal & AI Lab Report Analysis (`PLANNED`)
- Build Admin Portal UI (`/admin/dashboard`, system stats, user role & status approval toggles).
- Build AI Lab Report Summary pipeline (`POST /api/lab-reports/:id/analyze`) in Express AI Gateway.

### Milestone 5: Medical RAG & Prescription OCR (`PLANNED`)
- Integrate local vector embeddings (`bge-large-en-v1.5`) and pgvector for RAG over clinical guidelines.
- Integrate OCR engine for parsing paper prescription images into structured medication items.

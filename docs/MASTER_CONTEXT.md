# Master Context - ArogyaGenie Project Overview

## 1. Product Vision

**ArogyaGenie** is an intelligent, unified AI-powered healthcare journey platform. It accompanies patients through every step of their end-to-end medical experience:

$$\text{Symptoms} \rightarrow \text{AI Assessment} \rightarrow \text{Urgency Level} \rightarrow \text{Doctor Recommendation} \rightarrow \text{Appointment} \rightarrow \text{Prescription} \rightarrow \text{Medicine} \rightarrow \text{Diagnostic Test} \rightarrow \text{Lab Report} \rightarrow \text{AI Report Summary} \rightarrow \text{Recovery} \rightarrow \text{Follow-up} \rightarrow \text{Lifelong Health Timeline}$$

Instead of isolated healthcare apps (booking apps vs pharmacy apps vs lab test apps), ArogyaGenie provides an integrated ecosystem bridging patients, doctors, diagnostic centers, pharmacies, and healthcare administrators.

---

## 2. Core Healthcare Workflow Loop

1. **Symptom Triage**: Patient describes symptoms via AI Symptom Checker. Local Ollama (`llama3:8b`) or rule-based fallback evaluates urgency (`LOW`, `MEDIUM`, `HIGH`, `EMERGENCY`) and suggests relevant specialties.
2. **Doctor Discovery & Booking**: Patient searches approved doctors by specialty/name and books an appointment (`in_person`, `video`, or `phone`).
3. **Clinical Consultation & Prescription**: Doctor conducts consultation and issues a digital prescription with medication dosages and instructions.
4. **Diagnostic Test Booking & Lab Reports**: Patient or doctor schedules lab tests with accredited diagnostic centers. Test reports are uploaded and processed for plain-language AI insights.
5. **Medication Adherence**: Prescription items generate active medicine reminders with dosage schedules.
6. **Unified Health Timeline**: All events automatically populate a longitudinal medical timeline for lifetime health record management.

---

## 3. Current Prototype Scope vs Long-Term Vision

### Current Prototype Scope (Phase 1)
- Complete patient portal with dashboard, doctor booking, prescription viewing, lab report management, diagnostic test booking, medicine reminders, symptom triage, medical profile, and unified health timeline.
- Express API backend serving 40+ endpoints with Drizzle ORM on PostgreSQL.
- Clerk authentication with role-based access control (`patient`, `doctor`, `diagnostic_center`, `pharmacy`, `admin`).
- AI Gateway integrating local Ollama (`llama3:8b`) with automatic heuristic fallback and safety disclaimers.

### Long-Term Vision
- Dedicated Provider Portals (Doctor, Diagnostic Center, Pharmacy, Hospital Support, Admin).
- Prescription OCR (optical character recognition for paper prescriptions).
- RAG over trusted medical knowledge bases (PubMed, clinical guidelines).
- Remote patient monitoring & IoT health device sync.
- Consent management & granular health record sharing.
- Multi-member family accounts & portable Health Passports.

---

## 4. Current Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Monorepo** | pnpm workspaces | Package management & workspace isolation |
| **Frontend Framework** | React 19 + TypeScript 5.9 | UI layer |
| **Build Tool** | Vite 7 | Fast dev server & bundling |
| **Routing** | Wouter 3 | Lightweight client-side routing |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Utility-first responsive design & UI primitives |
| **Icons** | Lucide React | Clean, modern medical icon system |
| **State & Data Fetching** | TanStack React Query v5 | Server state caching & invalidation |
| **Backend Framework** | Express 5 + TypeScript | REST API server |
| **Database** | PostgreSQL + Drizzle ORM | Relational data persistence & migrations |
| **Authentication** | Clerk (`@clerk/react`) | Auth, OAuth, session management |
| **API Contract & Specs** | OpenAPI 3.0 + Zod + Orval | Type-safe API spec & auto-generated React hooks |
| **AI Gateway** | Express `aiGateway` Service | Local Ollama REST API + heuristic fallback |

---

## 5. Important Business Rules

1. **Role Protection**: Endpoints and pages must strictly enforce roles (`patient`, `doctor`, `diagnostic_center`, `pharmacy`, `admin`). Unonboarded users are directed to `/onboarding`.
2. **Medical Safety & Disclaimers**: AI assessments are informational triage tools, NOT diagnostic medical advice. Every AI output MUST include standard medical safety disclaimers. Emergency symptom keywords MUST bypass standard LLM processing and trigger immediate `EMERGENCY` triage guidance.
3. **Data Integrity**: Deleting a medicine reminder or modifying an appointment status must strictly maintain patient ID ownership scoping.
4. **Timeline Integration**: Every major patient interaction (appointment, prescription, lab report, diagnostic booking, symptom assessment) generates or references an entry in the patient's unified medical timeline.

---

## 6. Design Principles

1. **Rich & Modern Aesthetics**: High visual contrast, subtle micro-animations (Framer Motion), glassmorphism cards, and clean typography (Inter font).
2. **Accessible Medical UI**: Color-coded urgency badges (`LOW`: green, `MEDIUM`: yellow, `HIGH`: orange, `EMERGENCY`: red). Clear empty states and loading skeletons.
3. **Zero Placeholders in Core Flow**: Live data bindings via generated React Query hooks (`useGetPatientDashboard`, `useListSymptomAssessments`, `useListAppointments`, etc.).

# 03-API-SCALABILITY.md — Backend API Scalability & Hardening

> **Phase:** 3 — Backend API Hardening  
> **Target:** 50,000 monthly users  
> **Status:** Complete ✅

---

## 1. High-Level API Architecture

The backend API server runs on Express 5 (TypeScript, ESM) compiled into a single production bundle via esbuild.

### Key API Enhancements in Phase 3:
1. **Multi-tier Rate Limiting:** Implemented global IP rate limiting and strict AI endpoint rate limiting via `express-rate-limit`.
2. **Security Headers & CORS Protection:** Integrated Helmet for HTTP security headers and environment-controlled CORS whitelisting.
3. **Complete IDOR Protection:** Added resource ownership and role verification across all single-resource endpoints (`/appointments/:id`, `/prescriptions/:id`, `/lab-reports/:id`, `/diagnostic-bookings/:id`, `/medicine-reminders/:id`).
4. **Gemini LLM Exponential Backoff Retry:** Added 2-stage retry logic with exponential backoff (`500ms`, `1000ms`) for transient Gemini 429/500/503 responses.
5. **Accurate Provider Telemetry:** Corrected `providerUsed` string returns to report `"gemini-1.5-flash"` when Gemini is active.
6. **Readiness Probe:** Added `/api/health/ready` probe verifying active database connection.
7. **Production Error Masking:** Masked internal server error stack traces in production environment responses.

---

## 2. API Endpoint Inventory & Protections

| Method | Path | Auth Required | Role Restrictions | Rate Limit Tier | IDOR Protected |
|--------|------|---------------|-------------------|-----------------|----------------|
| `GET` | `/api/health`, `/api/healthz` | No | None | Exempt | N/A |
| `GET` | `/api/health/ready` | No | None | Exempt | N/A |
| `GET` | `/api/appointments` | Yes | Patient | Global (300/15m) | Yes (Patient-scoped) |
| `GET` | `/api/appointments/:id` | Yes | Patient / Doctor / Admin | Global | ✅ Yes |
| `PATCH` | `/api/appointments/:id` | Yes | Patient / Doctor / Admin | Global | ✅ Yes |
| `GET` | `/api/prescriptions` | Yes | Patient / Doctor / Pharmacy | Global | Yes (Role-scoped) |
| `GET` | `/api/prescriptions/:id` | Yes | Patient / Doctor / Pharmacy / Admin | Global | ✅ Yes |
| `PATCH` | `/api/prescriptions/:id` | Yes | Doctor / Pharmacy / Admin | Global | ✅ Yes |
| `GET` | `/api/lab-reports` | Yes | Patient | Global | Yes (Patient-scoped) |
| `GET` | `/api/lab-reports/:id` | Yes | Patient / Center / Doctor / Admin | Global | ✅ Yes |
| `POST` | `/api/lab-reports/:id/analyze` | Yes | Patient / Center / Doctor / Admin | Strict AI (30/15m) | ✅ Yes |
| `PATCH` | `/api/lab-reports/:id` | Yes | Patient / Center / Doctor / Admin | Global | ✅ Yes |
| `GET` | `/api/diagnostic-bookings` | Yes | Patient | Global | Yes (Patient-scoped) |
| `PATCH` | `/api/diagnostic-bookings/:id` | Yes | Patient / Center / Admin | Global | ✅ Yes |
| `GET` | `/api/medicine-reminders` | Yes | Patient | Global | Yes (Patient-scoped) |
| `PATCH` | `/api/medicine-reminders/:id` | Yes | Patient / Admin | Global | ✅ Yes |
| `DELETE` | `/api/medicine-reminders/:id` | Yes | Patient / Admin | Global | ✅ Yes |
| `POST` | `/api/symptom-assessments/follow-up` | Yes | Patient | Strict AI (30/15m) | N/A |
| `POST` | `/api/symptom-assessments` | Yes | Patient | Strict AI (30/15m) | N/A |
| `POST` | `/api/ai/health-assistant` | Yes | Patient | Strict AI (30/15m) | N/A |
| `POST` | `/api/ocr/extract` | Yes | Authenticated | Strict AI (30/15m) | N/A |
| `GET` | `/api/medical-knowledge/search` | No | Public | Strict AI (30/15m) | N/A |

# 04-SECURITY-HARDENING.md — Security Hardening Documentation

> **Phase:** 3 — Backend API Hardening  
> **Target:** 50,000 monthly users  
> **Status:** Complete ✅

---

## 1. Overview of Security Fixes

### 1.1 IDOR Vulnerability Resolution
Prior to Phase 3, single-resource endpoints accepted record IDs (`:id`) without verifying whether the requesting user owned or was authorized to access the record.

**Fix Implemented:** Added explicit ownership and role verification across all single-resource endpoints:
- `GET /appointments/:id` & `PATCH /appointments/:id`: Verifies requesting user is the patient (`patientId === req.userId`), assigned doctor (`doctorId === doctorRow.id`), or an admin.
- `GET /prescriptions/:id` & `PATCH /prescriptions/:id`: Verifies requesting user is the patient, issuing doctor, authorized pharmacy, or admin.
- `GET /lab-reports/:id`, `PATCH /lab-reports/:id`, `POST /lab-reports/:id/analyze`: Verifies patient ownership, diagnostic center link, doctor access, or admin.
- `PATCH /diagnostic-bookings/:id`: Verifies patient ownership, diagnostic center link, or admin.
- `PATCH /medicine-reminders/:id` & `DELETE /medicine-reminders/:id`: Verifies patient ownership (`patientId === req.userId`) or admin.

Un-authorized attempts return `403 Forbidden` with `{ error: "Access denied..." }`.

---

## 2. HTTP Security Headers (Helmet)

Integrated `helmet` middleware in `app.ts`:
- `X-Frame-Options`: Protection against clickjacking
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing
- `X-XSS-Protection`: Enables browser XSS filters
- `Strict-Transport-Security` (HSTS): Enforces HTTPS in production
- `X-DNS-Prefetch-Control`: Disabled DNS prefetching
- Configured `contentSecurityPolicy: false` and `crossOriginEmbedderPolicy: false` to ensure Clerk authentication widgets and CDN scripts operate without interference.

---

## 3. Environment-Aware CORS Protection

Updated CORS middleware in `app.ts`:
- Accepts comma-separated list of production origins via `process.env.ALLOWED_ORIGINS`.
- Rejects unwhitelisted origins with `403 Forbidden / CORS origin not allowed`.
- Allows non-browser server-to-server requests (no `Origin` header).
- In development/staging without `ALLOWED_ORIGINS` set, safely reflects request origin.

---

## 4. Production Error Masking

In `app.ts` global error handler:
- HTTP status `500` errors in `production` environment return generic `"Internal Server Error"` to client.
- Complete error details, stack traces, and SQL error details are logged server-side via Pino structured logger.
- 4xx client errors preserve helpful error messages.

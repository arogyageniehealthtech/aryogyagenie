# 08-MONITORING-AND-LOGGING.md — Monitoring & Logging Documentation

> **Phase:** 3 — Backend API Hardening  
> **Target:** 50,000 monthly users  
> **Status:** Complete ✅

---

## 1. Logging Architecture

ArogyaGenie uses `pino` and `pino-http` for structured JSON logging:

- **Production Mode (`NODE_ENV=production`):** Outputs raw JSON logs to `stdout` compatible with Render Log Streams, Datadog, or AWS CloudWatch.
- **Development Mode (`NODE_ENV=development`):** Uses `pino-pretty` for human-readable colorized console logs.

---

## 2. Health & Monitoring Probes

| Endpoint | Type | Verification Action | Expected Response |
|----------|------|--------------------|-------------------|
| `GET /api/health` | Liveness | Basic HTTP check | `{ "status": "ok" }` |
| `GET /api/healthz` | Liveness | Basic HTTP check | `{ "status": "ok" }` |
| `GET /api/health/ready` | Readiness | Active SQL query (`SELECT 1`) | `{ "status": "ready", "database": "connected" }` |

---

## 3. Log Redaction & Security

Pino logger in `lib/logger.ts` automatically redacts sensitive headers and fields:
- `authorization` / Bearer tokens
- `cookie` headers / session tokens
- Sensitive medical payloads

---

## 4. Log Inspection Commands (Render CLI / Local)

```bash
# Filter error logs in production log stream
pnpm run start | grep '"level":50'

# Inspect HTTP response status codes
pnpm run start | grep '"statusCode":'
```

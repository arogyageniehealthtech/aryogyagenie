# 06-RATE-LIMITING.md — Rate Limiting Architecture Documentation

> **Phase:** 3 — Backend API Hardening  
> **Target:** 50,000 monthly users  
> **Status:** Complete ✅

---

## 1. Overview

Rate limiting is implemented via `express-rate-limit` in `middlewares/rateLimiter.ts` to protect system resources, database connections, and AI API quotas against DDoS attacks, automated scrapers, and client loops.

---

## 2. Rate Limiting Tiers

| Tier | Middleware | Window | Default Max Requests | Target Endpoints | HTTP Status |
|------|------------|--------|----------------------|------------------|-------------|
| **Global API** | `globalRateLimiter` | 15 minutes | 300 / IP | `/api/*` (Excludes `/api/health*`) | `429 Too Many Requests` |
| **Strict AI** | `strictAiRateLimiter` | 15 minutes | 30 / IP | `/api/symptom-assessments*`, `/api/ai/health-assistant`, `/api/ocr/extract`, `/api/lab-reports/:id/analyze`, `/api/medical-knowledge/search` | `429 Too Many Requests` |

---

## 3. Configuration & Environment Overrides

Rate limits can be customized without code changes via environment variables:

```env
# Global API Max Requests per 15 minutes (default: 300)
RATE_LIMIT_GLOBAL_MAX=300

# Strict AI Max Requests per 15 minutes (default: 30)
RATE_LIMIT_AI_MAX=30
```

---

## 4. Response Format

When a client exceeds the allowed request limit, the server responds with:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 900
RateLimit-Limit: 30
RateLimit-Remaining: 0
RateLimit-Reset: 1770976500

{
  "error": "AI rate limit reached. You have made too many AI requests. Please wait a few minutes before trying again."
}
```

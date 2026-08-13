# API & AI Rate Limiting Architecture

## 1. Overview & Strategy

To protect API availability, prevent Google Gemini API quota exhaustion, and mitigate DDoS or automated script abuse for ~50,000 monthly users, rate limiting is configured at two operational tiers:

1. **Global API Rate Limiting** (`globalRateLimiter`):
   - Applied across `/api/*` routes.
   - Enforces a baseline limit of `300` requests per 15 minutes per user/IP.
   - Bypassed only for health check probes (`/health`, `/healthz`, `/health/ready`).

2. **Strict AI Rate Limiting** (`strictAiRateLimiter`):
   - Applied on compute-intensive AI endpoints (`/api/symptoms/assess`, `/api/health-intelligence`, `/api/lab-reports/:id/analyze`).
   - Enforces a strict limit of `30` requests per 15 minutes per user/IP (`RATE_LIMIT_AI_MAX`).
   - Prevents quota drain and runaway LLM costs.

---

## 2. Key Generation & Identification

Unlike basic IP-only limiters:
- **Authenticated Requests**: Use `user_${userId}` as the rate limit key. Multiple devices used by the same authenticated user share the rate bucket.
- **Unauthenticated Traffic**: Falls back to `req.ip` or socket IP address.

---

## 3. Environment Variable Configuration

```env
# Global API request limit per 15-minute window
RATE_LIMIT_GLOBAL_MAX=300

# Strict AI endpoint limit per 15-minute window
RATE_LIMIT_AI_MAX=30
```

---

## 4. Response & Header Protocol

When a client breaches rate thresholds:
- **HTTP Status Code**: `429 Too Many Requests`
- **Response Headers**:
  - `RateLimit-Limit`: Maximum requests permitted per window
  - `RateLimit-Remaining`: Remaining request tokens in current window
  - `RateLimit-Reset`: Time in seconds until bucket resets
- **JSON Error Payload**:
  ```json
  {
    "error": "AI rate limit reached. You have made too many AI requests. Please wait a few minutes before trying again."
  }
  ```

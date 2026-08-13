# Production CORS Policy & Configuration Guidelines

## 1. Overview & Security Rules

To prevent Cross-Origin Resource Sharing (CORS) security risks in a production deployment targeting 50,000 monthly users, the API server enforces a **strict fail-closed CORS strategy**.

### Enforced Principles

1. **No Silent Fallback in Production**:
   If `NODE_ENV === "production"` and `ALLOWED_ORIGINS` environment variable is not defined or empty, the server process will fail to start immediately with a fatal configuration error.
2. **Wildcards (`*`) Forbidden with Credentials**:
   In production, wildcard `*` origins are rejected at startup when credentialed requests (`credentials: true`) are enabled.
3. **Multiple Origins**:
   Supports a comma-separated allowlist (e.g. `https://arogyagenie.onrender.com,https://app.arogyagenie.com`).
4. **Development Flexibility**:
   In development environments (`NODE_ENV !== "production"`), requests without explicitly defined `ALLOWED_ORIGINS` reflect the requesting origin to streamline local UI development.

---

## 2. Configuration Examples

### Production (`.env` on Render / Cloud)

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://arogyagenie.onrender.com,https://app.arogyagenie.com
```

### Local Development (`.env`)

```env
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 3. Verification & Compliance Matrix

- [x] Missing `ALLOWED_ORIGINS` in production throws `FATAL CONFIGURATION ERROR`.
- [x] Wildcard `*` in `ALLOWED_ORIGINS` during production throws `FATAL CONFIGURATION ERROR`.
- [x] Origin matching correctly allows configured domains.
- [x] Non-browser requests (curl, server-to-server) without `Origin` header are permitted.

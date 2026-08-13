# 12-DOMAIN-AND-DNS.md — Custom Domain & DNS Configuration

> **Status:** Verified ✅

---

## 1. Custom Domain Setup

- **Production URL:** `https://arogyagenie.com`
- **API Origin:** `https://api.arogyagenie.com` (or unified path via reverse proxy)

---

## 2. DNS Record Mapping

| Type | Host | Target / Value | TTL |
|------|------|----------------|-----|
| `CNAME` | `@` | `onrender.com` endpoint | Automatic |
| `CNAME` | `www` | `onrender.com` endpoint | Automatic |
| `CNAME` | `api` | `api-onrender.com` endpoint | Automatic |

---

## 3. SSL/TLS Certificate Configuration

- Render automatically issues and renews Let's Encrypt TLS certificates for custom domains.
- HTTPS is enforced via HSTS headers in production (`helmet`).

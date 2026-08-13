# 11-RENDER-DEPLOYMENT.md — Deployment Guide (Render / Cloud Platform)

> **Platform:** Render (Web Service + Managed PostgreSQL)  
> **Status:** Verified ✅

---

## 1. Deploying Managed PostgreSQL

1. Create a **Managed PostgreSQL** instance on Render (Standard tier recommended for 50,000 monthly users).
2. Copy the Internal Database URL into `DATABASE_URL`.

---

## 2. Deploying Backend Web Service

1. Create a **Web Service** on Render connected to your Git repository.
2. **Environment:** Node.js
3. **Build Command:** `pnpm run build`
4. **Start Command:** `pnpm run start`
5. Set Environment Variables in Render Dashboard:
   - `DATABASE_URL`
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `GEMINI_API_KEY`
   - `ALLOWED_ORIGINS` (`https://yourdomain.com`)
   - `NODE_ENV=production`

---

## 3. Health Checks & Zero-Downtime Deploys

- Set **Health Check Path** in Render Settings to: `/api/health/ready`
- Render sends `SIGTERM` on redeploys; backend gracefully drains DB pool within 10 seconds.

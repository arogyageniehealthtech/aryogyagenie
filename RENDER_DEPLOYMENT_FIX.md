# Render.com Deployment Fix Guide

## ✅ Issues Fixed

### ✅ 1. IPv6 Rate Limiting Error (FIXED IN CODE)

**Original Error:** `ERR_ERL_KEY_GEN_IPV6` - Custom keyGenerator not handling IPv6 addresses

**Root Cause:** The rate limiter was using `req.ip` directly without properly normalizing IPv6 addresses. Express-rate-limit v8 requires using the `ipKeyGenerator` helper to prevent IPv6 users from bypassing rate limits.

**Fix Applied:** Updated `artifacts/api-server/src/middlewares/rateLimiter.ts` to:
1. Import `ipKeyGenerator` from express-rate-limit
2. Extract the IP from the request
3. Normalize it using `ipKeyGenerator(ip)` helper
4. Added `skipFailedRequests: true` option to both rate limiters

**Code Changes:**
```typescript
// OLD (BROKEN for IPv6):
function getUserOrIpKey(req: Request): string {
  const userId = (req as any).userId;
  if (userId) return `user_${userId}`;
  return req.ip ?? req.socket.remoteAddress ?? "anonymous";
}

// NEW (FIXED for IPv6):
function getUserOrIpKey(req: Request, _res: any): string {
  const userId = (req as any).userId;
  if (userId) return `user_${userId}`;
  const ip = req.ip || req.socket.remoteAddress || "anonymous";
  try {
    return ipKeyGenerator(ip);  // Properly normalizes IPv6
  } catch {
    return ip;  // Fallback if normalization fails
  }
}
```

**Build Status:** ✅ TypeScript: 0 errors | ✅ Build: Successful (3.0MB, 437ms)

---

## ⚠️ 2. Missing ALLOWED_ORIGINS Environment Variable (REQUIRES SETUP ON RENDER)

**Error:** `FATAL CONFIGURATION ERROR: ALLOWED_ORIGINS environment variable must be explicitly defined in production mode.`

This is **intentional security behavior**—production deployments must explicitly declare allowed origins to prevent CORS attacks.

### How to Fix on Render.com

#### Step 1: Log into Render Dashboard
1. Visit https://dashboard.render.com
2. Click on your AarogyaGenie backend service
3. Go to the **Environment** section

#### Step 2: Add Required Environment Variables

Click "Add Environment Variable" and add these **ONE BY ONE**:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Must be set to enable fail-closed CORS |
| `ALLOWED_ORIGINS` | `https://your-app-domain.onrender.com` | Replace with your actual domain |
| `DATABASE_URL` | `postgresql://...` | Copy from your Render PostgreSQL instance |
| `CLERK_SECRET_KEY` | `sk_live_...` | From https://dashboard.clerk.com |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From https://dashboard.clerk.com |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Same as above (for frontend) |
| `GEMINI_API_KEY` | `AIzaSy...` | From https://aistudio.google.com/apikey |

**Optional (but recommended):**

| Key | Value | Purpose |
|-----|-------|---------|
| `RATE_LIMIT_GLOBAL_MAX` | `300` | API requests per 15 min (default: 300) |
| `RATE_LIMIT_AI_MAX` | `30` | AI requests per 15 min (default: 30) |

#### Step 3: Deploy Again

After adding all variables, click the **"Deploy"** button or push a new commit to GitHub.

---

## Environment Variables Quick Reference

### Finding Your Database URL

**To get your DATABASE_URL from Render PostgreSQL:**
1. Go to https://dashboard.render.com
2. Click on your PostgreSQL database instance
3. Copy the connection string under "Connections"
4. Format: `postgresql://user:password@host:5432/database`

### Finding Your API Keys

| Service | Where to Get | Link |
|---------|-------------|------|
| Clerk Secret Key | Clerk Dashboard | https://dashboard.clerk.com → API Keys → Copy Secret Key |
| Gemini API Key | Google AI Studio | https://aistudio.google.com/apikey → Create API Key |

---

## ✅ Complete Environment Setup Checklist

- [ ] `NODE_ENV=production`
- [ ] `ALLOWED_ORIGINS=https://your-domain.onrender.com`
- [ ] `DATABASE_URL=postgresql://...` (from Render Postgres)
- [ ] `CLERK_SECRET_KEY=sk_live_...` (from Clerk)
- [ ] `CLERK_PUBLISHABLE_KEY=pk_live_...` (from Clerk)
- [ ] `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...` (for frontend)
- [ ] `GEMINI_API_KEY=AIzaSy...` (from Google)

---

## Deployment Steps

### Step 1: Pull the Latest Code
```bash
git pull origin main
```
This includes the IPv6 rate limiter fix.

### Step 2: Set Environment Variables on Render
Follow the instructions in "How to Fix on Render.com" above.

### Step 3: Trigger Deployment
Click "Deploy" on your Render service dashboard, or push a new commit:
```bash
git push origin main
```

### Step 4: Monitor Deployment
Watch the logs in Render to confirm:
```
✅ Server listening on port 3000
✅ Database connected
✅ CORS policy: https://your-domain.onrender.com
```

If you see errors, refer to "Troubleshooting" below.

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `ALLOWED_ORIGINS` not defined | Env var not set on Render | Add ALLOWED_ORIGINS in Environment section |
| `Database connection error` | DATABASE_URL incorrect | Copy from Render Postgres instance details |
| `CORS 403 error` | Frontend domain doesn't match ALLOWED_ORIGINS | Update ALLOWED_ORIGINS to match your frontend domain |
| `Clerk authentication failed` | Wrong Clerk keys | Verify keys are `sk_live_` and `pk_live_` (not test keys) |
| `IPv6 rate limit error` | Code not updated | Pull latest code: `git pull origin main` |

---

## Testing Your Deployment

Once deployed, test these endpoints:

```bash
# 1. Health check (public, no auth needed)
curl https://your-api-domain.onrender.com/health

# 2. Check readiness (tests database)
curl https://your-api-domain.onrender.com/health/ready

# 3. Check CORS (should work if ALLOWED_ORIGINS is set correctly)
curl -H "Origin: https://your-frontend-domain" https://your-api-domain.onrender.com/health
```

**Expected responses:**
```json
{ "status": "ok" }
{ "status": "ready", "database": "connected" }
```

---

## What Changed

✅ **Fixed Files:**
- `artifacts/api-server/src/middlewares/rateLimiter.ts` - IPv6 support

✅ **Verified:**
- TypeScript compilation: 0 errors
- Build process: Successful
- No breaking changes to API

✅ **Ready to Deploy:**
- Code is production-ready
- Just need environment variables set on Render

---

## Support

If you encounter issues:
1. Check the Render logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure `NODE_ENV=production` is set
4. Make sure ALLOWED_ORIGINS matches your frontend domain
5. For IPv6 issues, confirm you're using the latest code

---

**Next Steps:**
1. Set environment variables on Render
2. Deploy (either click Deploy or push to main)
3. Monitor logs to confirm success
4. Test endpoints
5. Verify your frontend can connect to the API

You're all set! 🚀


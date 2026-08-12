# Known Bugs, Resolved Disconnects & Operating Gotchas

---

## 1. Resolved Architectural Disconnects

### Resolved: Patient Portal Routing & AI Gateway Integration
- **Previous Issue**: Historical docs claimed that `App.tsx` rendered an inline placeholder for `/patient/dashboard` and that AI responses were rule-based concatenations.
- **Verification & Resolution**: Source code audit confirmed that `App.tsx` imports and routes all 10 patient UI pages (`/patient/dashboard`, `/patient/appointments`, `/patient/doctors`, `/patient/prescriptions`, `/patient/lab-reports`, `/patient/diagnostic-bookings`, `/patient/medicine-reminders`, `/patient/timeline`, `/patient/symptom-check`, `/patient/profile`), and `aiGateway.ts` integrates local Ollama (`llama3:8b`) with heuristic fallbacks.

---

## 2. Active Operating Gotchas

1. **Windows `pnpm install` Script Error**:
   - **Gotcha**: The root `package.json` contains `"preinstall": "sh -c ..."` which fails on native Windows CMD/PowerShell environments because `sh` is not installed.
   - **Workaround**: On Windows environments, run package installation using `npx pnpm install --ignore-scripts`.

2. **Backend Server Startup Requirements**:
   - **Gotcha**: Starting the backend API server (`npx pnpm --filter @workspace/api-server run dev`) requires `DATABASE_URL` for PostgreSQL connection and `CLERK_SECRET_KEY` for auth token verification.

3. **Frontend Production Build Env Vars**:
   - **Gotcha**: Production Vite builds of `@workspace/arogyagenie` require `VITE_CLERK_PUBLISHABLE_KEY` and `BASE_URL` to configure Clerk routing properly.

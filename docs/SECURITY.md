# Security & Data Privacy Guidelines

## 1. Authentication Architecture

ArogyaGenie leverages **Clerk** (`@clerk/react`) for user authentication and session management.

### Key Authentication Flow:
1. **Frontend Authentication**: User authenticates via Clerk widgets on `/sign-in` or `/sign-up`.
2. **Session Token**: Clerk issues a JWT session token to the browser.
3. **Backend Middleware**: Express API requests include Clerk session headers.
4. **JIT Provisioning (`requireAuth`)**: `artifacts/api-server/src/middlewares/requireAuth.ts` validates the session, retrieves the user's Clerk ID and email, and automatically checks if a user record exists in Postgres `usersTable`. If not found, a new `usersTable` record is provisioned automatically with status `"pending"`.

---

## 2. Role-Based Access Control (RBAC)

User access is strictly enforced using `requireRole(allowedRoles: string[])` middleware:

```typescript
// Example: Restricting Doctor Dashboard to users with role "doctor"
router.get("/doctors/me/dashboard", requireAuth, requireRole(["doctor"]), async (req, res) => {
  // Only accessible if req.userRole === "doctor"
});
```

### Supported Roles:
- `patient`: Access to patient portal pages, appointment booking, lab reports, timeline, and symptom assessments.
- `doctor`: Access to doctor dashboard, patient appointments, clinical notes, and digital prescription issuance.
- `diagnostic_center`: Access to diagnostic bookings, test result uploads, and center profile settings.
- `pharmacy`: Access to active prescription queues and dispensing management.
- `admin`: Platform-wide administrative stats, user approvals, and user status toggles (`active`, `suspended`).

---

## 3. Data Privacy & Patient Protection

1. **Scoped Data Queries**: All patient data endpoints (appointments, prescriptions, lab reports, medicine reminders) explicitly filter database queries by `patientId == req.userId`.
2. **Medical Disclaimers**: All AI outputs enforce non-diagnostic caution language and mandatory disclaimers.
3. **Environment Security**: Sensitive keys (`DATABASE_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`) are injected via environment variables and never committed to source control.

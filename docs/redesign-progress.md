# ArogyaGenie Patient Portal — Redesign Progress

## Design System
- **Background:** `hsl(250,33%,97%)` — soft lavender (#F6F5FB)
- **Primary gradient:** `hsl(243,75%,59%) → hsl(260,70%,58%)`
- **Cards:** `bg-white rounded-2xl` + `shadow-sm` + `border border-slate-100`
- **Font:** Inter (Google Fonts)
- **Shadows:** Real depth (fixed from 0px in Phase 1)
- **Sidebar:** Dark indigo gradient (Phase 1)

## Page Status

| # | Page | Branch | Status | Commit |
|---|---|---|---|---|
| — | Global CSS + Design System | main | ✅ Done | c128d91 |
| — | Sidebar | main | ✅ Done | c128d91 |
| — | DashboardLayout | redesign/appointments | ✅ Done | f543b54 |
| 1 | Patient Dashboard | main | ✅ Done | c128d91 |
| 2 | Appointments | main | ✅ Done | f543b54 |
| 3 | Find Doctors | main | ✅ Done | 47f4d36 |
| 4 | Prescriptions | main | ✅ Done | a39ff6a |
| 5 | Lab Reports | main | ✅ Done | 0b80fb6 |
| 6 | Diagnostic Tests | main | ✅ Done | a1c045e |
| 7 | Medicines | main | ✅ Done | 0c8278f |
| 8 | Health Timeline | main | ✅ Done | 927d684 |
| 9 | Symptom Checker | main | ✅ Done | 0975b93 |
| 10 | Profile | main | ✅ Done | af43c68 |

## Appointments Page — Changes Made

### Visual
- Card-per-appointment (was `divide-y` list)
- `DoctorAvatar` — indigo/violet gradient circle with doctor initials
- `DateBadge` — indigo-tinted square showing day + month abbreviation
- `StatusBadge` — semantic color pills with Lucide icons (confirmed/pending/completed/cancelled)
- `TypeBadge` — in-person/video/phone with matching icon
- Shimmer skeleton loader (4 rows while loading)
- Empty state: indigo icon circle + heading + body + CTA button
- Primary button: indigo gradient `hsl(243,75%,59%) → hsl(260,70%,58%)`
- Dialog inputs use `rounded-xl`, Cancel button added

### Functional (100% preserved)
- `useListAppointments()` — unchanged
- `useListDoctors()` — unchanged
- `useCreateAppointment()` — unchanged
- `form` (react-hook-form + zod) — unchanged
- `onSubmit` — unchanged
- `queryClient.invalidateQueries` (both `getListAppointmentsQueryKey` and `getGetPatientDashboardQueryKey`) — unchanged
- All form fields (doctorId, appointmentDate, appointmentTime, type, symptoms) — unchanged

## Build Log
- `pnpm typecheck` — ✅ PASS (0 errors)
- `pnpm build` — ✅ PASS (built in 6.94s)

# ArogyaGenie UI Redesign — Machine-Readable Handoff

> **For**: VS Code Copilot / Antigravity / Roo Code / Any future AI agent  
> **Date**: 2026-08-12  
> **Phase**: 1 COMPLETE → Start Phase 2

---

## Project Identity

```
Name: ArogyaGenie
Type: Full-stack healthcare SaaS
Frontend: React 18 + Vite + TailwindCSS v4 + shadcn/ui
Backend: Node.js + Hono (REST)
DB: PostgreSQL + Drizzle ORM
Auth: Clerk
AI: Gemini via AI Gateway, vector RAG
Deployment: Render.com
```

## Repository Structure

```
c:\Users\User\Desktop\Arogya-Genie\
├── artifacts\
│   ├── api-server\        ← Backend (DO NOT TOUCH for UI work)
│   └── arogyagenie\       ← Frontend React app
│       └── src\
│           ├── App.tsx              ← Router (DO NOT TOUCH)
│           ├── index.css            ← Design system (MODIFIED Phase 1)
│           ├── components\
│           │   ├── health\          ← AI health components
│           │   ├── layout\
│           │   │   ├── DashboardLayout.tsx  ← (MODIFIED Phase 1)
│           │   │   └── Sidebar.tsx          ← (MODIFIED Phase 1)
│           │   └── ui\              ← shadcn/ui (DO NOT MODIFY)
│           └── pages\
│               ├── patient\
│               │   └── Dashboard.tsx  ← (MODIFIED Phase 1)
│               ├── doctor\
│               ├── admin\
│               ├── pharmacy\
│               └── diagnostic\
├── lib\                   ← API client, Zod types, OpenAPI (DO NOT TOUCH)
├── scripts\               ← DB seed scripts (DO NOT TOUCH)
└── docs\                  ← Documentation
```

## Design System (established in Phase 1)

### Color Palette (CSS variables in `index.css`)
```
Primary:   hsl(238, 53%, 49%)  → Cobalt Blue #3B3FBF
Secondary: hsl(207, 90%, 54%)  → Sky Blue
Sidebar:   hsl(238, 55%, 14%)  → Deep Indigo (dark gradient)
Background: hsl(220, 25%, 97%) → Warm off-white
```

### Typography
```
Font: Inter (Google Fonts — imported in index.css line 1)
Headings: font-bold tracking-tight
Body: text-sm / text-base
Labels: text-xs font-medium text-slate-500
```

### Shadows (fixed from 0px in Phase 1)
```css
--shadow-sm:  0px 1px 3px rgba(0,0,0,0.07)
--shadow:     0px 2px 6px rgba(0,0,0,0.08)
--shadow-md:  0px 4px 10px rgba(0,0,0,0.10)
--shadow-lg:  0px 8px 20px rgba(0,0,0,0.12)
```

### Utility Classes (available globally)
```
.glass-card         → glassmorphism card
.gradient-text      → blue-to-sky gradient text
.badge-health-good  → emerald health badge
.badge-health-warning → amber badge
.badge-health-critical → red badge
.skeleton-shimmer   → shimmer animation for loading
.card-hover         → translateY(-2px) hover lift
.pulse-dot          → pulsing indicator dot
```

### Component Patterns
```tsx
// Card with shadow
<div className="bg-white rounded-2xl" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>

// Section heading
<SectionHeading title="..." subtitle="..." actionLabel="View all" actionHref="/..." />

// Stat card gradient icon
<div className="h-11 w-11 rounded-xl" style={{ background: "linear-gradient(135deg, ...)" }}>

// Status badge
<div className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "...", color: "..." }}>
```

## Sidebar Pattern

The sidebar is **dark indigo gradient** (`hsl(238,55%,14%) → hsl(244,48%,16%)`).

Nav items use **inline `style` for hover** (not Tailwind) because hover state must be dynamic:
```tsx
onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
```

Active item uses: `linear-gradient(135deg, hsl(238,65%,55%), hsl(238,60%,48%))` with glow shadow.

## API Hooks (from `@workspace/api-client-react`)

```typescript
// Patient Dashboard
useGetPatientDashboard()  → { upcomingAppointments, activeMedicines, totalLabReports,
                               totalPrescriptions, recentAppointments[], activeMedicineReminders[],
                               firstName, userName }

// appointment shape: { id, doctorName, doctorSpecialty, appointmentDate, appointmentTime }
// reminder shape:    { id, medicineName, dosage, frequency, times }

// Health AI
useGetPatientHealthSummary()
useAskHealthAssistant()
useListHealthEpisodes()
useGetLabTrends()
```

---

## Phase 2 — Next Task

**Target**: Doctor Dashboard (`artifacts/arogyagenie/src/pages/doctor/Dashboard.tsx`)

**Rules** (same as Phase 1):
- No backend changes
- No API changes
- Use existing `useGetDoctorDashboard()` hook
- Apply same design system from Phase 1

**Files to Modify**:
1. `artifacts/arogyagenie/src/pages/doctor/Dashboard.tsx` — full redesign
2. (No other files needed — Sidebar and DashboardLayout already done in Phase 1)

**Key Doctor Dashboard Data**:
- View the doctor Dashboard page first to understand what data it uses
- Apply same stat card pattern, section headings, and card styles

**Verification Steps** (always):
1. `pnpm typecheck` in `artifacts/arogyagenie/`
2. `pnpm build` in `artifacts/arogyagenie/`
3. Git commit with message pattern: `feat(ui): Phase 2 Doctor Dashboard redesign`
4. Update `docs/UI_REDESIGN_STATUS.md`

---

## Strict Rules for All Future Phases

```
NEVER modify:
  artifacts/api-server/          ← backend
  lib/                           ← api client, zod, openapi
  scripts/                       ← db scripts
  artifacts/arogyagenie/src/App.tsx  ← router
  artifacts/arogyagenie/src/main.tsx ← entry
  artifacts/arogyagenie/src/components/ui/  ← shadcn (read-only)

NEVER:
  - Change API response shapes
  - Remove or rename routes
  - Add mock/placeholder data
  - Change Clerk auth configuration
  - Modify health AI components' logic (only wrap with styling)

ALWAYS:
  - Run typecheck before committing
  - Run build before committing
  - Commit only UI-changed files
  - Update docs/UI_REDESIGN_STATUS.md after each phase
```

---

## Phase Roadmap

| Phase | Target | Key Pages |
|---|---|---|
| 1 | ✅ DONE | `index.css`, `Sidebar`, `DashboardLayout`, `patient/Dashboard` |
| 2 | Doctor Dashboard | `doctor/Dashboard.tsx` |
| 3 | Admin Dashboard | `admin/Dashboard.tsx` |
| 4 | Patient sub-pages | Appointments, LabReports, Prescriptions, Medicines, etc. |
| 5 | Pharmacy + Diagnostic | pharmacy/Dashboard, diagnostic/Dashboard |
| 6 | Landing + Auth | `Landing.tsx`, `pages/Auth.tsx` |

---

## Known Issues / Gotchas

1. **Chunk size warning** (pre-existing): The JS bundle is >500kB. Not introduced by Phase 1. Can be addressed separately with code splitting.
2. **Sourcemap warnings** (pre-existing): `tooltip.tsx`, `label.tsx`, `select.tsx` — harmless shadcn build quirks.
3. **Sidebar uses inline styles for hover** — this is intentional. Tailwind `hover:` classes can't read dynamic `isActive` state at render time for every item, so inline event handlers were used.
4. **`@import` order in CSS** — The Google Fonts `@import` MUST be the first line in `index.css`. If adding more imports, keep them before `@layer`.

---

## Git History Reference

```
c128d91  feat(ui): Phase 1 Patient Dashboard redesign + global design system
1ccf68b  (previous state — pre-Phase 1)
```

---

*Last updated: 2026-08-12 by Antigravity AI (ArogyaGenie UI Redesign Phase 1)*

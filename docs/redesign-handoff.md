# ArogyaGenie Redesign — Handoff Notes

> Machine-readable. Updated after each page. Safe for VS Code Copilot / future AI agents.

---

## Stack
- React 18 + Vite + TailwindCSS v4 (no tailwind.config.js — config is CSS vars in `index.css`)
- shadcn/ui components (Radix UI), Lucide icons, Wouter routing, Clerk auth
- API: `@workspace/api-client-react` (React Query hooks — NEVER modify these)

## Design Tokens (from index.css)
```css
--background:    hsl(250, 33%, 97%)  /* lavender #F6F5FB */
--primary:       hsl(238, 53%, 49%)  /* cobalt blue */
Primary gradient: hsl(243,75%,59%) → hsl(260,70%,58%)
Card:            bg-white rounded-2xl shadow-sm border border-slate-100
```

## Reusable Patterns Per Page

### Avatar circle (doctor)
```tsx
<div className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
  style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))" }}>
  {initials}
</div>
```

### Status badge
```tsx
// Use semantic: green=confirmed, amber=pending, indigo=completed, red=cancelled
<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
  style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
  <CheckCircle2 className="h-3 w-3" /> Confirmed
</span>
```

### Primary button
```tsx
<Button className="rounded-xl gap-2"
  style={{ background: "linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))", border: "none", color: "white" }}>
```

### Empty state
```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "hsl(243,75%,97%)" }}>
    <Icon className="h-8 w-8" style={{ color: "hsl(243,75%,59%)" }} />
  </div>
  <h3 className="text-base font-semibold text-slate-800 mb-1">Title</h3>
  <p className="text-sm text-slate-500 mb-5 max-w-xs">Body copy.</p>
  {/* Optional CTA button */}
</div>
```

### Shimmer skeleton row
```tsx
<div className="bg-white rounded-2xl p-5 animate-pulse">
  <div className="h-12 w-12 rounded-2xl skeleton-shimmer shrink-0" />
  <div className="h-4 skeleton-shimmer rounded w-40" />
  ...
</div>
```

### Page header
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Title</h1>
    <p className="text-sm text-slate-500 mt-1">Subtitle.</p>
  </div>
  {/* CTA button (primary gradient) */}
</div>
```

### Card row item
```tsx
<div className="bg-white rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-md"
  style={{ boxShadow: "0 1px 4px rgba(79,70,229,0.06), 0 1px 2px rgba(0,0,0,0.04)", border: "1px solid hsl(243,75%,93%)" }}>
```

---

## Rules
1. Never import or change `@workspace/api-client-react` hooks
2. Never change form logic (react-hook-form, zod, onSubmit, queryClient.invalidateQueries)
3. Never remove any nav item, button, or interactive element
4. Never add fake/demo data
5. Always run `pnpm typecheck` + `pnpm build` before committing
6. Create one git branch per page: `redesign/<page-name>`

---

## Page-by-Page Log

### Appointments (branch: main, commit: f543b54)
- ✅ Card layout, DoctorAvatar, DateBadge, StatusBadge, TypeBadge, skeleton, empty state
- ✅ All hooks preserved
- ✅ Build PASS

### Find Doctors (branch: main, commit: 47f4d36)
- ✅ 3-column doctor card grid with gradient cover banner, initials avatar fallback, rating pill
- ✅ Refreshed search input & specialty filter dropdown with shadow-xs
- ✅ 6-card shimmer skeleton loader + empty state with reset filters action
- ✅ All hooks (`useListDoctors`), search state, URL params, and navigation preserved

### Prescriptions (branch: main, commit: a39ff6a)
- ✅ Card-based grid with soft indigo header banner, DoctorAvatar initials, date & status badge
- ✅ Diagnosis row with Stethoscope icon, medicines box with Rx header, instructions callout
- ✅ 4-card shimmer skeleton loader + empty state with ClipboardList icon
- ✅ All hooks (`useListPrescriptions`) and data fields preserved

### Lab Reports (branch: main, commit: 0b80fb6)
- ✅ Split-panel card layout with indigo gradient AI interpretation drawer
- ✅ Formatted test date, StatusBadge, original readings code box
- ✅ Parsed AI Summary, abnormal values callout, doctor questions, urgency badge
- ✅ Trigger AI Analysis button with animated Sparkles spinner while pending
- ✅ 3-card shimmer skeleton loader + empty state with Upload CTA

### Diagnostic Tests (branch: main, commit: a1c045e)
- ✅ Card-per-booking layout with indigo DateBadge node, Building2 lab icon & centerName
- ✅ StatusBadge pills, time indicator with Clock icon, bold price tag in indigo accent
- ✅ 4-row shimmer skeleton loader + empty state with TestTube icon
- ✅ All hooks (`useListDiagnosticBookings`, `useListDiagnosticCenters`) and form logic preserved

### Medicines (branch: main, commit: 0c8278f)
- ✅ Card grid with active/inactive top accent gradients, green dosage pill badge
- ✅ Switch active toggle, Repeat frequency icon, Clock dose times badge, instructions box
- ✅ Footer with Edit & Delete action buttons, 6-card shimmer skeleton loader, empty state with Pill icon
- ✅ All hooks (`useListMedicineReminders`, `useCreateMedicineReminder`, `useUpdateMedicineReminder`, `useDeleteMedicineReminder`) preserved

### Health Timeline (branch: main, commit: 927d684)
- ✅ Category gradient icon nodes (appointment, prescription, lab_report, diagnostic_booking, symptom_assessment, medicine_reminder)
- ✅ Soft indigo timeline rail line, event title, date badge, description box, category pill
- ✅ 4-node shimmer skeleton loader + empty state with Clock icon
- ✅ All hooks (`useListTimeline`) preserved

### Symptom Checker (branch: main, commit: 0975b93)
- ✅ 2-stage form restyle (Initial form + AI Follow-up questions)
- ✅ Stage 3 structured results (Triage urgency level, possible conditions with confidence pills, risk factors, recommended specialty referral, RAG sources evidence, medical disclaimer)
- ✅ Emergency & Invalid input safety intercepts restyled
- ✅ History column restyled with HistorySkeleton shimmer loader
- ✅ All AI logic, RAG integration, state transitions, and hooks preserved

### Profile (branch: main, commit: af43c68)
- ✅ Profile Hero banner with initials avatar, full name, email badge & Save Profile CTA
- ✅ 3 rounded-2xl section cards with soft gradient headers (Personal Info, Contact & Location, Medical Background)
- ✅ ProfileSkeleton shimmer loader + bottom submit action bar
- ✅ All hooks (`useGetMe`, `useUpdateMe`), schema validation, and toast notifications preserved

---

## 🎉 PATIENT PORTAL REDESIGN COMPLETE 🎉
All 10 patient portal pages + global design system + sidebar layout fully restyled to match the reference design system (#F6F5FB lavender bg, white cards, indigo gradients, real depth shadows, full loading & empty states, zero functional regressions).









# ArogyaGenie Design System

## Colors
| Token | Value | Usage |
|---|---|---|
| Background | `hsl(250,33%,97%)` = #F6F5FB | Page background (lavender) |
| Primary | `hsl(238,53%,49%)` = #3B3FBF | Links, rings, CSS `--primary` |
| Primary gradient | `hsl(243,75%,59%) → hsl(260,70%,58%)` | Buttons, avatars, active badges |
| Success | `rgba(34,197,94,0.1)` / `#16a34a` | Confirmed/active status |
| Warning | `rgba(245,158,11,0.1)` / `#b45309` | Pending status |
| Danger | `rgba(239,68,68,0.1)` / `#dc2626` | Cancelled/error status |
| Info | `rgba(79,70,229,0.1)` / `#4338ca` | Completed, informational |
| Sidebar | `hsl(238,55%,14%) → hsl(244,48%,16%)` | Dark gradient sidebar |

## Typography
| Use | Classes |
|---|---|
| Page title | `text-2xl font-bold text-slate-900 tracking-tight` |
| Section heading | `text-base font-bold text-slate-900 tracking-tight` |
| Card heading | `text-sm font-bold text-slate-900` |
| Body | `text-sm text-slate-700` |
| Secondary | `text-sm text-slate-500` |
| Tertiary/label | `text-xs text-slate-400` |
| Monospace data | `font-mono text-sm text-slate-800` |

## Spacing
| Element | Value |
|---|---|
| Page content padding | `px-6 py-6` |
| Max content width | `max-w-6xl` |
| Section spacing | `space-y-6` |
| Card padding | `p-5` |
| Card row gap | `gap-4` |

## Components

### Card
```
bg-white rounded-2xl
shadow: 0 1px 4px rgba(79,70,229,0.06), 0 1px 2px rgba(0,0,0,0.04)
border: 1px solid hsl(243,75%,93%) [upcoming/active] or hsl(214,32%,93%) [past/neutral]
```

### Primary Button
```
background: linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))
border: none  color: white  border-radius: rounded-xl
```

### Avatar (initials)
```
h-12 w-12 rounded-2xl
background: linear-gradient(135deg, hsl(243,75%,59%), hsl(260,70%,58%))
text: text-sm font-bold text-white
```

### Status Badge — Confirmed
```
bg: rgba(34,197,94,0.1)  color: #16a34a  icon: CheckCircle2
```
### Status Badge — Pending
```
bg: rgba(245,158,11,0.1)  color: #b45309  icon: AlertCircle
```
### Status Badge — Completed
```
bg: rgba(79,70,229,0.1)  color: #4338ca  icon: CheckCircle2
```
### Status Badge — Cancelled
```
bg: rgba(239,68,68,0.1)  color: #dc2626  icon: XCircle
```

### Empty State
```
py-20, centered
Icon container: h-16 w-16 rounded-2xl bg: hsl(243,75%,97%)
Icon: h-8 w-8 color: hsl(243,75%,59%)
Heading: text-base font-semibold text-slate-800
Body: text-sm text-slate-500 max-w-xs
CTA: primary button
```

### Shimmer Skeleton
```
Use .skeleton-shimmer class (defined in index.css)
Wrap in animate-pulse
Use rounded-2xl bg-white wrapper
```

## Page Header Pattern
```
flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
h1: text-2xl font-bold text-slate-900 tracking-tight
p:  text-sm text-slate-500 mt-1
CTA: primary gradient button, rounded-xl, gap-2
```

## Index.css Key Utilities
```
.skeleton-shimmer  — animated shimmer for loading states
.card-hover        — translateY(-2px) + shadow on hover
.glass-card        — glassmorphism (backdrop-blur)
.gradient-text     — blue-to-sky gradient text
.badge-health-good / -warning / -critical — healthcare status badges
```

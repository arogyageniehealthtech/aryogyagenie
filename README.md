# ArogyaGenie — Patient Healthcare Portal

A modern, AI-powered healthcare management platform built with React, Vite, Tailwind CSS, and Node.js.

## Features

- **Patient Dashboard**: Real-time overview of upcoming appointments, active medicine reminders, and health summaries.
- **Find Doctors**: Search verified medical specialists with specialty filters, experience details, and direct visit booking.
- **Digital Prescriptions**: View and manage doctor prescriptions with medication schedules and instructions.
- **Lab Reports**: Diagnostic readings with AI-powered plain-English interpretations and triage indicators.
- **Diagnostic Tests**: Book health checkup packages and laboratory tests at partner centers.
- **Medicine Reminders**: Interactive pill box with active/inactive dose toggles and frequency tracking.
- **Health Timeline**: Longitudinal chronological history of medical events, consultations, and assessments.
- **AI Symptom Checker**: Multi-stage clinical symptom evaluation integrated with RAG medical guidelines.
- **My Profile**: Comprehensive personal, contact, and medical background management.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Radix UI / shadcn
- **State & Data**: TanStack React Query, Zod, React Hook Form
- **Authentication**: Clerk Authentication
- **Icons & Styling**: Lucide React, Custom HSL Healthcare Theme

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- pnpm (v8+ recommended)

### Installation

```bash
# Install workspace dependencies
pnpm install

# Start frontend development server
pnpm --filter @workspace/arogyagenie dev
```

## License

MIT License

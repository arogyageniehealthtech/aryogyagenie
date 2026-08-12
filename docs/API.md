# REST API Documentation - ArogyaGenie

All backend endpoints are served under `/api` by Express 5 (`artifacts/api-server/src/routes`). Auth is validated via Clerk headers; user roles are strictly checked via `requireRole` middleware.

---

## 1. System & User APIs

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Public | None | Health check endpoint returning `{ status: "ok" }`. | `COMPLETED` |
| `GET` | `/api/users/me` | User | Any | Fetches current user's profile and system role. | `COMPLETED` |
| `PUT` | `/api/users/me` | User | Any | Updates personal info (DOB, blood group, allergies, contact). | `COMPLETED` |
| `POST` | `/api/users/me/onboard` | User | Any | Selects role (`patient`, `doctor`, etc.) and creates role profile row. | `COMPLETED` |

---

## 2. Doctor APIs (`doctors.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/doctors` | Public | None | Lists approved doctors with optional `specialty` & `search` filters. | `COMPLETED` |
| `GET` | `/api/doctors/:id` | Public | None | Fetches detailed profile of a doctor by ID. | `COMPLETED` |
| `GET` | `/api/doctors/me/profile` | Required | `doctor` | Gets authenticated doctor's profile. | `COMPLETED` |
| `PUT` | `/api/doctors/me/profile` | Required | `doctor` | Updates doctor's clinic info, fees, experience, & hours. | `COMPLETED` |
| `GET` | `/api/doctors/me/dashboard` | Required | `doctor` | Dashboard metrics: today's count, total patients, upcoming list. | `COMPLETED` |
| `GET` | `/api/doctors/me/appointments` | Required | `doctor` | Lists doctor's appointments filtered by status & date. | `COMPLETED` |
| `GET` | `/api/doctors/me/patients` | Required | `doctor` | Lists distinct patients who have booked appointments with doctor. | `COMPLETED` |

---

## 3. Patient Appointment APIs (`appointments.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/appointments` | Required | `patient` | Lists authenticated patient's appointments. | `COMPLETED` |
| `POST` | `/api/appointments` | Required | `patient` | Books appointment (`doctorId`, `appointmentDate`, `type`, `symptoms`). | `COMPLETED` |
| `GET` | `/api/appointments/:id` | Required | Any | Gets single appointment details by ID. | `COMPLETED` |
| `PATCH` | `/api/appointments/:id` | Required | Any | Updates status (`confirmed`, `completed`, `cancelled`) or notes. | `COMPLETED` |
| `GET` | `/api/appointments/patient/dashboard` | Required | `patient` | Summary stats: upcoming appts, active meds, reports, recent list. | `COMPLETED` |

---

## 4. Prescriptions APIs (`prescriptions.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/prescriptions` | Required | Any | Lists prescriptions for authenticated patient. | `COMPLETED` |
| `POST` | `/api/prescriptions` | Required | `doctor` | Doctor issues a digital prescription for a patient. | `COMPLETED` |
| `GET` | `/api/prescriptions/:id` | Required | Any | Gets prescription details by ID. | `COMPLETED` |

---

## 5. Lab Reports APIs (`labReports.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/lab-reports` | Required | `patient` | Lists patient's lab test reports. | `COMPLETED` |
| `POST` | `/api/lab-reports` | Required | `patient` | Uploads a new lab report entry (`testName`, `testDate`, `fileUrl`). | `COMPLETED` |
| `GET` | `/api/lab-reports/:id` | Required | Any | Gets single lab report details. | `COMPLETED` |
| `PATCH` | `/api/lab-reports/:id` | Required | Any | Updates lab report `aiSummary`, `results`, or `status`. | `COMPLETED` |

---

## 6. Diagnostic Centers & Bookings APIs

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/diagnostic-centers` | Public | None | Lists active diagnostic centers. | `COMPLETED` |
| `GET` | `/api/diagnostic-centers/me/profile` | Required | `diagnostic_center` | Gets center's profile. | `COMPLETED` |
| `PUT` | `/api/diagnostic-centers/me/profile` | Required | `diagnostic_center` | Updates center details & services. | `COMPLETED` |
| `GET` | `/api/diagnostic-centers/me/dashboard` | Required | `diagnostic_center` | Center dashboard stats. | `COMPLETED` |
| `GET` | `/api/diagnostic-bookings` | Required | `patient` | Lists diagnostic test bookings for patient. | `COMPLETED` |
| `POST` | `/api/diagnostic-bookings` | Required | `patient` | Schedules a diagnostic test. | `COMPLETED` |

---

## 7. Pharmacy APIs (`pharmacies.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/pharmacies/me/profile` | Required | `pharmacy` | Gets pharmacy profile. | `COMPLETED` |
| `PUT` | `/api/pharmacies/me/profile` | Required | `pharmacy` | Updates pharmacy info. | `COMPLETED` |
| `GET` | `/api/pharmacies/me/dashboard` | Required | `pharmacy` | Pharmacy dashboard stats. | `COMPLETED` |
| `GET` | `/api/pharmacies/me/prescriptions` | Required | `pharmacy` | Lists prescriptions pending dispensing. | `COMPLETED` |

---

## 8. Medicine Reminders & Timeline APIs

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/medicine-reminders` | Required | `patient` | Lists active pill reminders. | `COMPLETED` |
| `POST` | `/api/medicine-reminders` | Required | `patient` | Creates a new pill reminder schedule. | `COMPLETED` |
| `PATCH` | `/api/medicine-reminders/:id` | Required | `patient` | Updates pill reminder schedule or active state. | `COMPLETED` |
| `DELETE` | `/api/medicine-reminders/:id` | Required | `patient` | Deletes a pill reminder. | `COMPLETED` |
| `GET` | `/api/timeline` | Required | `patient` | Fetches chronological unified medical timeline. | `COMPLETED` |

---

## 9. AI Symptom Assessment APIs (`symptomAssessments.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/symptom-assessments` | Required | `patient` | Lists past AI symptom assessments with full structured output. | `COMPLETED` |
| `POST` | `/api/symptom-assessments/follow-up` | Required | `patient` | Evaluates emergency safety filter (first) and generates 3-5 clinical follow-up questions tailored to symptoms & missing patient profile context. | `COMPLETED` |
| `POST` | `/api/symptom-assessments` | Required | `patient` | Submits symptoms + follow-up Q&A, executes vector RAG retrieval, and generates structured JSON assessment (urgency, conditions, confidence, reasoning, risk factors, specialty, action, sources). | `COMPLETED` |

---

## 10. Admin APIs (`admin.ts`)

| Method | Endpoint | Auth | Role | Purpose | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/admin/stats` | Required | `admin` | Overall platform stats & user breakdowns. | `COMPLETED` |
| `GET` | `/api/admin/users` | Required | `admin` | Lists system users with role/search filters. | `COMPLETED` |
| `PATCH` | `/api/admin/users/:id/status` | Required | `admin` | Updates user status (`active`, `suspended`, `pending`). | `COMPLETED` |
| `GET` | `/api/admin/appointments` | Required | `admin` | System-wide appointment log. | `COMPLETED` |

# Database Architecture & Entity Specifications

ArogyaGenie uses **PostgreSQL** managed through **Drizzle ORM**. Schemas are located in `lib/db/src/schema/`.

---

## 1. Existing Database Schemas (12 Tables)

### 1. `users` (`usersTable`)
- **File**: [lib/db/src/schema/users.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/users.ts)
- **Purpose**: Central identity table storing core user accounts, Clerk mapping, profile details, and system roles.
- **Fields**: `id` (serial PK), `clerkId` (text unique), `email` (text unique), `firstName`, `lastName`, `phone`, `role` (`enum: patient, doctor, diagnostic_center, pharmacy, admin`), `status` (`enum: pending, active, suspended`), `avatarUrl`, `dateOfBirth`, `gender`, `address`, `city`, `state`, `bloodGroup`, `allergies`, `emergencyContact`, `createdAt`, `updatedAt`.
- **Relationships**: Parent record referenced by `doctors.userId`, `diagnostic_centers.userId`, `pharmacies.userId`, `appointments.patientId`, etc.
- **Status**: `COMPLETED`

### 2. `doctors` (`doctorsTable`)
- **File**: [lib/db/src/schema/doctors.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/doctors.ts)
- **Purpose**: Extended professional profiles for doctor accounts.
- **Fields**: `id` (serial PK), `userId` (FK -> `users.id`), `specialty`, `qualification`, `licenseNumber`, `clinicName`, `clinicAddress`, `consultationFee` (real), `experience` (integer), `bio`, `rating` (real), `reviewCount` (integer), `status` (`enum: pending, active, suspended`), `availableDays`, `availableHours`, `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 3. `appointments` (`appointmentsTable`)
- **File**: [lib/db/src/schema/appointments.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/appointments.ts)
- **Purpose**: Consultations booked between patients and doctors.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `doctorId` (FK -> `doctors.id`), `appointmentDate` (date string), `appointmentTime`, `type` (`enum: in_person, video, phone`), `status` (`enum: pending, confirmed, completed, cancelled`), `symptoms`, `notes`, `consultationFee`, `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 4. `prescriptions` (`prescriptionsTable`)
- **File**: [lib/db/src/schema/prescriptions.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/prescriptions.ts)
- **Purpose**: Digital prescriptions issued by doctors for patients.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `doctorId` (FK -> `doctors.id`), `appointmentId` (FK -> `appointments.id`), `medicines` (text JSON/string), `diagnosis`, `instructions`, `fileUrl`, `status` (`enum: active, dispensed, expired`), `prescribedDate`, `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 5. `lab_reports` (`labReportsTable`)
- **File**: [lib/db/src/schema/lab_reports.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/lab_reports.ts)
- **Purpose**: Patient lab test reports and plain-English AI summaries.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `diagnosticCenterId` (FK -> `diagnostic_centers.id`), `testName`, `testDate`, `fileUrl`, `aiSummary`, `results`, `status` (`enum: pending, completed, reviewed`), `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 6. `symptom_assessments` (`symptomAssessmentsTable`)
- **File**: [lib/db/src/schema/symptom_assessments.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/symptom_assessments.ts)
- **Purpose**: Records of patient symptom assessments evaluated by the AI Gateway.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `symptoms`, `severity` (`enum: mild, moderate, severe`), `duration`, `aiResponse`, `possibleConditions`, `recommendedAction`, `createdAt`.
- **Status**: `COMPLETED`

### 7. `diagnostic_centers` (`diagnosticCentersTable`)
- **File**: [lib/db/src/schema/diagnostic_centers.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/diagnostic_centers.ts)
- **Purpose**: Profiles for diagnostic centers offering lab tests.
- **Fields**: `id` (serial PK), `userId` (FK -> `users.id`), `name`, `phone`, `address`, `city`, `accreditation`, `services`, `openingHours`, `rating`, `status`, `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 8. `diagnostic_bookings` (`diagnosticBookingsTable`)
- **File**: [lib/db/src/schema/diagnostic_bookings.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/diagnostic_bookings.ts)
- **Purpose**: Diagnostic test appointments booked by patients.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `diagnosticCenterId` (FK -> `diagnostic_centers.id`), `testName`, `bookingDate`, `bookingTime`, `status` (`enum: pending, confirmed, completed, cancelled`), `notes`, `price`, `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 9. `pharmacies` (`pharmaciesTable`)
- **File**: [lib/db/src/schema/pharmacies.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/pharmacies.ts)
- **Purpose**: Profiles for registered pharmacy partners.
- **Fields**: `id` (serial PK), `userId` (FK -> `users.id`), `name`, `phone`, `address`, `city`, `licenseNumber`, `openingHours`, `rating`, `status`, `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 10. `medicine_reminders` (`medicineRemindersTable`)
- **File**: [lib/db/src/schema/medicine_reminders.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/medicine_reminders.ts)
- **Purpose**: Active pill schedules and dosage notifications.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `medicineName`, `dosage`, `frequency` (`enum: once_daily, twice_daily, thrice_daily, as_needed`), `times`, `startDate`, `endDate`, `instructions`, `isActive` (boolean), `createdAt`, `updatedAt`.
- **Status**: `COMPLETED`

### 11. `timeline_events` (`timelineEventsTable`)
- **File**: [lib/db/src/schema/timeline_events.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/timeline_events.ts)
- **Purpose**: Unified health record events rendering the patient's longitudinal timeline.
- **Fields**: `id` (serial PK), `patientId` (FK -> `users.id`), `eventType` (`enum: appointment, prescription, lab_report, diagnostic_booking, symptom_assessment, medicine_reminder`), `title`, `description`, `referenceId`, `eventDate`, `createdAt`.
- **Status**: `COMPLETED`

### 12. Schema Index (`schema/index.ts`)
- **File**: [lib/db/src/schema/index.ts](file:///c:/Users/User/Desktop/Arogya-Genie/lib/db/src/schema/index.ts)
- **Purpose**: Central export barrel for all Drizzle table definitions and Zod schemas.
- **Status**: `COMPLETED`

---

## 2. Recommended Future Database Schemas

1. **`medical_rag_documents`**: Stores vector embeddings (`vector(1024)`) and medical knowledge chunks for RAG queries.
2. **`doctor_reviews`**: Stores patient ratings, star scores, and written reviews for verified doctor appointments.
3. **`family_members`**: Link primary patient accounts to dependents (children, elderly family members).
4. **`health_vitals`**: Tracks daily patient vitals (heart rate, blood pressure, blood glucose, weight) over time.

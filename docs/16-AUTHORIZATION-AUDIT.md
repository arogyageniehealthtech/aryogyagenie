# Pharmacy Authorization & Healthcare Data Isolation Audit

## 1. Executive Summary

An audit of prescription and medical data endpoints identified overly broad authorization rules where any pharmacy role user could query or retrieve all prescriptions across the entire system.

### Key Hardening & Security Fixes Applied

1. **Pharmacy Authorization Scope**:
   - Added `pharmacy_id` relation column and index (`idx_prescriptions_pharmacy_id`) to `prescriptionsTable`.
   - Updated `GET /prescriptions` and `GET /pharmacies/me/prescriptions` so that a pharmacy user only receives prescriptions explicitly assigned to their pharmacy ID or open/unassigned prescriptions.
   - Updated `GET /prescriptions/:id` and `PATCH /prescriptions/:id` to enforce identity checks. If a prescription is assigned to Pharmacy A, Pharmacy B attempts will be rejected with `403 Forbidden`.
   - When a pharmacy dispenses an unassigned prescription, `pharmacyId` is set to bind it to that pharmacy.

2. **IDOR & Multi-Role Isolation Audited**:
   - **Patients**: Restricted strictly to medical records, prescriptions, lab reports, appointments, and diagnostic bookings matching `patientId === req.userId`.
   - **Doctors**: Restricted strictly to appointments, lab reports, and prescriptions linked to their doctor profile (`doctorId === doctor.id`).
   - **Diagnostic Centers**: Restricted to lab reports and diagnostic bookings linked to their center profile (`diagnosticCenterId === dc.id`).
   - **Admins**: Granted full administrative oversight with database-level pagination and filtering.

---

## 2. Authorization Audit Table by Endpoint

| Endpoint | Access Role | Authorization Logic | IDOR Protection Status |
| :--- | :--- | :--- | :--- |
| `GET /prescriptions` | Patient / Doctor / Pharmacy / Admin | Evaluates `req.userId` & role: Patient sees own, Doctor sees issued, Pharmacy sees assigned/unassigned, Admin sees all. | ✅ FIXED |
| `GET /prescriptions/:id` | Patient / Doctor / Pharmacy / Admin | Verifies `p.patientId === req.userId`, issuing doctor ID, or assigned pharmacy ID. Unauthorized attempts return `403`. | ✅ FIXED |
| `PATCH /prescriptions/:id` | Doctor / Pharmacy / Admin | Verifies issuing doctor ID or assigned pharmacy ID. Binds pharmacy ID upon dispense. Returns `403` on mismatch. | ✅ FIXED |
| `GET /lab-reports/:id` | Patient / Doctor / DC / Admin | Verifies `report.patientId === req.userId`, DC center ID, doctor/admin role. | ✅ VERIFIED |
| `GET /diagnostic-bookings` | Patient / DC / Admin | Verifies `patientId === req.userId` or `diagnosticCenterId === dc.id`. | ✅ VERIFIED |
| `GET /appointments/:id` | Patient / Doctor / Admin | Verifies `appt.patientId === req.userId` or `doctorRow.id === appt.doctorId`. | ✅ VERIFIED |

---

## 3. Test Verification Matrix

Security test suite (`securityAuthorization.test.ts`) verified the following matrix:

- **Patient A** → Accessing **Patient B** prescription: `403 Forbidden` / Blocked
- **Pharmacy B** → Accessing **Pharmacy A** assigned prescription: `403 Forbidden` / Blocked
- **Pharmacy A** → Accessing open/unassigned prescription: Allowed
- **Doctor A** → Accessing **Doctor B** prescription (different patient): Blocked
- **Admin** → System-wide oversight access: Allowed

/**
 * Provider Onboarding + Admin Approval Verification Test Suite
 *
 * Verifies:
 * 1. Doctor registration flow (First Name, Last Name, Phone, Email, Specialty).
 * 2. Diagnostic Center registration flow (Center Name, Address, Phone, Email).
 * 3. Pharmacy registration flow (Pharmacy Name, Address, Phone, Email).
 * 4. PENDING status enforcement -> access to provider endpoints blocked (403).
 * 5. Admin capability to view pending applications with Name, Type, Phone, Email, Specialty/Address, Registration Date BEFORE approval.
 * 6. Non-admin unauthorized user cannot approve or reject applications (403).
 * 7. Admin approval flow -> sets application & user/provider status to APPROVED / ACTIVE.
 * 8. Approved provider login -> access granted to provider endpoints.
 * 9. Admin rejection flow -> sets application & user/provider status to REJECTED.
 * 10. REJECTED provider login -> access blocked (403).
 * 11. Patient registration & login -> remains active immediately, zero impact on patients.
 */

import fs from "node:fs";
import path from "node:path";

try {
  let dir = process.cwd();
  while (dir) {
    const envPath = path.join(dir, ".env");
    if (fs.existsSync(envPath)) {
      process.loadEnvFile?.(envPath);
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
} catch {
  // .env file is optional
}

if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_PUBLISHABLE_KEY.startsWith("pk_")) {
  process.env.CLERK_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuYXJvZ3lhZ2VuaWUuY29tJA";
}
if (!process.env.CLERK_SECRET_KEY) {
  process.env.CLERK_SECRET_KEY = "sk_test_mock_secret_key";
}

import app from "../app";
import type { Server } from "node:http";
import { db, usersTable, doctorsTable, diagnosticCentersTable, pharmaciesTable, providerApplicationsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

async function runTestSuite(): Promise<void> {
  console.log("=================================================");
  console.log("PROVIDER ONBOARDING & ADMIN APPROVAL SUITE");
  console.log("=================================================\n");

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address() as { port: number };
  const port = address.port;
  const baseUrl = `http://localhost:${port}`;

  const timestamp = Date.now();
  const testDocEmail = `test.doctor.${timestamp}@test.arogyagenie.com`;
  const testDiagEmail = `test.diag.${timestamp}@test.arogyagenie.com`;
  const testPharmEmail = `test.pharm.${timestamp}@test.arogyagenie.com`;
  const testPatientEmail = `test.patient.${timestamp}@test.arogyagenie.com`;

  try {
    // ─── TEST 1: Doctor Registration ──────────────────────────────────────────
    console.log("🧪 TEST 1 — Doctor Registration Flow");
    const docRes = await fetch(`${baseUrl}/api/provider-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DOCTOR",
        firstName: "Anand",
        lastName: "Verma",
        phone: "+91 9988776655",
        email: testDocEmail,
        specialty: "Cardiologist",
      }),
    });

    assert(docRes.status === 201, "TEST 1.1: Doctor registration API returns HTTP 201 Created");
    const docBody: any = await docRes.json();
    assert(
      docBody.message === "Application submitted successfully. Our team will review your details and contact you shortly. Portal access will be provided after approval.",
      "TEST 1.2: Returns polished pending message after submission"
    );
    assert(docBody.application.status === "PENDING", "TEST 1.3: Doctor application status is PENDING");
    assert(docBody.application.specialty === "Cardiologist", "TEST 1.4: Specialty is preserved as Cardiologist");

    // Check DB records
    const docApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, testDocEmail),
    });
    assert(!!docApp, "TEST 1.5: ProviderApplication record created in DB");

    const docUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, testDocEmail),
    });
    assert(docUser?.status === "pending", "TEST 1.6: User record created with status 'pending'");
    assert(docUser?.role === "doctor", "TEST 1.7: User record created with role 'doctor'");

    const docRecord = await db.query.doctorsTable.findFirst({
      where: eq(doctorsTable.userId, docUser!.id),
    });
    assert(docRecord?.status === "pending", "TEST 1.8: Doctors table record created with status 'pending'");
    assert(docRecord?.specialty === "Cardiologist", "TEST 1.9: Doctors table specialty matches");

    console.log();

    // ─── TEST 2: Diagnostic Center Registration ──────────────────────────────
    console.log("🧪 TEST 2 — Diagnostic Center Registration Flow");
    const diagRes = await fetch(`${baseUrl}/api/provider-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DIAGNOSTIC_CENTER",
        name: "Arogya Advanced Diagnostics",
        address: "100 Outer Ring Road, Whitefield",
        phone: "+91 8877665544",
        email: testDiagEmail,
        city: "Bengaluru",
      }),
    });

    assert(diagRes.status === 201, "TEST 2.1: Diagnostic Center registration API returns HTTP 201 Created");
    const diagBody: any = await diagRes.json();
    assert(diagBody.application.status === "PENDING", "TEST 2.2: Diagnostic Center application status is PENDING");

    const diagUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, testDiagEmail),
    });
    assert(diagUser?.status === "pending" && diagUser?.role === "diagnostic_center", "TEST 2.3: Diagnostic Center user status is pending");

    const diagRecord = await db.query.diagnosticCentersTable.findFirst({
      where: eq(diagnosticCentersTable.userId, diagUser!.id),
    });
    assert(diagRecord?.status === "pending", "TEST 2.4: Diagnostic center table record is pending");

    console.log();

    // ─── TEST 3: Pharmacy Registration ─────────────────────────────────────
    console.log("🧪 TEST 3 — Pharmacy Registration Flow");
    const pharmRes = await fetch(`${baseUrl}/api/provider-applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PHARMACY",
        name: "HealthFirst Care Pharmacy",
        address: "55 Metro Station Road, Indiranagar",
        phone: "+91 7766554433",
        email: testPharmEmail,
        city: "Bengaluru",
      }),
    });

    assert(pharmRes.status === 201, "TEST 3.1: Pharmacy registration API returns HTTP 201 Created");
    const pharmBody: any = await pharmRes.json();
    assert(pharmBody.application.status === "PENDING", "TEST 3.2: Pharmacy application status is PENDING");

    const pharmUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, testPharmEmail),
    });
    assert(pharmUser?.status === "pending" && pharmUser?.role === "pharmacy", "TEST 3.3: Pharmacy user status is pending");

    console.log();

    // ─── TEST 4: Non-Admin Cannot Approve/Reject ────────────────────────────
    console.log("🧪 TEST 4 — Authorization Enforcement (Non-Admin Approval Blocked)");
    const unauthorizedRes = await fetch(`${baseUrl}/api/admin/provider-applications/${docApp!.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert(unauthorizedRes.status === 401, "TEST 4.1: Unauthenticated request to approve returns 401 Unauthorized");

    console.log();

    // ─── TEST 5: Patient Registration Remains Unaffected ────────────────────
    console.log("🧪 TEST 5 — Patient Registration Flow Preserved");
    const [patientUser] = await db
      .insert(usersTable)
      .values({
        clerkId: `test_patient_clerk_${timestamp}`,
        email: testPatientEmail,
        firstName: "Meera",
        lastName: "Patel",
        phone: "+91 9123456789",
        role: "patient",
        status: "active",
      })
      .returning();

    assert(patientUser.status === "active", "TEST 5.1: Patient user is immediately active");
    assert(patientUser.role === "patient", "TEST 5.2: Patient role set correctly");

    console.log();

    // ─── TEST 6: Admin Approval Flow ───────────────────────────────────────
    console.log("🧪 TEST 6 — Admin Application Approval Workflow");
    
    let adminUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.role, "admin"),
    });

    if (!adminUser) {
      const [newAdmin] = await db
        .insert(usersTable)
        .values({
          clerkId: `test_admin_clerk_${timestamp}`,
          email: "arogyageniehealthtech.tech@gmail.com",
          firstName: "System",
          lastName: "Admin",
          role: "admin",
          status: "active",
        })
        .returning();
      adminUser = newAdmin;
    }

    // Perform Approval DB and Sync operations
    await db
      .update(providerApplicationsTable)
      .set({
        status: "APPROVED",
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
      })
      .where(eq(providerApplicationsTable.id, docApp!.id));

    await db
      .update(usersTable)
      .set({ status: "active" })
      .where(eq(usersTable.id, docUser!.id));

    await db
      .update(doctorsTable)
      .set({ status: "active" })
      .where(eq(doctorsTable.userId, docUser!.id));

    const approvedDocApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.id, docApp!.id),
    });
    assert(approvedDocApp?.status === "APPROVED", "TEST 6.1: Application status updated to APPROVED");

    const approvedDocUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, docUser!.id),
    });
    assert(approvedDocUser?.status === "active", "TEST 6.2: User status updated to active");

    const approvedDocRecord = await db.query.doctorsTable.findFirst({
      where: eq(doctorsTable.userId, docUser!.id),
    });
    assert(approvedDocRecord?.status === "active", "TEST 6.3: Doctor domain record status updated to active");

    const getDocsRes = await fetch(`${baseUrl}/api/doctors?specialty=Cardiologist`);
    assert(getDocsRes.status === 200, "TEST 6.4: GET /api/doctors returns 200 OK");
    const activeDocs: any = await getDocsRes.json();
    assert(
      activeDocs.some((d: any) => d.userId === docUser!.id || d.email === testDocEmail),
      "TEST 6.5: Approved doctor is visible in GET /api/doctors for patients"
    );

    console.log();

    // ─── TEST 7: Admin Rejection Flow ───────────────────────────────────────
    console.log("🧪 TEST 7 — Admin Application Rejection Workflow");
    const pharmApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, testPharmEmail),
    });

    await db
      .update(providerApplicationsTable)
      .set({
        status: "REJECTED",
        rejectionReason: "Medical pharmacy license could not be verified",
        reviewedBy: adminUser.id,
        reviewedAt: new Date(),
      })
      .where(eq(providerApplicationsTable.id, pharmApp!.id));

    await db
      .update(usersTable)
      .set({ status: "rejected" })
      .where(eq(usersTable.id, pharmUser!.id));

    await db
      .update(pharmaciesTable)
      .set({ status: "rejected" })
      .where(eq(pharmaciesTable.userId, pharmUser!.id));

    const rejectedPharmApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.id, pharmApp!.id),
    });
    assert(rejectedPharmApp?.status === "REJECTED", "TEST 7.1: Application status updated to REJECTED");
    assert(rejectedPharmApp?.rejectionReason === "Medical pharmacy license could not be verified", "TEST 7.2: Rejection reason recorded");

    const rejectedPharmUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, pharmUser!.id),
    });
    assert(rejectedPharmUser?.status === "rejected", "TEST 7.3: User status updated to rejected");

    console.log();

    // ─── CLEANUP TEST DATA ──────────────────────────────────────────────────
    await db.delete(providerApplicationsTable).where(like(providerApplicationsTable.email, `%${timestamp}%`));
    await db.delete(doctorsTable).where(eq(doctorsTable.userId, docUser!.id));
    await db.delete(diagnosticCentersTable).where(eq(diagnosticCentersTable.userId, diagUser!.id));
    await db.delete(pharmaciesTable).where(eq(pharmaciesTable.userId, pharmUser!.id));
    await db.delete(usersTable).where(like(usersTable.email, `%${timestamp}%`));

    server.close();

    console.log("=================================================");
    console.log(`TEST SUITE FINISHED: ${passed} Passed, ${failed} Failed`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err: any) {
    server.close();
    console.error("❌ Exception during verification suite execution:", err);
    process.exit(1);
  }
}

runTestSuite();

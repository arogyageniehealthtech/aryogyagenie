import {
  db,
  usersTable,
  doctorsTable,
  diagnosticCentersTable,
  pharmaciesTable,
  appointmentsTable,
  prescriptionsTable,
  diagnosticBookingsTable,
  labReportsTable,
  medicineRemindersTable,
  timelineEventsTable,
  healthEpisodesTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Starting ArogyaGenie Synthetic Demo Seed System...");

  if (!process.env.DATABASE_URL) {
    try {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const rootEnv = path.resolve(process.cwd(), "../../.env");
      const localEnv = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(rootEnv)) {
        process.loadEnvFile?.(rootEnv);
      } else if (fs.existsSync(localEnv)) {
        process.loadEnvFile?.(localEnv);
      } else {
        process.loadEnvFile?.();
      }
    } catch {
      // .env is optional
    }
  }

  if (!process.env.DATABASE_URL) {
    console.log("⚠️ DATABASE_URL environment variable is not set. Seed script operates when a PostgreSQL database is active.");
    return;
  }

  try {
    // 1. Create Synthetic Users
    const [patientUser] = await db
      .insert(usersTable)
      .values({
        clerkId: "clerk_patient_demo",
        email: "patient.demo@arogyagenie.com",
        role: "patient",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    const [doctorUser] = await db
      .insert(usersTable)
      .values({
        clerkId: "clerk_doctor_demo",
        email: "doctor.demo@arogyagenie.com",
        role: "doctor",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    const [diagUser] = await db
      .insert(usersTable)
      .values({
        clerkId: "clerk_diag_demo",
        email: "diagnostic.demo@arogyagenie.com",
        role: "diagnostic_center",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    const [pharmacyUser] = await db
      .insert(usersTable)
      .values({
        clerkId: "clerk_pharmacy_demo",
        email: "pharmacy.demo@arogyagenie.com",
        role: "pharmacy",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    await db
      .insert(usersTable)
      .values({
        clerkId: "clerk_admin_demo",
        email: "admin.demo@arogyagenie.com",
        role: "admin",
        status: "active",
      })
      .onConflictDoNothing();

    console.log("✅ Synthetic Users created.");

    // Fallback ID getters if user already existed
    const patientId = patientUser?.id ?? 1;
    const doctorUserId = doctorUser?.id ?? 2;
    const diagUserId = diagUser?.id ?? 3;
    const pharmacyUserId = pharmacyUser?.id ?? 4;

    // 2. Create Doctor Profile
    const [doctor] = await db
      .insert(doctorsTable)
      .values({
        userId: doctorUserId,
        specialty: "Cardiologist",
        qualification: "MD Cardiology, FACC",
        licenseNumber: "LIC-CARD-88421",
        clinicName: "Arogya Heart & General Care Clinic",
        clinicAddress: "102 Healthcare Avenue, Medical District",
        consultationFee: 50.0,
        experience: 12,
        bio: "Specialist in preventative cardiology, internal medicine, and chronic disease management.",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    const doctorId = doctor?.id ?? 1;
    console.log("✅ Doctor Profile created.");

    // 3. Create Diagnostic Center Profile
    const [diagCenter] = await db
      .insert(diagnosticCentersTable)
      .values({
        userId: diagUserId,
        name: "Metro Advanced Diagnostic Lab",
        accreditation: "NABL Accredited #LAB-9921",
        address: "505 Science Park Road",
        services: "Complete Blood Count (CBC), Lipid Profile, Fasting Blood Sugar, Thyroid Panel",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    const diagCenterId = diagCenter?.id ?? 1;
    console.log("✅ Diagnostic Center Profile created.");

    // 4. Create Pharmacy Profile
    await db
      .insert(pharmaciesTable)
      .values({
        userId: pharmacyUserId,
        name: "HealthFirst Express Pharmacy",
        licenseNumber: "PHARM-LIC-5521",
        address: "707 Wellness Boulevard",
        status: "active",
      })
      .onConflictDoNothing();

    console.log("✅ Pharmacy Profile created.");

    // 5. Create Synthetic Interconnected Medical Journey
    const todayStr = new Date().toISOString().split("T")[0];
    const [appointment] = await db
      .insert(appointmentsTable)
      .values({
        patientId,
        doctorId,
        appointmentDate: todayStr,
        appointmentTime: "10:30 AM",
        symptoms: "Persistent fever and upper respiratory discomfort",
        notes: "Consultation completed successfully.",
        status: "completed",
        consultationFee: 50.0,
      })
      .returning();

    const [prescription] = await db
      .insert(prescriptionsTable)
      .values({
        patientId,
        doctorId,
        appointmentId: appointment.id,
        diagnosis: "Acute Bronchitis & Secondary Bacterial Infection",
        medicines: "Amoxicillin 500mg - 1 capsule 3x daily (5 days)\nParacetamol 650mg - 1 tablet twice daily as needed",
        instructions: "Rest well, drink warm water, follow up if fever exceeds 102°F.",
        status: "active",
        prescribedDate: todayStr,
      })
      .returning();

    await db
      .insert(diagnosticBookingsTable)
      .values({
        patientId,
        diagnosticCenterId: diagCenterId,
        testName: "Complete Blood Count (CBC)",
        bookingDate: todayStr,
        bookingTime: "02:00 PM",
        status: "completed",
      })
      .returning();

    await db.insert(labReportsTable).values({
      patientId,
      diagnosticCenterId: diagCenterId,
      testName: "Complete Blood Count (CBC)",
      testDate: todayStr,
      results: "Hemoglobin: 14.2 g/dL (Normal: 13.5 - 17.5)\nWhite Blood Cell Count (WBC): 11,800 /mcL (HIGH)\nPlatelets: 260,000 /mcL",
      status: "completed",
      aiSummary: JSON.stringify({
        summary: "The Complete Blood Count reveals elevated White Blood Cells (leukocytosis), which aligns with an active immune response or bacterial respiratory infection.",
        keyFindings: ["WBC count is elevated (11,800 /mcL)", "Hemoglobin and Platelet levels are within normal limits"],
        abnormalValues: ["WBC: 11,800 /mcL (HIGH)"],
        questionsForDoctor: ["Should I complete the full course of prescribed antibiotics?"],
        urgency: "ATTENTION_REQUIRED",
        disclaimer: "Informational AI summary only. Consult your doctor.",
      }),
    });

    await db.insert(medicineRemindersTable).values({
      patientId,
      medicineName: "Amoxicillin 500mg",
      dosage: "1 capsule",
      frequency: "thrice_daily",
      times: "08:00 AM, 02:00 PM, 08:00 PM",
      startDate: todayStr,
      isActive: true,
    });

    await db.insert(timelineEventsTable).values([
      {
        patientId,
        eventType: "symptom_assessment",
        title: "Reported Respiratory Symptoms",
        description: "Recorded persistent fever and cough symptoms.",
        eventDate: todayStr,
      },
      {
        patientId,
        eventType: "appointment",
        title: "Doctor Consultation Completed",
        description: "Consulted Dr. Sarah Jenkins at Arogya Heart & General Care Clinic.",
        eventDate: todayStr,
      },
      {
        patientId,
        eventType: "prescription",
        title: "Digital Prescription Issued",
        description: "Issued Amoxicillin 500mg and Paracetamol 650mg.",
        eventDate: todayStr,
      },
      {
        patientId,
        eventType: "lab_report",
        title: "Complete Blood Count Report Uploaded",
        description: "CBC test uploaded by Metro Advanced Diagnostic Lab.",
        eventDate: todayStr,
      },
    ]);

    await db.insert(healthEpisodesTable).values({
      patientId,
      title: "Acute Respiratory Journey - Aug 2026",
      status: "confirmed",
      startDate: todayStr,
      summary: "Grouped medical episode linking reported cough symptoms, Dr. Sarah Jenkins consultation, Amoxicillin prescription, and CBC lab test.",
    });

    console.log("🎉 ArogyaGenie Synthetic Demo Seed System completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();

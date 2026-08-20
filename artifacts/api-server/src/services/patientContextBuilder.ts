import {
  db,
  usersTable,
  timelineEventsTable,
  symptomAssessmentsTable,
  appointmentsTable,
  prescriptionsTable,
  labReportsTable,
  medicineRemindersTable,
  medicineOrdersTable,
  diagnosticBookingsTable,
  diagnosticCentersTable,
  healthEpisodesTable,
  doctorsTable,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import type { PatientModule } from "./aiDomainClassifier";

export interface PatientHealthContextData {
  patientId: number;
  profile?: {
    name?: string | null;
    age?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    allergies?: string | null;
    existingConditions?: string | null;
    currentMedications?: string | null;
    previousIllnesses?: string | null;
  };
  recentTimeline: Array<{ eventType: string; title: string; date: string; description?: string | null }>;
  recentSymptoms: Array<{
    symptoms: string;
    severity?: string | null;
    duration?: string | null;
    possibleConditions?: string | null;
    recommendedAction?: string | null;
    date: string;
  }>;
  recentAppointments: Array<{
    doctorName: string;
    specialty?: string | null;
    clinicOrHospital?: string | null;
    appointmentDate: string;
    appointmentTime?: string | null;
    type?: string | null;
    status: string;
    symptoms?: string | null;
    notes?: string | null;
  }>;
  recentPrescriptions: Array<{
    doctorName: string;
    diagnosis: string;
    medicines: string;
    instructions?: string | null;
    date: string;
    status?: string | null;
  }>;
  recentMedicineOrders: Array<{
    id: number;
    medicines: string;
    pharmacyName?: string | null;
    status: string;
    totalPrice?: number | null;
    date: string;
    notes?: string | null;
  }>;
  recentDiagnosticBookings: Array<{
    testName: string;
    centerName: string;
    bookingDate: string;
    status: string;
    price?: number | null;
  }>;
  recentLabReports: Array<{
    testName: string;
    results?: string | null;
    status: string;
    date: string;
    aiSummary?: string | null;
  }>;
  activeReminders: Array<{ medicineName: string; dosage: string; frequency: string; times?: string | null }>;
  activeEpisodes: Array<{ title: string; status: string; startDate: string; summary?: string | null }>;
}

/**
 * Build authorized, query-aware patient healthcare context.
 * If targetModules is specified, only relevant modules are queried.
 * Otherwise, retrieves complete patient context.
 */
export async function buildPatientHealthContext(
  patientId: number,
  targetModules?: PatientModule[]
): Promise<PatientHealthContextData> {
  const shouldQuery = (mod: PatientModule) => !targetModules || targetModules.includes(mod);

  // 1. Fetch Demographics & Profile
  const profilePromise = shouldQuery("profile")
    ? db.query.usersTable.findFirst({
        where: eq(usersTable.id, patientId),
      })
    : Promise.resolve<typeof usersTable.$inferSelect | undefined>(undefined);

  // 2. Fetch Health Timeline
  const timelinePromise = shouldQuery("timeline")
    ? db.query.timelineEventsTable.findMany({
        where: eq(timelineEventsTable.patientId, patientId),
        orderBy: [desc(timelineEventsTable.eventDate), desc(timelineEventsTable.createdAt)],
        limit: 15,
      })
    : Promise.resolve<typeof timelineEventsTable.$inferSelect[]>([]);

  // 3. Fetch Symptom Assessments
  const symptomsPromise = shouldQuery("symptoms")
    ? db.query.symptomAssessmentsTable.findMany({
        where: eq(symptomAssessmentsTable.patientId, patientId),
        orderBy: [desc(symptomAssessmentsTable.createdAt)],
        limit: 10,
      })
    : Promise.resolve<typeof symptomAssessmentsTable.$inferSelect[]>([]);

  // 4. Fetch Doctor Appointments
  const appointmentsPromise = shouldQuery("appointments")
    ? db.query.appointmentsTable.findMany({
        where: eq(appointmentsTable.patientId, patientId),
        orderBy: [desc(appointmentsTable.appointmentDate), desc(appointmentsTable.createdAt)],
        limit: 10,
      })
    : Promise.resolve<typeof appointmentsTable.$inferSelect[]>([]);

  // 5. Fetch Prescriptions
  const prescriptionsPromise = shouldQuery("prescriptions")
    ? db.query.prescriptionsTable.findMany({
        where: eq(prescriptionsTable.patientId, patientId),
        orderBy: [desc(prescriptionsTable.prescribedDate), desc(prescriptionsTable.createdAt)],
        limit: 10,
      })
    : Promise.resolve<typeof prescriptionsTable.$inferSelect[]>([]);

  // 6. Fetch Medicine Orders (Doorstep & OTC)
  const medicineOrdersPromise = shouldQuery("medicines")
    ? db.query.medicineOrdersTable.findMany({
        where: eq(medicineOrdersTable.patientId, patientId),
        orderBy: [desc(medicineOrdersTable.createdAt)],
        limit: 15,
      })
    : Promise.resolve<typeof medicineOrdersTable.$inferSelect[]>([]);

  // 7. Fetch Medicine Reminders
  const remindersPromise = shouldQuery("medicines")
    ? db.query.medicineRemindersTable.findMany({
        where: eq(medicineRemindersTable.patientId, patientId),
      })
    : Promise.resolve<typeof medicineRemindersTable.$inferSelect[]>([]);

  // 8. Fetch Diagnostic Center Bookings
  const diagnosticBookingsPromise = shouldQuery("diagnostics")
    ? db.query.diagnosticBookingsTable.findMany({
        where: eq(diagnosticBookingsTable.patientId, patientId),
        orderBy: [desc(diagnosticBookingsTable.bookingDate)],
        limit: 10,
      })
    : Promise.resolve<typeof diagnosticBookingsTable.$inferSelect[]>([]);

  // 9. Fetch Lab Reports
  const labReportsPromise = shouldQuery("lab_reports")
    ? db.query.labReportsTable.findMany({
        where: eq(labReportsTable.patientId, patientId),
        orderBy: [desc(labReportsTable.testDate), desc(labReportsTable.createdAt)],
        limit: 10,
      })
    : Promise.resolve<typeof labReportsTable.$inferSelect[]>([]);

  // 10. Fetch Health Episodes
  const episodesPromise = shouldQuery("episodes")
    ? db.query.healthEpisodesTable.findMany({
        where: eq(healthEpisodesTable.patientId, patientId),
        orderBy: [desc(healthEpisodesTable.startDate)],
        limit: 8,
      })
    : Promise.resolve<typeof healthEpisodesTable.$inferSelect[]>([]);

  const [
    userProfile,
    timeline,
    symptoms,
    appointments,
    prescriptions,
    medicineOrders,
    reminders,
    diagnosticBookings,
    labReports,
    episodes,
  ] = await Promise.all([
    profilePromise,
    timelinePromise,
    symptomsPromise,
    appointmentsPromise,
    prescriptionsPromise,
    medicineOrdersPromise,
    remindersPromise,
    diagnosticBookingsPromise,
    labReportsPromise,
    episodesPromise,
  ]);

  // Resolve Real Doctor Names and Clinics
  const doctorIds = Array.from(
    new Set([...appointments.map((a) => a.doctorId), ...prescriptions.map((p) => p.doctorId)])
  );

  const doctorMap = new Map<number, { name: string; specialty: string; clinic: string }>();
  if (doctorIds.length > 0) {
    try {
      const doctors = await db.query.doctorsTable.findMany({
        where: inArray(doctorsTable.id, doctorIds),
      });

      const doctorUserIds = doctors.map((d) => d.userId);
      const doctorUsers = doctorUserIds.length > 0
        ? await db.query.usersTable.findMany({
            where: inArray(usersTable.id, doctorUserIds),
          })
        : [];

      const userMap = new Map<number, typeof usersTable.$inferSelect>();
      for (const u of doctorUsers) {
        userMap.set(u.id, u);
      }

      for (const d of doctors) {
        const u = userMap.get(d.userId);
        const name = u
          ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || `Doctor #${d.id}`
          : `Doctor #${d.id}`;
        doctorMap.set(d.id, {
          name: name.startsWith("Dr.") ? name : `Dr. ${name}`,
          specialty: d.specialty || "General Physician",
          clinic: d.clinicName || "Clinic / Hospital",
        });
      }
    } catch (_e) {
      // Fallback
    }
  }

  // Resolve Diagnostic Center Names
  const centerIds = Array.from(new Set(diagnosticBookings.map((b) => b.diagnosticCenterId)));
  const centerMap = new Map<number, string>();
  if (centerIds.length > 0) {
    try {
      const centers = await db.query.diagnosticCentersTable.findMany({
        where: inArray(diagnosticCentersTable.id, centerIds),
      });
      for (const c of centers) {
        centerMap.set(c.id, c.name);
      }
    } catch (_e) {
      // Fallback
    }
  }

  return {
    patientId,
    profile: userProfile
      ? {
          name: `${userProfile.firstName || ""} ${userProfile.lastName || ""}`.trim() || userProfile.email || undefined,
          age: userProfile.age || userProfile.dateOfBirth,
          gender: userProfile.gender,
          bloodGroup: userProfile.bloodGroup,
          allergies: userProfile.allergies,
          existingConditions: userProfile.existingConditions,
          currentMedications: userProfile.currentMedications,
          previousIllnesses: userProfile.previousIllnesses,
        }
      : undefined,
    recentTimeline: timeline.map((t) => ({
      eventType: t.eventType,
      title: t.title,
      date: new Date(t.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      description: t.description,
    })),
    recentSymptoms: symptoms.map((s) => ({
      symptoms: s.symptoms,
      severity: s.severity,
      duration: s.duration,
      possibleConditions: s.possibleConditions,
      recommendedAction: s.recommendedAction,
      date: new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    })),
    recentAppointments: appointments.map((a) => {
      const docInfo = doctorMap.get(a.doctorId);
      return {
        doctorName: docInfo?.name || `Doctor #${a.doctorId}`,
        specialty: docInfo?.specialty || undefined,
        clinicOrHospital: docInfo?.clinic || undefined,
        appointmentDate: a.appointmentDate,
        appointmentTime: a.appointmentTime || undefined,
        type: a.type,
        status: a.status,
        symptoms: a.symptoms || undefined,
        notes: a.notes || undefined,
      };
    }),
    recentPrescriptions: prescriptions.map((p) => {
      const docInfo = doctorMap.get(p.doctorId);
      return {
        doctorName: docInfo?.name || `Doctor #${p.doctorId}`,
        diagnosis: p.diagnosis ?? "General Consultation",
        medicines: p.medicines,
        instructions: p.instructions || undefined,
        date: new Date(p.prescribedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        status: p.status || "active",
      };
    }),
    recentMedicineOrders: medicineOrders.map((o) => ({
      id: o.id,
      medicines: o.medicines,
      pharmacyName: o.pharmacyName || "Verified Pharmacy",
      status: o.status,
      totalPrice: o.totalPrice || undefined,
      date: new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      notes: o.notes || undefined,
    })),
    recentDiagnosticBookings: diagnosticBookings.map((b) => ({
      testName: b.testName,
      centerName: centerMap.get(b.diagnosticCenterId) || "Diagnostic Center",
      bookingDate: b.bookingDate,
      status: b.status,
      price: b.price || undefined,
    })),
    recentLabReports: labReports.map((r) => ({
      testName: r.testName,
      results: r.results,
      status: r.status,
      date: new Date(r.testDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      aiSummary: r.aiSummary,
    })),
    activeReminders: reminders
      .filter((r) => r.isActive)
      .map((r) => ({
        medicineName: r.medicineName,
        dosage: r.dosage,
        frequency: r.frequency,
        times: r.times || undefined,
      })),
    activeEpisodes: episodes.map((e) => ({
      title: e.title,
      status: e.status,
      startDate: e.startDate,
      summary: e.summary,
    })),
  };
}

/**
 * Format patient context data into clear, source-annotated clinical text block for Gemini.
 */
export function formatContextSummaryText(context: PatientHealthContextData): string {
  const sections: string[] = [];

  // Patient Profile & Demographics
  if (context.profile) {
    const profParts: string[] = [];
    if (context.profile.name) profParts.push(`Name: ${context.profile.name}`);
    if (context.profile.age) profParts.push(`Age: ${context.profile.age}`);
    if (context.profile.gender) profParts.push(`Gender: ${context.profile.gender}`);
    if (context.profile.bloodGroup) profParts.push(`Blood Group: ${context.profile.bloodGroup}`);
    if (context.profile.allergies) profParts.push(`Known Allergies: ${context.profile.allergies}`);
    if (context.profile.existingConditions) profParts.push(`Existing Chronic Conditions: ${context.profile.existingConditions}`);
    if (context.profile.currentMedications) profParts.push(`Medications on File: ${context.profile.currentMedications}`);
    if (context.profile.previousIllnesses) profParts.push(`Previous Major Illnesses: ${context.profile.previousIllnesses}`);

    if (profParts.length > 0) {
      sections.push(`[SOURCE: Patient Profile & Demographics]\n${profParts.map((p) => `• ${p}`).join("\n")}`);
    }
  }

  // Doctor Prescriptions
  if (context.recentPrescriptions.length > 0) {
    const lines = context.recentPrescriptions.map(
      (p) =>
        `• Date: ${p.date} | Prescribing Doctor: ${p.doctorName} | Diagnosis: ${p.diagnosis} | Prescribed Medicines: ${p.medicines}${
          p.instructions ? ` | Instructions: ${p.instructions}` : ""
        } | Status: ${p.status}`
    );
    sections.push(`[SOURCE: Doctor Prescriptions & Clinical Diagnoses]\n${lines.join("\n")}`);
  }

  // Medicine Orders & Doorstep Deliveries
  if (context.recentMedicineOrders.length > 0) {
    const lines = context.recentMedicineOrders.map(
      (o) =>
        `• Order #${o.id} on ${o.date} | Pharmacy: ${o.pharmacyName} | Status: ${o.status.toUpperCase()} | Medicines: ${o.medicines}${
          o.totalPrice ? ` | Billed: ₹${o.totalPrice}` : ""
        }${o.notes ? ` | Notes: ${o.notes}` : ""}`
    );
    sections.push(`[SOURCE: Medicine Orders & Doorstep Deliveries]\n${lines.join("\n")}`);
  }

  // Active / Scheduled Daily Medicine Reminders
  if (context.activeReminders.length > 0) {
    const lines = context.activeReminders.map(
      (m) => `• ${m.medicineName} | Dosage: ${m.dosage} | Frequency: ${m.frequency}${m.times ? ` | Times: ${m.times}` : ""}`
    );
    sections.push(`[SOURCE: Active Daily Medicine Schedules & Reminders]\n${lines.join("\n")}`);
  }

  // Lab Test Reports
  if (context.recentLabReports.length > 0) {
    const lines = context.recentLabReports.map(
      (r) =>
        `• Date: ${r.date} | Test: ${r.testName} | Status: ${r.status} | Quantitative / Qualitative Results: ${
          r.results || "Completed"
        }${r.aiSummary ? ` | Findings: ${r.aiSummary}` : ""}`
    );
    sections.push(`[SOURCE: Lab Reports & Diagnostic Findings]\n${lines.join("\n")}`);
  }

  // Diagnostic Test Bookings
  if (context.recentDiagnosticBookings.length > 0) {
    const lines = context.recentDiagnosticBookings.map(
      (b) => `• Date: ${b.bookingDate} | Test: ${b.testName} | Center: ${b.centerName} | Status: ${b.status}${b.price ? ` | Fee: ₹${b.price}` : ""}`
    );
    sections.push(`[SOURCE: Diagnostic Center Test Bookings]\n${lines.join("\n")}`);
  }

  // Doctor Appointments & Consultations
  if (context.recentAppointments.length > 0) {
    const lines = context.recentAppointments.map(
      (a) =>
        `• Date: ${a.appointmentDate}${a.appointmentTime ? ` at ${a.appointmentTime}` : ""} | Doctor: ${a.doctorName}${
          a.specialty ? ` (${a.specialty})` : ""
        }${a.clinicOrHospital ? ` at ${a.clinicOrHospital}` : ""} | Type: ${a.type} | Status: ${a.status.toUpperCase()}${
          a.symptoms ? ` | Reason/Symptoms: ${a.symptoms}` : ""
        }${a.notes ? ` | Consultation Notes: ${a.notes}` : ""}`
    );
    sections.push(`[SOURCE: Doctor Appointments & Consultations]\n${lines.join("\n")}`);
  }

  // Symptom Checker Assessments
  if (context.recentSymptoms.length > 0) {
    const lines = context.recentSymptoms.map(
      (s) =>
        `• Date: ${s.date} | Reported Symptoms: ${s.symptoms}${s.severity ? ` (Severity: ${s.severity})` : ""}${
          s.duration ? ` (Duration: ${s.duration})` : ""
        }${s.possibleConditions ? ` | Identified Possible Conditions: ${s.possibleConditions}` : ""}${
          s.recommendedAction ? ` | Recommended Action: ${s.recommendedAction}` : ""
        }`
    );
    sections.push(`[SOURCE: Symptom Checker Assessments & History]\n${lines.join("\n")}`);
  }

  // Health Timeline Events
  if (context.recentTimeline.length > 0) {
    const lines = context.recentTimeline.map((t) => `• [${t.date}] (${t.eventType}): ${t.title}${t.description ? ` - ${t.description}` : ""}`);
    sections.push(`[SOURCE: Health Timeline (Chronological Journal)]\n${lines.join("\n")}`);
  }

  // Health Episodes
  if (context.activeEpisodes.length > 0) {
    const lines = context.activeEpisodes.map((e) => `• Episode: ${e.title} (Status: ${e.status}, Started: ${e.startDate})${e.summary ? ` - ${e.summary}` : ""}`);
    sections.push(`[SOURCE: Active Health Episodes & Care Journeys]\n${lines.join("\n")}`);
  }

  if (sections.length === 0) {
    return "NO RECORDED HEALTHCARE HISTORY FOUND IN PATIENT PROFILE.";
  }

  return sections.join("\n\n");
}

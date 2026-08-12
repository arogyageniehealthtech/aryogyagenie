import { db, usersTable, timelineEventsTable, symptomAssessmentsTable, appointmentsTable, prescriptionsTable, labReportsTable, medicineRemindersTable, healthEpisodesTable, doctorsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

export interface PatientHealthContextData {
  patientId: number;
  profile?: {
    age?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    allergies?: string | null;
    existingConditions?: string | null;
    currentMedications?: string | null;
    previousIllnesses?: string | null;
  };
  recentTimeline: Array<{ eventType: string; title: string; date: string; description?: string | null }>;
  recentSymptoms: Array<{ symptoms: string; severity?: string | null; duration?: string | null; date: string }>;
  recentAppointments: Array<{ doctorName: string; appointmentDate: string; status: string }>;
  recentPrescriptions: Array<{ doctorName: string; diagnosis: string; medicines: string; date: string }>;
  recentLabReports: Array<{ testName: string; results?: string | null; status: string; date: string; aiSummary?: string | null }>;
  activeReminders: Array<{ medicineName: string; dosage: string; frequency: string }>;
  activeEpisodes: Array<{ title: string; status: string; startDate: string; summary?: string | null }>;
}

export async function buildPatientHealthContext(patientId: number): Promise<PatientHealthContextData> {
  const [userProfile, timeline, symptoms, appointments, prescriptions, labReports, reminders, episodes] = await Promise.all([
    db.query.usersTable.findFirst({
      where: eq(usersTable.id, patientId),
    }),
    db.query.timelineEventsTable.findMany({
      where: eq(timelineEventsTable.patientId, patientId),
      orderBy: [desc(timelineEventsTable.eventDate)],
      limit: 10,
    }),
    db.query.symptomAssessmentsTable.findMany({
      where: eq(symptomAssessmentsTable.patientId, patientId),
      orderBy: [desc(symptomAssessmentsTable.createdAt)],
      limit: 5,
    }),
    db.query.appointmentsTable.findMany({
      where: eq(appointmentsTable.patientId, patientId),
      orderBy: [desc(appointmentsTable.appointmentDate)],
      limit: 5,
    }),
    db.query.prescriptionsTable.findMany({
      where: eq(prescriptionsTable.patientId, patientId),
      orderBy: [desc(prescriptionsTable.prescribedDate)],
      limit: 5,
    }),
    db.query.labReportsTable.findMany({
      where: eq(labReportsTable.patientId, patientId),
      orderBy: [desc(labReportsTable.testDate)],
      limit: 5,
    }),
    db.query.medicineRemindersTable.findMany({
      where: eq(medicineRemindersTable.patientId, patientId),
    }),
    db.query.healthEpisodesTable.findMany({
      where: eq(healthEpisodesTable.patientId, patientId),
      orderBy: [desc(healthEpisodesTable.startDate)],
    }),
  ]);

  const doctorIds = Array.from(
    new Set([...appointments.map((a) => a.doctorId), ...prescriptions.map((p) => p.doctorId)])
  );

  const doctorMap = new Map<number, string>();
  if (doctorIds.length > 0) {
    const doctors = await db.query.doctorsTable.findMany({
      where: inArray(doctorsTable.id, doctorIds),
    });
    for (const d of doctors) {
      doctorMap.set(d.id, `Dr. ${d.specialty} (ID: #${d.id})`);
    }
  }

  return {
    patientId,
    profile: userProfile
      ? {
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
      date: new Date(t.eventDate).toLocaleDateString(),
      description: t.description,
    })),
    recentSymptoms: symptoms.map((s) => ({
      symptoms: s.symptoms,
      severity: s.severity,
      duration: s.duration,
      date: new Date(s.createdAt).toLocaleDateString(),
    })),
    recentAppointments: appointments.map((a) => ({
      doctorName: doctorMap.get(a.doctorId) || `Doctor #${a.doctorId}`,
      appointmentDate: new Date(a.appointmentDate).toLocaleDateString(),
      status: a.status,
    })),
    recentPrescriptions: prescriptions.map((p) => ({
      doctorName: doctorMap.get(p.doctorId) || `Doctor #${p.doctorId}`,
      diagnosis: p.diagnosis ?? "General Consultation",
      medicines: p.medicines,
      date: new Date(p.prescribedDate).toLocaleDateString(),
    })),
    recentLabReports: labReports.map((r) => ({
      testName: r.testName,
      results: r.results,
      status: r.status,
      date: new Date(r.testDate).toLocaleDateString(),
      aiSummary: r.aiSummary,
    })),
    activeReminders: reminders
      .filter((r) => r.isActive)
      .map((r) => ({
        medicineName: r.medicineName,
        dosage: r.dosage,
        frequency: r.frequency,
      })),
    activeEpisodes: episodes.map((e) => ({
      title: e.title,
      status: e.status,
      startDate: e.startDate,
      summary: e.summary,
    })),
  };
}

/** Convert health context to a concise text block for LLM inference. */
export function formatContextSummaryText(context: PatientHealthContextData): string {
  const lines: string[] = [];

  lines.push(`Patient ID: #${context.patientId}`);

  if (context.profile) {
    const profParts: string[] = [];
    if (context.profile.age) profParts.push(`Age: ${context.profile.age}`);
    if (context.profile.gender) profParts.push(`Gender: ${context.profile.gender}`);
    if (context.profile.bloodGroup) profParts.push(`Blood Group: ${context.profile.bloodGroup}`);
    if (context.profile.allergies) profParts.push(`Allergies: ${context.profile.allergies}`);
    if (context.profile.existingConditions) profParts.push(`Existing Conditions: ${context.profile.existingConditions}`);
    if (context.profile.currentMedications) profParts.push(`Current Medications: ${context.profile.currentMedications}`);
    if (context.profile.previousIllnesses) profParts.push(`Previous Illnesses: ${context.profile.previousIllnesses}`);

    if (profParts.length > 0) {
      lines.push("\nPatient Demographics & Medical Profile:");
      profParts.forEach((p) => lines.push(`• ${p}`));
    }
  }

  if (context.activeEpisodes.length > 0) {
    lines.push("\nActive Health Episodes:");
    context.activeEpisodes.forEach((e) => lines.push(`• [${e.status.toUpperCase()}] ${e.title} (Started ${e.startDate})`));
  }

  if (context.recentSymptoms.length > 0) {
    lines.push("\nRecent Symptom Reports:");
    context.recentSymptoms.forEach((s) => lines.push(`• ${s.date}: ${s.symptoms} (${s.severity ?? "Moderate"})`));
  }

  if (context.recentPrescriptions.length > 0) {
    lines.push("\nRecent Prescriptions:");
    context.recentPrescriptions.forEach((p) => lines.push(`• ${p.date} by ${p.doctorName}: ${p.diagnosis} ➔ ${p.medicines}`));
  }

  if (context.recentLabReports.length > 0) {
    lines.push("\nRecent Lab Reports:");
    context.recentLabReports.forEach((r) => lines.push(`• ${r.date}: ${r.testName} (${r.status}) - ${r.results ?? "Pending"}`));
  }

  if (context.activeReminders.length > 0) {
    lines.push("\nCurrent Active Medicines:");
    context.activeReminders.forEach((m) => lines.push(`• ${m.medicineName} ${m.dosage} (${m.frequency})`));
  }

  return lines.join("\n");
}

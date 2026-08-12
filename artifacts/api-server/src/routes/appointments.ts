import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, usersTable, appointmentsTable, doctorsTable,
  labReportsTable, medicineRemindersTable, prescriptionsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /appointments - patient's appointments
router.get("/appointments", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  let appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.patientId, req.userId!));
  if (status) appts = appts.filter((a) => a.status === status);

  const enriched = await Promise.all(
    appts.map(async (a) => {
      const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.id, a.doctorId) });
      const doctorUser = doctorRow ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, doctorRow.userId) }) : null;
      const patient = await db.query.usersTable.findFirst({ where: eq(usersTable.id, a.patientId) });
      return {
        ...a,
        patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null,
        doctorName: doctorUser ? `${doctorUser.firstName ?? ""} ${doctorUser.lastName ?? ""}`.trim() : null,
        doctorSpecialty: doctorRow?.specialty ?? null,
        consultationFee: a.consultationFee ?? null,
        createdAt: a.createdAt.toISOString(),
      };
    }),
  );

  res.json(enriched);
});

// POST /appointments
router.post("/appointments", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { doctorId, appointmentDate, appointmentTime, type, symptoms, notes } = req.body;
  if (!doctorId || !appointmentDate || !appointmentTime || !type) {
    res.status(400).json({ error: "doctorId, appointmentDate, appointmentTime, type are required" });
    return;
  }

  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.id, doctorId) });

  const [appt] = await db.insert(appointmentsTable).values({
    patientId: req.userId!,
    doctorId,
    appointmentDate,
    appointmentTime,
    type,
    symptoms,
    notes,
    consultationFee: doctorRow?.consultationFee ?? null,
  }).returning();

  res.status(201).json({
    ...appt,
    patientName: null, doctorName: null, doctorSpecialty: null,
    consultationFee: appt.consultationFee ?? null,
    createdAt: appt.createdAt.toISOString(),
  });
});

// GET /appointments/:id
router.get("/appointments/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const appt = await db.query.appointmentsTable.findFirst({ where: eq(appointmentsTable.id, id) });
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  res.json({
    ...appt,
    patientName: null, doctorName: null, doctorSpecialty: null,
    consultationFee: appt.consultationFee ?? null,
    createdAt: appt.createdAt.toISOString(),
  });
});

// PATCH /appointments/:id
router.patch("/appointments/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, notes, appointmentDate, appointmentTime } = req.body;
  const [appt] = await db
    .update(appointmentsTable)
    .set({ status, notes, appointmentDate, appointmentTime })
    .where(eq(appointmentsTable.id, id))
    .returning();

  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  res.json({
    ...appt,
    patientName: null, doctorName: null, doctorSpecialty: null,
    consultationFee: appt.consultationFee ?? null,
    createdAt: appt.createdAt.toISOString(),
  });
});

// GET /appointments/patient/dashboard
router.get("/appointments/patient/dashboard", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [user, appts, labReports, medicines, prescriptions] = await Promise.all([
    db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) }),
    db.select().from(appointmentsTable).where(eq(appointmentsTable.patientId, req.userId!)),
    db.select().from(labReportsTable).where(eq(labReportsTable.patientId, req.userId!)),
    db.select().from(medicineRemindersTable).where(and(eq(medicineRemindersTable.patientId, req.userId!), eq(medicineRemindersTable.isActive, true))),
    db.select().from(prescriptionsTable).where(eq(prescriptionsTable.patientId, req.userId!)),
  ]);

  const firstName = user?.firstName ?? null;
  const lastName = user?.lastName ?? null;
  const userName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : null;

  const upcoming = appts.filter((a) => a.appointmentDate >= today && a.status !== "cancelled");
  const recentAppts = appts
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((a) => ({ ...a, patientName: null, doctorName: null, doctorSpecialty: null, consultationFee: a.consultationFee ?? null, createdAt: a.createdAt.toISOString() }));

  const recentLabReports = labReports
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));

  res.json({
    userName,
    firstName,
    lastName,
    upcomingAppointments: upcoming.length,
    totalLabReports: labReports.length,
    activeMedicines: medicines.length,
    totalPrescriptions: prescriptions.length,
    recentAppointments: recentAppts,
    recentLabReports: recentLabReports,
    activeMedicineReminders: medicines.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

export default router;

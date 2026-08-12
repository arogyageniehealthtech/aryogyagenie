import { Router } from "express";
import { eq, or, and, sql, desc } from "drizzle-orm";
import { db, usersTable, doctorsTable, appointmentsTable, prescriptionsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

function matchDoctorSpecialty(docSpec: string | null | undefined, filterSpec: string): boolean {
  if (!docSpec) return false;
  const d = docSpec.toLowerCase();
  const f = filterSpec.toLowerCase();
  if (d === f || d.includes(f) || f.includes(d)) return true;

  const rootWords = [
    "cardio", "ortho", "pediatr", "dermat", "neuro", "pulmon", "gastro",
    "ent", "dent", "surg", "urol", "nephr", "oncol", "endocrin", "physician", "medicine", "practice"
  ];
  for (const root of rootWords) {
    if (d.includes(root) && f.includes(root)) return true;
  }
  return false;
}

// GET /doctors - list approved doctors
router.get("/doctors", async (req, res): Promise<void> => {
  const { specialty, search } = req.query as { specialty?: string; search?: string };

  const rows = await db
    .select({
      d: doctorsTable,
      u: {
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        avatarUrl: usersTable.avatarUrl,
        status: usersTable.status,
        role: usersTable.role,
      },
    })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(
      or(
        eq(doctorsTable.status, "active"),
        and(eq(usersTable.role, "doctor"), eq(usersTable.status, "active"))
      )
    );

  let result = rows.map((r) => ({
    id: r.d.id,
    userId: r.d.userId,
    firstName: r.u.firstName ?? "Doctor",
    lastName: r.u.lastName ?? "",
    email: r.u.email,
    avatarUrl: r.u.avatarUrl,
    specialty: r.d.specialty || "General Physician",
    qualification: r.d.qualification || "MBBS, MD",
    licenseNumber: r.d.licenseNumber,
    clinicName: r.d.clinicName || "ArogyaGenie Medical Center",
    clinicAddress: r.d.clinicAddress || "Health Tech City",
    consultationFee: r.d.consultationFee || 500,
    experience: r.d.experience || 5,
    bio: r.d.bio,
    rating: r.d.rating || "4.8",
    reviewCount: r.d.reviewCount || 12,
    status: "active",
    availableDays: r.d.availableDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
    availableHours: r.d.availableHours || "09:00 AM - 05:00 PM",
  }));

  if (specialty && specialty !== "all") {
    result = result.filter((d) => matchDoctorSpecialty(d.specialty, specialty));
  }
  if (search) {
    const s = search.toLowerCase();
    result = result.filter((d) =>
      d.firstName.toLowerCase().includes(s) ||
      d.lastName.toLowerCase().includes(s) ||
      d.specialty.toLowerCase().includes(s) ||
      (d.clinicName ?? "").toLowerCase().includes(s) ||
      (d.clinicAddress ?? "").toLowerCase().includes(s),
    );
  }

  res.json(result);
});

// GET /doctors/:id
router.get("/doctors/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const row = await db
    .select({ d: doctorsTable, u: usersTable })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(eq(doctorsTable.id, id))
    .limit(1);

  if (!row[0]) { res.status(404).json({ error: "Doctor not found" }); return; }

  const { d, u } = row[0];
  res.json({
    id: d.id, userId: d.userId,
    firstName: u.firstName ?? "", lastName: u.lastName ?? "",
    email: u.email, avatarUrl: u.avatarUrl,
    specialty: d.specialty, qualification: d.qualification,
    licenseNumber: d.licenseNumber, clinicName: d.clinicName,
    clinicAddress: d.clinicAddress, consultationFee: d.consultationFee,
    experience: d.experience, bio: d.bio, rating: d.rating,
    reviewCount: d.reviewCount, status: d.status,
    availableDays: d.availableDays, availableHours: d.availableHours,
  });
});

// GET /doctors/me/profile
router.get("/doctors/me/profile", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const row = await db
    .select({ d: doctorsTable, u: usersTable })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(eq(doctorsTable.userId, req.userId!))
    .limit(1);

  if (!row[0]) { res.status(404).json({ error: "Doctor profile not found" }); return; }
  const { d, u } = row[0];
  res.json({
    id: d.id, userId: d.userId,
    firstName: u.firstName ?? "", lastName: u.lastName ?? "",
    email: u.email, avatarUrl: u.avatarUrl,
    specialty: d.specialty, qualification: d.qualification,
    licenseNumber: d.licenseNumber, clinicName: d.clinicName,
    clinicAddress: d.clinicAddress, consultationFee: d.consultationFee,
    experience: d.experience, bio: d.bio, rating: d.rating,
    reviewCount: d.reviewCount, status: d.status,
    availableDays: d.availableDays, availableHours: d.availableHours,
  });
});

// PUT /doctors/me/profile
router.put("/doctors/me/profile", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { specialty, qualification, licenseNumber, clinicName, clinicAddress, consultationFee, experience, bio, availableDays, availableHours } = req.body;

  const [d] = await db
    .update(doctorsTable)
    .set({ specialty, qualification, licenseNumber, clinicName, clinicAddress, consultationFee, experience, bio, availableDays, availableHours })
    .where(eq(doctorsTable.userId, req.userId!))
    .returning();

  const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  res.json({
    id: d.id, userId: d.userId,
    firstName: u?.firstName ?? "", lastName: u?.lastName ?? "",
    email: u?.email ?? "", avatarUrl: u?.avatarUrl,
    specialty: d.specialty, qualification: d.qualification,
    licenseNumber: d.licenseNumber, clinicName: d.clinicName,
    clinicAddress: d.clinicAddress, consultationFee: d.consultationFee,
    experience: d.experience, bio: d.bio, rating: d.rating,
    reviewCount: d.reviewCount, status: d.status,
    availableDays: d.availableDays, availableHours: d.availableHours,
  });
});

// GET /doctors/me/dashboard
router.get("/doctors/me/dashboard", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const today = new Date().toISOString().split("T")[0];

  const [allAppts, todayAppts, patients, prescriptions] = await Promise.all([
    db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id)),
    db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id)),
    db.selectDistinct({ patientId: appointmentsTable.patientId }).from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id)),
    db.select().from(prescriptionsTable).where(eq(prescriptionsTable.doctorId, doctorRow.id)),
  ]);

  const todayCount = allAppts.filter((a) => a.appointmentDate === today).length;
  const pending = allAppts.filter((a) => a.status === "pending").length;
  const completed = allAppts.filter((a) => a.status === "completed").length;

  const upcoming = allAppts
    .filter((a) => a.appointmentDate >= today && a.status !== "cancelled")
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))
    .slice(0, 5);

  // Get recent patient details
  const recentPatientIds = [...new Set(allAppts.map((a) => a.patientId))].slice(0, 5);
  const recentPatientData = await Promise.all(
    recentPatientIds.map(async (pid) => {
      const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pid) });
      const visits = allAppts.filter((a) => a.patientId === pid).length;
      const lastVisit = allAppts
        .filter((a) => a.patientId === pid)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))[0]?.appointmentDate;
      return {
        id: pid,
        firstName: u?.firstName ?? "",
        lastName: u?.lastName ?? "",
        email: u?.email ?? "",
        avatarUrl: u?.avatarUrl ?? null,
        lastVisit: lastVisit ?? null,
        totalVisits: visits,
      };
    }),
  );

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  const firstName = user?.firstName ?? null;
  const lastName = user?.lastName ?? null;
  const userName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : null;

  res.json({
    userName,
    firstName,
    lastName,
    todayAppointments: todayCount,
    totalPatients: patients.length,
    pendingAppointments: pending,
    completedAppointments: completed,
    totalPrescriptions: prescriptions.length,
    upcomingAppointments: upcoming.map((a) => ({
      ...a,
      patientName: null, doctorName: null, doctorSpecialty: null,
      consultationFee: a.consultationFee ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    recentPatients: recentPatientData,
  });
});

// GET /doctors/me/appointments
router.get("/doctors/me/appointments", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const { status, date } = req.query as { status?: string; date?: string };
  let appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id));

  if (status) appts = appts.filter((a) => a.status === status);
  if (date) appts = appts.filter((a) => a.appointmentDate === date);

  const enriched = await Promise.all(
    appts.map(async (a) => {
      const patient = await db.query.usersTable.findFirst({ where: eq(usersTable.id, a.patientId) });
      const doctor = await db.query.usersTable.findFirst({ where: eq(usersTable.id, doctorRow.userId) });
      return {
        ...a,
        patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null,
        doctorName: doctor ? `${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`.trim() : null,
        doctorSpecialty: doctorRow.specialty,
        consultationFee: a.consultationFee ?? null,
        createdAt: a.createdAt.toISOString(),
      };
    }),
  );

  res.json(enriched);
});

// GET /doctors/me/patients
router.get("/doctors/me/patients", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id));
  const patientIds = [...new Set(appts.map((a) => a.patientId))];

  const patients = await Promise.all(
    patientIds.map(async (pid) => {
      const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pid) });
      const visits = appts.filter((a) => a.patientId === pid).length;
      const lastVisit = appts
        .filter((a) => a.patientId === pid)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))[0]?.appointmentDate;
      return {
        id: pid,
        firstName: u?.firstName ?? "",
        lastName: u?.lastName ?? "",
        email: u?.email ?? "",
        avatarUrl: u?.avatarUrl ?? null,
        lastVisit: lastVisit ?? null,
        totalVisits: visits,
      };
    }),
  );

  res.json(patients);
});

export default router;

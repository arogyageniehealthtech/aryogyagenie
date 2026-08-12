import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, doctorsTable, diagnosticCentersTable, pharmaciesTable, appointmentsTable, labReportsTable, providerApplicationsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /admin/stats
router.get("/admin/stats", requireAuth, requireRole(["admin"]), async (_req, res): Promise<void> => {
  const [users, doctors, diagnosticCenters, pharmacies, appointments, labReports, applications] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(doctorsTable),
    db.select().from(diagnosticCentersTable),
    db.select().from(pharmaciesTable),
    db.select().from(appointmentsTable),
    db.select().from(labReportsTable),
    db.select().from(providerApplicationsTable),
  ]);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const thisMonthStr = thisMonth.toISOString().split("T")[0];

  const doctorUserIds = new Set(users.filter((u) => u.role === "doctor").map((u) => u.id));
  const diagnosticUserIds = new Set(users.filter((u) => u.role === "diagnostic_center").map((u) => u.id));
  const pharmacyUserIds = new Set(users.filter((u) => u.role === "pharmacy").map((u) => u.id));
  const patientUserIds = new Set(users.filter((u) => u.role === "patient").map((u) => u.id));

  const validDoctors = doctors.filter((d) => doctorUserIds.has(d.userId));
  const validDiagnosticCenters = diagnosticCenters.filter((dc) => diagnosticUserIds.has(dc.userId));
  const validPharmacies = pharmacies.filter((p) => pharmacyUserIds.has(p.userId));
  const validAppointments = appointments.filter((a) => patientUserIds.has(a.patientId));
  const validLabReports = labReports.filter((lr) => patientUserIds.has(lr.patientId));

  const appointmentsThisMonth = validAppointments.filter((a) => a.appointmentDate >= thisMonthStr).length;
  const pendingAppsCount = applications.filter((a) => a.status === "PENDING").length;
  const pendingUsersCount = users.filter((u) => u.status === "pending" && u.role !== null && u.role !== "patient").length;
  const pendingApprovals = Math.max(pendingAppsCount, pendingUsersCount);
  const activeUsers = users.filter((u) => u.status === "active").length;

  const statusBreakdown = {
    pending: validAppointments.filter((a) => a.status === "pending").length,
    confirmed: validAppointments.filter((a) => a.status === "confirmed").length,
    completed: validAppointments.filter((a) => a.status === "completed").length,
    cancelled: validAppointments.filter((a) => a.status === "cancelled").length,
  };

  res.json({
    totalUsers: users.length,
    totalPatients: users.filter((u) => u.role === "patient").length,
    totalDoctors: validDoctors.length,
    totalDiagnosticCenters: validDiagnosticCenters.length,
    totalPharmacies: validPharmacies.length,
    totalAppointments: validAppointments.length,
    appointmentsThisMonth,
    totalLabReports: validLabReports.length,
    totalRevenue: 0,
    pendingApprovals,
    activeUsers,
    appointmentsByStatus: statusBreakdown,
  });
});

// GET /admin/users
router.get("/admin/users", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const { role, search } = req.query as { role?: string; search?: string };
  let users = await db.select().from(usersTable);

  // Provider applicants (Doctor, Diagnostic Center, Pharmacy) and unapproved accounts remain EXCLUSIVELY under Pending Applications.
  // Only active or suspended users appear in the Users directory and role directories.
  users = users.filter((u) => u.status === "active" || u.status === "suspended");

  if (role) users = users.filter((u) => u.role === role);
  if (search) {
    const s = search.toLowerCase();
    users = users.filter((u) =>
      (u.firstName ?? "").toLowerCase().includes(s) ||
      (u.lastName ?? "").toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s),
    );
  }

  res.json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

// PATCH /admin/users/:id/status
router.patch("/admin/users/:id/status", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status } = req.body;
  if (!["active", "suspended", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }

  const [user] = await db.update(usersTable).set({ status }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ...user, createdAt: user.createdAt.toISOString() });
});

// GET /admin/appointments
router.get("/admin/appointments", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  let appointments = await db.select().from(appointmentsTable);
  if (status) appointments = appointments.filter((a) => a.status === status);

  res.json(appointments.map((a) => ({
    ...a,
    patientName: null, doctorName: null, doctorSpecialty: null,
    consultationFee: a.consultationFee ?? null,
    createdAt: a.createdAt.toISOString(),
  })));
});

export default router;

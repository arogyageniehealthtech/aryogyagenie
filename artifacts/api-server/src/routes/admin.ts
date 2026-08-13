import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, doctorsTable, diagnosticCentersTable, pharmaciesTable, appointmentsTable, labReportsTable, providerApplicationsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /admin/stats
router.get("/admin/stats", requireAuth, requireRole(["admin"]), async (_req, res): Promise<void> => {
  const [users, doctors, diagnosticCenters, pharmacies, appointments, labReports, applications] = await Promise.all([
    db.select({ id: usersTable.id, role: usersTable.role, status: usersTable.status }).from(usersTable),
    db.select({ id: doctorsTable.id, userId: doctorsTable.userId }).from(doctorsTable),
    db.select({ id: diagnosticCentersTable.id, userId: diagnosticCentersTable.userId }).from(diagnosticCentersTable),
    db.select({ id: pharmaciesTable.id, userId: pharmaciesTable.userId }).from(pharmaciesTable),
    db.select({ id: appointmentsTable.id, patientId: appointmentsTable.patientId, appointmentDate: appointmentsTable.appointmentDate, status: appointmentsTable.status }).from(appointmentsTable),
    db.select({ id: labReportsTable.id, patientId: labReportsTable.patientId }).from(labReportsTable),
    db.select({ id: providerApplicationsTable.id, status: providerApplicationsTable.status }).from(providerApplicationsTable),
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
  const pagination = parsePaginationParams(req);

  let users = await db.select().from(usersTable);

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

  const total = users.length;
  setPaginationHeaders(res, total, pagination);

  const paginatedUsers = users.slice(pagination.offset, pagination.offset + pagination.limit);

  res.json(paginatedUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
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
  const pagination = parsePaginationParams(req);

  let appointments = await db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.createdAt));
  if (status) appointments = appointments.filter((a) => a.status === status);

  const total = appointments.length;
  setPaginationHeaders(res, total, pagination);

  const paginatedAppts = appointments.slice(pagination.offset, pagination.offset + pagination.limit);

  res.json(paginatedAppts.map((a) => ({
    ...a,
    patientName: null, doctorName: null, doctorSpecialty: null,
    consultationFee: a.consultationFee ?? null,
    createdAt: a.createdAt.toISOString(),
  })));
});

export default router;

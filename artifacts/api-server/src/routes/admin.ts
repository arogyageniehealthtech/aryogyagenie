import { Router } from "express";
import { eq, desc, and, or, gte, ne, ilike } from "drizzle-orm";
import { db, usersTable, doctorsTable, diagnosticCentersTable, pharmaciesTable, appointmentsTable, labReportsTable, providerApplicationsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /admin/stats
router.get("/admin/stats", requireAuth, requireRole(["admin"]), async (_req, res): Promise<void> => {
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const thisMonthStr = thisMonth.toISOString().split("T")[0];

  const [
    totalUsers,
    totalPatients,
    totalDoctors,
    totalDiagnosticCenters,
    totalPharmacies,
    totalAppointments,
    appointmentsThisMonth,
    totalLabReports,
    pendingAppsCount,
    pendingUsersCount,
    activeUsers,
    pendingAppts,
    confirmedAppts,
    completedAppts,
    cancelledAppts,
  ] = await Promise.all([
    db.$count(usersTable),
    db.$count(usersTable, eq(usersTable.role, "patient")),
    db.$count(doctorsTable),
    db.$count(diagnosticCentersTable),
    db.$count(pharmaciesTable),
    db.$count(appointmentsTable),
    db.$count(appointmentsTable, gte(appointmentsTable.appointmentDate, thisMonthStr)),
    db.$count(labReportsTable),
    db.$count(providerApplicationsTable, eq(providerApplicationsTable.status, "PENDING")),
    db.$count(usersTable, and(eq(usersTable.status, "pending"), ne(usersTable.role, "patient"))),
    db.$count(usersTable, eq(usersTable.status, "active")),
    db.$count(appointmentsTable, eq(appointmentsTable.status, "pending")),
    db.$count(appointmentsTable, eq(appointmentsTable.status, "confirmed")),
    db.$count(appointmentsTable, eq(appointmentsTable.status, "completed")),
    db.$count(appointmentsTable, eq(appointmentsTable.status, "cancelled")),
  ]);

  const pendingApprovals = Math.max(pendingAppsCount, pendingUsersCount);

  res.json({
    totalUsers,
    totalPatients,
    totalDoctors,
    totalDiagnosticCenters,
    totalPharmacies,
    totalAppointments,
    appointmentsThisMonth,
    totalLabReports,
    totalRevenue: 0,
    pendingApprovals,
    activeUsers,
    appointmentsByStatus: {
      pending: pendingAppts,
      confirmed: confirmedAppts,
      completed: completedAppts,
      cancelled: cancelledAppts,
    },
  });
});

// GET /admin/users
router.get("/admin/users", requireAuth, requireRole(["admin"]), async (req, res): Promise<void> => {
  const { role, search } = req.query as { role?: string; search?: string };
  const pagination = parsePaginationParams(req);

  const conditions = [
    or(eq(usersTable.status, "active"), eq(usersTable.status, "suspended")),
  ];

  if (role) {
    conditions.push(eq(usersTable.role, role as any));
  }
  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      or(
        ilike(usersTable.firstName, s),
        ilike(usersTable.lastName, s),
        ilike(usersTable.email, s)
      )
    );
  }

  const whereClause = and(...conditions);

  const [totalCountResult] = await db
    .select({ count: db.$count(usersTable, whereClause) })
    .from(usersTable);
  const total = totalCountResult?.count ?? 0;

  setPaginationHeaders(res, total, pagination);

  const paginatedUsers = await db
    .select()
    .from(usersTable)
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

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

  const whereClause = status ? eq(appointmentsTable.status, status as any) : undefined;

  const [totalCountResult] = await db
    .select({ count: db.$count(appointmentsTable, whereClause) })
    .from(appointmentsTable);
  const total = totalCountResult?.count ?? 0;

  setPaginationHeaders(res, total, pagination);

  const paginatedAppts = await db
    .select()
    .from(appointmentsTable)
    .where(whereClause)
    .orderBy(desc(appointmentsTable.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  res.json(paginatedAppts.map((a) => ({
    ...a,
    patientName: null, doctorName: null, doctorSpecialty: null,
    consultationFee: a.consultationFee ?? null,
    createdAt: a.createdAt.toISOString(),
  })));
});

export default router;

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, pharmaciesTable, usersTable, prescriptionsTable, doctorsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /pharmacies/me/profile
router.get("/pharmacies/me/profile", requireAuth, requireRole(["pharmacy"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const row = await db
    .select({ p: pharmaciesTable, u: usersTable })
    .from(pharmaciesTable)
    .innerJoin(usersTable, eq(pharmaciesTable.userId, usersTable.id))
    .where(eq(pharmaciesTable.userId, req.userId!))
    .limit(1);

  if (!row[0]) { res.status(404).json({ error: "Not found" }); return; }
  const { p, u } = row[0];
  res.json({ id: p.id, userId: p.userId, name: p.name, email: u.email, phone: p.phone, address: p.address, city: p.city, licenseNumber: p.licenseNumber, openingHours: p.openingHours, status: p.status });
});

// PUT /pharmacies/me/profile
router.put("/pharmacies/me/profile", requireAuth, requireRole(["pharmacy"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, phone, address, city, licenseNumber, openingHours } = req.body;
  const [p] = await db.update(pharmaciesTable).set({ name, phone, address, city, licenseNumber, openingHours }).where(eq(pharmaciesTable.userId, req.userId!)).returning();
  const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  res.json({ id: p.id, userId: p.userId, name: p.name, email: u?.email ?? "", phone: p.phone, address: p.address, city: p.city, licenseNumber: p.licenseNumber, openingHours: p.openingHours, status: p.status });
});

// GET /pharmacies/me/dashboard
router.get("/pharmacies/me/dashboard", requireAuth, requireRole(["pharmacy"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const pharmacy = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, req.userId!) });
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });

  const firstName = user?.firstName ?? null;
  const lastName = user?.lastName ?? null;
  const userName = pharmacy?.name || (user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null) || user?.email || "Pharmacy";

  const prescriptions = await db.select().from(prescriptionsTable);
  const today = new Date().toISOString().split("T")[0];
  const dispensedToday = prescriptions.filter((p) => p.status === "dispensed" && p.prescribedDate === today).length;
  const pending = prescriptions.filter((p) => p.status === "active").length;
  const recent = prescriptions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
    .map((p) => ({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() }));

  res.json({ userName, name: pharmacy?.name ?? userName, firstName, lastName, totalPrescriptions: prescriptions.length, pendingPrescriptions: pending, dispensedToday, recentPrescriptions: recent });
});

// GET /pharmacies/me/prescriptions
router.get("/pharmacies/me/prescriptions", requireAuth, requireRole(["pharmacy"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  let prescriptions = await db.select().from(prescriptionsTable);
  if (status) prescriptions = prescriptions.filter((p) => p.status === status);

  const enriched = await Promise.all(prescriptions.map(async (p) => {
    const patient = await db.query.usersTable.findFirst({ where: eq(usersTable.id, p.patientId) });
    const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.id, p.doctorId) });
    const doctorUser = doctorRow ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, doctorRow.userId) }) : null;
    return { ...p, patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null, doctorName: doctorUser ? `${doctorUser.firstName ?? ""} ${doctorUser.lastName ?? ""}`.trim() : null, createdAt: p.createdAt.toISOString() };
  }));

  res.json(enriched);
});

export default router;

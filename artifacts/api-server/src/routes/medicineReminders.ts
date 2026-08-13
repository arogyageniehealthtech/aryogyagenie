import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, medicineRemindersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /medicine-reminders
router.get("/medicine-reminders", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const pagination = parsePaginationParams(req);
  const whereClause = eq(medicineRemindersTable.patientId, req.userId!);

  const [totalCountResult] = await db
    .select({ count: db.$count(medicineRemindersTable, whereClause) })
    .from(medicineRemindersTable);
  const total = totalCountResult?.count ?? 0;

  const reminders = await db
    .select()
    .from(medicineRemindersTable)
    .where(whereClause)
    .orderBy(desc(medicineRemindersTable.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  setPaginationHeaders(res, total, pagination);

  res.json(reminders.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// POST /medicine-reminders
router.post("/medicine-reminders", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { medicineName, dosage, frequency, times, startDate, endDate, instructions } = req.body;
  if (!medicineName || !dosage || !frequency || !times || !startDate) {
    res.status(400).json({ error: "medicineName, dosage, frequency, times, startDate required" });
    return;
  }

  const [reminder] = await db.insert(medicineRemindersTable).values({
    patientId: req.userId!, medicineName, dosage, frequency, times, startDate, endDate, instructions,
  }).returning();

  res.status(201).json({ ...reminder, createdAt: reminder.createdAt.toISOString() });
});

// PATCH /medicine-reminders/:id
router.patch("/medicine-reminders/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const existingReminder = await db.query.medicineRemindersTable.findFirst({ where: eq(medicineRemindersTable.id, id) });
  if (!existingReminder) { res.status(404).json({ error: "Not found" }); return; }

  // Ownership check
  const isOwner = existingReminder.patientId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to modify this reminder." });
    return;
  }

  const { medicineName, dosage, frequency, times, endDate, instructions, isActive } = req.body;
  const [reminder] = await db.update(medicineRemindersTable).set({ medicineName, dosage, frequency, times, endDate, instructions, isActive }).where(eq(medicineRemindersTable.id, id)).returning();

  res.json({ ...reminder, createdAt: reminder.createdAt.toISOString() });
});

// DELETE /medicine-reminders/:id
router.delete("/medicine-reminders/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const existingReminder = await db.query.medicineRemindersTable.findFirst({ where: eq(medicineRemindersTable.id, id) });
  if (!existingReminder) { res.status(404).json({ error: "Not found" }); return; }

  // Ownership check
  const isOwner = existingReminder.patientId === req.userId;
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to delete this reminder." });
    return;
  }

  await db.delete(medicineRemindersTable).where(eq(medicineRemindersTable.id, id));
  res.sendStatus(204);
});

export default router;

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, diagnosticBookingsTable, usersTable, diagnosticCentersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /diagnostic-bookings
router.get("/diagnostic-bookings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const bookings = await db.select().from(diagnosticBookingsTable).where(eq(diagnosticBookingsTable.patientId, req.userId!));
  const enriched = await Promise.all(bookings.map(async (b) => {
    const center = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.id, b.diagnosticCenterId) });
    return { ...b, patientName: null, centerName: center?.name ?? null, createdAt: b.createdAt.toISOString() };
  }));
  res.json(enriched);
});

// POST /diagnostic-bookings
router.post("/diagnostic-bookings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { diagnosticCenterId, testName, bookingDate, bookingTime, notes } = req.body;
  if (!diagnosticCenterId || !testName || !bookingDate) {
    res.status(400).json({ error: "diagnosticCenterId, testName, bookingDate required" });
    return;
  }

  const [booking] = await db.insert(diagnosticBookingsTable).values({
    patientId: req.userId!, diagnosticCenterId, testName, bookingDate, bookingTime, notes,
  }).returning();

  res.status(201).json({ ...booking, patientName: null, centerName: null, createdAt: booking.createdAt.toISOString() });
});

// PATCH /diagnostic-bookings/:id
router.patch("/diagnostic-bookings/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, notes, price } = req.body;
  const [booking] = await db.update(diagnosticBookingsTable).set({ status, notes, price }).where(eq(diagnosticBookingsTable.id, id)).returning();
  if (!booking) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ...booking, patientName: null, centerName: null, createdAt: booking.createdAt.toISOString() });
});

export default router;

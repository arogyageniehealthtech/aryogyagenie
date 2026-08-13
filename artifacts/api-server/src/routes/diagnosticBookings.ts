import { Router } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { db, diagnosticBookingsTable, usersTable, diagnosticCentersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /diagnostic-bookings
router.get("/diagnostic-bookings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const pagination = parsePaginationParams(req);
  const whereClause = eq(diagnosticBookingsTable.patientId, req.userId!);

  const [totalCountResult] = await db
    .select({ count: db.$count(diagnosticBookingsTable, whereClause) })
    .from(diagnosticBookingsTable);
  const total = totalCountResult?.count ?? 0;

  const bookings = await db
    .select()
    .from(diagnosticBookingsTable)
    .where(whereClause)
    .orderBy(desc(diagnosticBookingsTable.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  setPaginationHeaders(res, total, pagination);

  if (bookings.length === 0) {
    res.json([]);
    return;
  }

  const centerIds = Array.from(new Set(bookings.map((b) => b.diagnosticCenterId)));
  const centers = centerIds.length > 0
    ? await db.select().from(diagnosticCentersTable).where(inArray(diagnosticCentersTable.id, centerIds))
    : [];
  const centerMap = new Map(centers.map((c) => [c.id, c]));

  const enriched = bookings.map((b) => {
    const center = centerMap.get(b.diagnosticCenterId);
    return { ...b, patientName: null, centerName: center?.name ?? null, createdAt: b.createdAt.toISOString() };
  });

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

  const existingBooking = await db.query.diagnosticBookingsTable.findFirst({ where: eq(diagnosticBookingsTable.id, id) });
  if (!existingBooking) { res.status(404).json({ error: "Not found" }); return; }

  // Ownership check
  const isPatient = existingBooking.patientId === req.userId;
  let isDiagnosticCenter = false;
  if (req.userRole === "diagnostic_center") {
    const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, req.userId!) });
    isDiagnosticCenter = dc?.id === existingBooking.diagnosticCenterId;
  }
  const isAdmin = req.userRole === "admin";

  if (!isPatient && !isDiagnosticCenter && !isAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to modify this booking." });
    return;
  }

  const { status, notes, price } = req.body;
  const [booking] = await db.update(diagnosticBookingsTable).set({ status, notes, price }).where(eq(diagnosticBookingsTable.id, id)).returning();

  res.json({ ...booking, patientName: null, centerName: null, createdAt: booking.createdAt.toISOString() });
});

export default router;

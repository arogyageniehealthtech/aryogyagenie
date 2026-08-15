import { Router } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { db, diagnosticCentersTable, usersTable, diagnosticBookingsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

import { parseCoordinates, clampRadiusKm, searchNearbyDiagnosticCenters } from "../lib/locationService";

// GET /diagnostic-centers (with optional location-based radius filtering)
router.get("/diagnostic-centers", async (req, res): Promise<void> => {
  const { search, service, lat, lng, radius } = req.query as {
    search?: string;
    service?: string;
    lat?: string;
    lng?: string;
    radius?: string;
  };
  const pagination = parsePaginationParams(req);

  const coords = parseCoordinates(lat, lng);

  if (coords) {
    const radiusKm = clampRadiusKm(radius);
    const { results, total } = await searchNearbyDiagnosticCenters({
      lat: coords.lat,
      lng: coords.lng,
      radiusKm,
      service,
      search,
      limit: pagination.limit,
      offset: pagination.offset,
    });

    setPaginationHeaders(res, total, pagination);
    res.json(results);
    return;
  }

  const rows = await db
    .select({ dc: diagnosticCentersTable, u: usersTable })
    .from(diagnosticCentersTable)
    .innerJoin(usersTable, eq(diagnosticCentersTable.userId, usersTable.id))
    .where(eq(diagnosticCentersTable.status, "active"));

  let result = rows.map((r) => ({
    id: r.dc.id, userId: r.dc.userId,
    name: r.dc.name, email: r.u.email,
    phone: r.dc.phone, address: r.dc.address,
    city: r.dc.city, state: r.dc.state, pincode: r.dc.pincode,
    accreditation: r.dc.accreditation,
    services: r.dc.services, openingHours: r.dc.openingHours,
    latitude: r.dc.latitude, longitude: r.dc.longitude,
    rating: r.dc.rating, status: r.dc.status,
  }));

  if (service && service.trim()) {
    const s = service.toLowerCase().trim();
    result = result.filter((c) => (c.services ?? "").toLowerCase().includes(s));
  }

  if (search) {
    const s = search.toLowerCase().trim();
    result = result.filter((c) =>
      c.name.toLowerCase().includes(s) ||
      (c.city ?? "").toLowerCase().includes(s) ||
      (c.services ?? "").toLowerCase().includes(s)
    );
  }

  const total = result.length;
  setPaginationHeaders(res, total, pagination);
  const paginatedResult = result.slice(pagination.offset, pagination.offset + pagination.limit);

  res.json(paginatedResult);
});

// GET /diagnostic-centers/me/profile
router.get("/diagnostic-centers/me/profile", requireAuth, requireRole(["diagnostic_center"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const row = await db
    .select({ dc: diagnosticCentersTable, u: usersTable })
    .from(diagnosticCentersTable)
    .innerJoin(usersTable, eq(diagnosticCentersTable.userId, usersTable.id))
    .where(eq(diagnosticCentersTable.userId, req.userId!))
    .limit(1);

  if (!row[0]) { res.status(404).json({ error: "Not found" }); return; }
  const { dc, u } = row[0];
  res.json({ id: dc.id, userId: dc.userId, name: dc.name, email: u.email, phone: dc.phone, address: dc.address, city: dc.city, accreditation: dc.accreditation, services: dc.services, openingHours: dc.openingHours, rating: dc.rating, status: dc.status });
});

// PUT /diagnostic-centers/me/profile
router.put("/diagnostic-centers/me/profile", requireAuth, requireRole(["diagnostic_center"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, phone, address, city, accreditation, services, openingHours } = req.body;
  const [dc] = await db.update(diagnosticCentersTable).set({ name, phone, address, city, accreditation, services, openingHours }).where(eq(diagnosticCentersTable.userId, req.userId!)).returning();
  const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  res.json({ id: dc.id, userId: dc.userId, name: dc.name, email: u?.email ?? "", phone: dc.phone, address: dc.address, city: dc.city, accreditation: dc.accreditation, services: dc.services, openingHours: dc.openingHours, rating: dc.rating, status: dc.status });
});

// GET /diagnostic-centers/me/dashboard
router.get("/diagnostic-centers/me/dashboard", requireAuth, requireRole(["diagnostic_center"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, req.userId!) });
  if (!dc) { res.status(404).json({ error: "Not found" }); return; }

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  const firstName = user?.firstName ?? null;
  const lastName = user?.lastName ?? null;
  const userName = dc.name || (user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null) || user?.email || "Diagnostic Center";

  const today = new Date().toISOString().split("T")[0];
  const bookings = await db.select().from(diagnosticBookingsTable).where(eq(diagnosticBookingsTable.diagnosticCenterId, dc.id));

  const todayCount = bookings.filter((b) => b.bookingDate === today).length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const recent = bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
    .map((b) => ({ ...b, patientName: null, centerName: null, createdAt: b.createdAt.toISOString() }));

  res.json({ userName, name: dc.name, firstName, lastName, totalBookings: bookings.length, pendingBookings: pending, completedBookings: completed, todayBookings: todayCount, recentBookings: recent });
});

// GET /diagnostic-centers/me/bookings
router.get("/diagnostic-centers/me/bookings", requireAuth, requireRole(["diagnostic_center"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, req.userId!) });
  if (!dc) { res.status(404).json({ error: "Not found" }); return; }

  const { status } = req.query as { status?: string };
  const pagination = parsePaginationParams(req);

  let bookings = await db.select().from(diagnosticBookingsTable).where(eq(diagnosticBookingsTable.diagnosticCenterId, dc.id));
  if (status) bookings = bookings.filter((b) => b.status === status);

  const total = bookings.length;
  setPaginationHeaders(res, total, pagination);

  const paginatedBookings = bookings.slice(pagination.offset, pagination.offset + pagination.limit);

  if (paginatedBookings.length === 0) {
    res.json([]);
    return;
  }

  const patientIds = Array.from(new Set(paginatedBookings.map((b) => b.patientId)));
  const patients = patientIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, patientIds))
    : [];
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const enriched = paginatedBookings.map((b) => {
    const patient = patientMap.get(b.patientId);
    return { ...b, patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null, centerName: dc.name, createdAt: b.createdAt.toISOString() };
  });

  res.json(enriched);
});

export default router;

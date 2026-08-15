import { Router } from "express";
import { eq, inArray, desc, or, isNull, and } from "drizzle-orm";
import { db, pharmaciesTable, usersTable, prescriptionsTable, doctorsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

import { parseCoordinates, clampRadiusKm, searchNearbyPharmacies, resolveProviderCoordinates } from "../lib/locationService";

// GET /pharmacies (public) - list active pharmacies (with optional location-based and medicine-inventory radius filtering)
router.get("/pharmacies", async (req, res): Promise<void> => {
  const { search, medicine, lat, lng, radius } = req.query as {
    search?: string;
    medicine?: string;
    lat?: string;
    lng?: string;
    radius?: string;
  };
  const pagination = parsePaginationParams(req);

  const coords = parseCoordinates(lat, lng);

  if (coords) {
    const radiusKm = clampRadiusKm(radius);
    const { results, total } = await searchNearbyPharmacies({
      lat: coords.lat,
      lng: coords.lng,
      radiusKm,
      medicine: medicine && medicine.trim() ? medicine.trim() : undefined,
      search: search && search.trim() ? search.trim() : undefined,
      limit: pagination.limit,
      offset: pagination.offset,
    });

    setPaginationHeaders(res, total, pagination);
    res.json(results);
    return;
  }

  const rows = await db
    .select({ p: pharmaciesTable, u: usersTable })
    .from(pharmaciesTable)
    .innerJoin(usersTable, eq(pharmaciesTable.userId, usersTable.id))
    .where(eq(pharmaciesTable.status, "active"));

  let result = rows.map((r) => ({
    id: r.p.id,
    userId: r.p.userId,
    name: r.p.name,
    email: r.u.email,
    phone: r.p.phone,
    address: r.p.address,
    city: r.p.city,
    state: r.p.state,
    pincode: r.p.pincode,
    licenseNumber: r.p.licenseNumber,
    openingHours: r.p.openingHours,
    latitude: r.p.latitude,
    longitude: r.p.longitude,
    status: r.p.status,
  }));

  if (search && search.trim()) {
    const s = search.toLowerCase().trim();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.city ?? "").toLowerCase().includes(s) ||
        (p.address ?? "").toLowerCase().includes(s)
    );
  }

  const total = result.length;
  setPaginationHeaders(res, total, pagination);
  const paginatedResult = result.slice(pagination.offset, pagination.offset + pagination.limit);
  res.json(paginatedResult);
});

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
  const { name, phone, address, city, licenseNumber, openingHours, latitude, longitude } = req.body;
  const existingPharm = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, req.userId!) });

  const effectiveAddress = address || existingPharm?.address || name;
  const addressChanged = Boolean(address && address !== existingPharm?.address);

  const resolvedCoords = await resolveProviderCoordinates({
    lat: addressChanged ? (latitude ?? undefined) : (latitude ?? existingPharm?.latitude),
    lng: addressChanged ? (longitude ?? undefined) : (longitude ?? existingPharm?.longitude),
    address: effectiveAddress,
    city: city || existingPharm?.city || "Kolkata",
  });

  const [p] = await db
    .update(pharmaciesTable)
    .set({
      name,
      phone,
      address,
      city,
      licenseNumber,
      openingHours,
      latitude: resolvedCoords.lat,
      longitude: resolvedCoords.lng,
    })
    .where(eq(pharmaciesTable.userId, req.userId!))
    .returning();

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

  if (!pharmacy) {
    res.json({ userName, name: userName, firstName, lastName, totalPrescriptions: 0, pendingPrescriptions: 0, dispensedToday: 0, recentPrescriptions: [] });
    return;
  }

  const pharmacyFilter = or(eq(prescriptionsTable.pharmacyId, pharmacy.id), isNull(prescriptionsTable.pharmacyId));
  const prescriptions = await db.select().from(prescriptionsTable).where(pharmacyFilter);
  const today = new Date().toISOString().split("T")[0];
  const dispensedToday = prescriptions.filter((p) => p.status === "dispensed" && p.prescribedDate === today).length;
  const pending = prescriptions.filter((p) => p.status === "active").length;
  const recent = prescriptions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5)
    .map((p) => ({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() }));

  res.json({ userName, name: pharmacy.name ?? userName, firstName, lastName, totalPrescriptions: prescriptions.length, pendingPrescriptions: pending, dispensedToday, recentPrescriptions: recent });
});

// GET /pharmacies/me/prescriptions
router.get("/pharmacies/me/prescriptions", requireAuth, requireRole(["pharmacy"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  const pagination = parsePaginationParams(req);

  const pharmacy = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, req.userId!) });
  if (!pharmacy) {
    res.json([]);
    return;
  }

  const pharmacyFilter = or(eq(prescriptionsTable.pharmacyId, pharmacy.id), isNull(prescriptionsTable.pharmacyId));
  const whereClause = status
    ? and(pharmacyFilter, eq(prescriptionsTable.status, status as "active" | "dispensed" | "expired"))
    : pharmacyFilter;

  const [totalCountResult] = await db
    .select({ count: db.$count(prescriptionsTable, whereClause) })
    .from(prescriptionsTable);
  const total = totalCountResult?.count ?? 0;
  setPaginationHeaders(res, total, pagination);

  const paginatedPrescriptions = await db
    .select()
    .from(prescriptionsTable)
    .where(whereClause)
    .orderBy(desc(prescriptionsTable.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  if (paginatedPrescriptions.length === 0) {
    res.json([]);
    return;
  }

  const patientIds = Array.from(new Set(paginatedPrescriptions.map((p) => p.patientId)));
  const patientsList = patientIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, patientIds))
    : [];
  const patientMap = new Map(patientsList.map((u) => [u.id, u]));

  const doctorIds = Array.from(new Set(paginatedPrescriptions.map((p) => p.doctorId)));
  const doctorsList = doctorIds.length > 0
    ? await db.select().from(doctorsTable).where(inArray(doctorsTable.id, doctorIds))
    : [];
  const doctorMap = new Map(doctorsList.map((d) => [d.id, d]));

  const doctorUserIds = Array.from(new Set(doctorsList.map((d) => d.userId)));
  const doctorUsersList = doctorUserIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, doctorUserIds))
    : [];
  const doctorUserMap = new Map(doctorUsersList.map((u) => [u.id, u]));

  const enriched = paginatedPrescriptions.map((p) => {
    const patient = patientMap.get(p.patientId);
    const doctorRow = doctorMap.get(p.doctorId);
    const doctorUser = doctorRow ? doctorUserMap.get(doctorRow.userId) : null;
    return {
      ...p,
      patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null,
      doctorName: doctorUser ? `${doctorUser.firstName ?? ""} ${doctorUser.lastName ?? ""}`.trim() : null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  res.json(enriched);
});

export default router;

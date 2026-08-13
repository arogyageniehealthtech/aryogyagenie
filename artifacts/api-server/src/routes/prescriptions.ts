import { Router } from "express";
import { eq, inArray, desc, or, isNull } from "drizzle-orm";
import { db, prescriptionsTable, usersTable, doctorsTable, pharmaciesTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /prescriptions
router.get("/prescriptions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  const pagination = parsePaginationParams(req);

  let whereClause;
  if (user?.role === "doctor") {
    const doctor = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
    if (!doctor) { res.json([]); return; }
    whereClause = eq(prescriptionsTable.doctorId, doctor.id);
  } else if (user?.role === "pharmacy") {
    const pharmacy = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, req.userId!) });
    if (!pharmacy) { res.json([]); return; }
    whereClause = or(eq(prescriptionsTable.pharmacyId, pharmacy.id), isNull(prescriptionsTable.pharmacyId));
  } else if (user?.role === "admin") {
    whereClause = undefined;
  } else {
    whereClause = eq(prescriptionsTable.patientId, req.userId!);
  }

  const [totalCountResult] = await db
    .select({ count: db.$count(prescriptionsTable, whereClause) })
    .from(prescriptionsTable);
  const total = totalCountResult?.count ?? 0;

  const prescriptions = whereClause
    ? await db
        .select()
        .from(prescriptionsTable)
        .where(whereClause)
        .orderBy(desc(prescriptionsTable.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset)
    : await db
        .select()
        .from(prescriptionsTable)
        .orderBy(desc(prescriptionsTable.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset);

  setPaginationHeaders(res, total, pagination);

  if (prescriptions.length === 0) {
    res.json([]);
    return;
  }

  // Batch query patients
  const patientIds = Array.from(new Set(prescriptions.map((p) => p.patientId)));
  const patientsList = patientIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, patientIds))
    : [];
  const patientMap = new Map(patientsList.map((u) => [u.id, u]));

  // Batch query doctors
  const doctorIds = Array.from(new Set(prescriptions.map((p) => p.doctorId)));
  const doctorsList = doctorIds.length > 0
    ? await db.select().from(doctorsTable).where(inArray(doctorsTable.id, doctorIds))
    : [];
  const doctorMap = new Map(doctorsList.map((d) => [d.id, d]));

  const doctorUserIds = Array.from(new Set(doctorsList.map((d) => d.userId)));
  const doctorUsersList = doctorUserIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, doctorUserIds))
    : [];
  const doctorUserMap = new Map(doctorUsersList.map((u) => [u.id, u]));

  const enriched = prescriptions.map((p) => {
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

// POST /prescriptions
router.post("/prescriptions", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { patientId, appointmentId, pharmacyId, medicines, diagnosis, instructions, fileUrl, prescribedDate } = req.body;
  if (!patientId || !medicines || !prescribedDate) {
    res.status(400).json({ error: "patientId, medicines, prescribedDate required" });
    return;
  }

  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const [p] = await db.insert(prescriptionsTable).values({
    patientId, doctorId: doctorRow.id, appointmentId: appointmentId ?? null,
    pharmacyId: pharmacyId ?? null,
    medicines, diagnosis, instructions, fileUrl, prescribedDate,
  }).returning();

  res.status(201).json({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() });
});

// GET /prescriptions/:id
router.get("/prescriptions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const p = await db.query.prescriptionsTable.findFirst({ where: eq(prescriptionsTable.id, id) });
  if (!p) { res.status(404).json({ error: "Not found" }); return; }

  // Authorization check (Patient, issuing Doctor, authorized Pharmacy, or Admin)
  const isPatient = p.patientId === req.userId;
  let isIssuingDoctor = false;
  if (req.userRole === "doctor") {
    const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
    isIssuingDoctor = doctorRow?.id === p.doctorId;
  }

  let isAuthorizedPharmacy = false;
  if (req.userRole === "pharmacy") {
    const pharmacy = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, req.userId!) });
    if (pharmacy && (p.pharmacyId === null || p.pharmacyId === pharmacy.id)) {
      isAuthorizedPharmacy = true;
    }
  }

  const isAdmin = req.userRole === "admin";

  if (!isPatient && !isIssuingDoctor && !isAuthorizedPharmacy && !isAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to view this prescription." });
    return;
  }

  res.json({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() });
});

// PATCH /prescriptions/:id
router.patch("/prescriptions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const existingP = await db.query.prescriptionsTable.findFirst({ where: eq(prescriptionsTable.id, id) });
  if (!existingP) { res.status(404).json({ error: "Not found" }); return; }

  // Authorization check (issuing Doctor, authorized Pharmacy, or Admin)
  let isIssuingDoctor = false;
  if (req.userRole === "doctor") {
    const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
    isIssuingDoctor = doctorRow?.id === existingP.doctorId;
  }

  let pharmacyRow = null;
  let isAuthorizedPharmacy = false;
  if (req.userRole === "pharmacy") {
    pharmacyRow = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, req.userId!) });
    if (pharmacyRow && (existingP.pharmacyId === null || existingP.pharmacyId === pharmacyRow.id)) {
      isAuthorizedPharmacy = true;
    }
  }

  const isAdmin = req.userRole === "admin";

  if (!isIssuingDoctor && !isAuthorizedPharmacy && !isAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to modify this prescription." });
    return;
  }

  const { status, diagnosis, medicines, instructions } = req.body;
  const updatePayload: Record<string, any> = { status, diagnosis, medicines, instructions };
  
  if (isAuthorizedPharmacy && pharmacyRow && existingP.pharmacyId === null) {
    updatePayload.pharmacyId = pharmacyRow.id;
  }

  const [p] = await db
    .update(prescriptionsTable)
    .set(updatePayload)
    .where(eq(prescriptionsTable.id, id))
    .returning();

  res.json({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() });
});

export default router;

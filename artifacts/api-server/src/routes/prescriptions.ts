import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, prescriptionsTable, usersTable, doctorsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /prescriptions
router.get("/prescriptions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
  let prescriptions;

  if (user?.role === "doctor") {
    const doctor = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
    if (!doctor) { res.json([]); return; }
    prescriptions = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.doctorId, doctor.id));
  } else if (user?.role === "pharmacy") {
    prescriptions = await db.select().from(prescriptionsTable);
  } else {
    prescriptions = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.patientId, req.userId!));
  }

  const enriched = await Promise.all(
    prescriptions.map(async (p) => {
      const patient = await db.query.usersTable.findFirst({ where: eq(usersTable.id, p.patientId) });
      const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.id, p.doctorId) });
      const doctorUser = doctorRow ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, doctorRow.userId) }) : null;
      return {
        ...p,
        patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null,
        doctorName: doctorUser ? `${doctorUser.firstName ?? ""} ${doctorUser.lastName ?? ""}`.trim() : null,
        createdAt: p.createdAt.toISOString(),
      };
    }),
  );

  res.json(enriched);
});

// POST /prescriptions
router.post("/prescriptions", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { patientId, appointmentId, medicines, diagnosis, instructions, fileUrl, prescribedDate } = req.body;
  if (!patientId || !medicines || !prescribedDate) {
    res.status(400).json({ error: "patientId, medicines, prescribedDate required" });
    return;
  }

  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const [p] = await db.insert(prescriptionsTable).values({
    patientId, doctorId: doctorRow.id, appointmentId: appointmentId ?? null,
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

  res.json({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() });
});

// PATCH /prescriptions/:id
router.patch("/prescriptions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, diagnosis, medicines, instructions } = req.body;
  const [p] = await db
    .update(prescriptionsTable)
    .set({ status, diagnosis, medicines, instructions })
    .where(eq(prescriptionsTable.id, id))
    .returning();

  if (!p) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ...p, patientName: null, doctorName: null, createdAt: p.createdAt.toISOString() });
});

export default router;

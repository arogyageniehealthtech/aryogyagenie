import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, labReportsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /lab-reports
router.get("/lab-reports", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const reports = await db.select().from(labReportsTable).where(eq(labReportsTable.patientId, req.userId!));
  res.json(reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

import { analyzeLabReport } from "../services/aiGateway";

// POST /lab-reports
router.post("/lab-reports", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { testName, testDate, fileUrl, results, patientId } = req.body;
  if (!testName || !testDate) {
    res.status(400).json({ error: "testName and testDate are required" });
    return;
  }

  let aiSummaryStr: string | null = null;
  if (results) {
    try {
      const analysis = await analyzeLabReport({ testName, results, testDate });
      aiSummaryStr = JSON.stringify(analysis);
    } catch (_err) {
      // Ignore AI failure on creation
    }
  }

  const targetPatientId = req.userRole === "diagnostic_center" || req.userRole === "doctor" ? (patientId ?? req.userId!) : req.userId!;

  const [report] = await db.insert(labReportsTable).values({
    patientId: targetPatientId,
    testName, testDate, fileUrl, results, aiSummary: aiSummaryStr,
  }).returning();

  res.status(201).json({ ...report, createdAt: report.createdAt.toISOString() });
});

// POST /lab-reports/:id/analyze
router.post("/lab-reports/:id/analyze", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const report = await db.query.labReportsTable.findFirst({ where: eq(labReportsTable.id, id) });
  if (!report) { res.status(404).json({ error: "Not found" }); return; }

  const analysis = await analyzeLabReport({
    testName: report.testName,
    results: report.results ?? undefined,
    testDate: report.testDate,
  });

  const aiSummaryStr = JSON.stringify(analysis);
  const [updated] = await db.update(labReportsTable).set({ aiSummary: aiSummaryStr }).where(eq(labReportsTable.id, id)).returning();

  res.json({ ...updated, analysis, createdAt: updated.createdAt.toISOString() });
});

// GET /lab-reports/:id
router.get("/lab-reports/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const report = await db.query.labReportsTable.findFirst({ where: eq(labReportsTable.id, id) });
  if (!report) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ...report, createdAt: report.createdAt.toISOString() });
});

// PATCH /lab-reports/:id
router.patch("/lab-reports/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { aiSummary, results, status, fileUrl } = req.body;
  const [report] = await db.update(labReportsTable).set({ aiSummary, results, status, fileUrl }).where(eq(labReportsTable.id, id)).returning();
  if (!report) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ...report, createdAt: report.createdAt.toISOString() });
});

export default router;

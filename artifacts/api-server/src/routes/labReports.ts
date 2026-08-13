import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, labReportsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /lab-reports
router.get("/lab-reports", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const pagination = parsePaginationParams(req);
  const whereClause = eq(labReportsTable.patientId, req.userId!);

  const [totalCountResult] = await db
    .select({ count: db.$count(labReportsTable, whereClause) })
    .from(labReportsTable);
  const total = totalCountResult?.count ?? 0;

  const reports = await db
    .select()
    .from(labReportsTable)
    .where(whereClause)
    .orderBy(desc(labReportsTable.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  setPaginationHeaders(res, total, pagination);

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

import { strictAiRateLimiter } from "../middlewares/rateLimiter";
import { diagnosticCentersTable } from "@workspace/db";

// POST /lab-reports/:id/analyze
router.post("/lab-reports/:id/analyze", requireAuth, strictAiRateLimiter, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const report = await db.query.labReportsTable.findFirst({ where: eq(labReportsTable.id, id) });
  if (!report) { res.status(404).json({ error: "Not found" }); return; }

  // Ownership check
  const isPatient = report.patientId === req.userId;
  let isDiagnosticCenter = false;
  if (req.userRole === "diagnostic_center" && report.diagnosticCenterId) {
    const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, req.userId!) });
    isDiagnosticCenter = dc?.id === report.diagnosticCenterId;
  }
  const isDoctorOrAdmin = req.userRole === "doctor" || req.userRole === "admin";

  if (!isPatient && !isDiagnosticCenter && !isDoctorOrAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to analyze this lab report." });
    return;
  }

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

  // Ownership check
  const isPatient = report.patientId === req.userId;
  let isDiagnosticCenter = false;
  if (req.userRole === "diagnostic_center" && report.diagnosticCenterId) {
    const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, req.userId!) });
    isDiagnosticCenter = dc?.id === report.diagnosticCenterId;
  }
  const isDoctorOrAdmin = req.userRole === "doctor" || req.userRole === "admin";

  if (!isPatient && !isDiagnosticCenter && !isDoctorOrAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to view this lab report." });
    return;
  }

  res.json({ ...report, createdAt: report.createdAt.toISOString() });
});

// PATCH /lab-reports/:id
router.patch("/lab-reports/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const existingReport = await db.query.labReportsTable.findFirst({ where: eq(labReportsTable.id, id) });
  if (!existingReport) { res.status(404).json({ error: "Not found" }); return; }

  // Ownership check
  const isPatient = existingReport.patientId === req.userId;
  let isDiagnosticCenter = false;
  if (req.userRole === "diagnostic_center" && existingReport.diagnosticCenterId) {
    const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, req.userId!) });
    isDiagnosticCenter = dc?.id === existingReport.diagnosticCenterId;
  }
  const isDoctorOrAdmin = req.userRole === "doctor" || req.userRole === "admin";

  if (!isPatient && !isDiagnosticCenter && !isDoctorOrAdmin) {
    res.status(403).json({ error: "Access denied. You are not authorized to modify this lab report." });
    return;
  }

  const { aiSummary, results, status, fileUrl } = req.body;
  const [report] = await db.update(labReportsTable).set({ aiSummary, results, status, fileUrl }).where(eq(labReportsTable.id, id)).returning();

  res.json({ ...report, createdAt: report.createdAt.toISOString() });
});

export default router;

import { Router } from "express";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  generatePatientHealthSummary,
  detectHealthEpisodes,
  analyzeLabTrends,
  generateDoctorPatientBriefing,
  answerLongitudinalAssistant,
} from "../services/longitudinalAIService";
import { db, healthEpisodesTable } from "@workspace/db";

const router = Router();

// GET /patients/me/health-summary
router.get("/patients/me/health-summary", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const patientId = req.userId!;
  const summary = await generatePatientHealthSummary(patientId);
  res.json(summary);
});

// GET /patients/me/health-episodes
router.get("/patients/me/health-episodes", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const patientId = req.userId!;
  const episodes = await detectHealthEpisodes(patientId);
  res.json(episodes);
});

// POST /patients/me/health-episodes
router.post("/patients/me/health-episodes", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const patientId = req.userId!;
  const { title, startDate, summary, status } = req.body;

  const [newEpisode] = await db
    .insert(healthEpisodesTable)
    .values({
      patientId,
      title: title || "New Health Episode",
      startDate: startDate || new Date().toISOString().split("T")[0],
      summary: summary || "",
      status: status || "confirmed",
    })
    .returning();

  res.json(newEpisode);
});

// GET /patients/me/lab-trends
router.get("/patients/me/lab-trends", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const patientId = req.userId!;
  const trends = await analyzeLabTrends(patientId);
  res.json(trends);
});

// GET /doctors/patients/:patientId/ai-summary
router.get(
  "/doctors/patients/:patientId/ai-summary",
  requireAuth,
  requireRole(["doctor", "admin"]),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const rawPid = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const targetPatientId = parseInt(rawPid, 10);
    if (isNaN(targetPatientId)) {
      res.status(400).json({ error: "Invalid patient ID" });
      return;
    }

    const briefing = await generateDoctorPatientBriefing(targetPatientId, req.userId!);
    res.json(briefing);
  }
);

// POST /ai/health-assistant
router.post("/ai/health-assistant", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { query } = req.body;
  if (!query) {
    res.status(400).json({ error: "Query string is required" });
    return;
  }

  const queryStr = typeof query === "string" ? query : String(query);
  const response = await answerLongitudinalAssistant(req.userId!, queryStr);
  res.json(response);
});

export default router;

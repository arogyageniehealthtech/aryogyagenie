import { Router } from "express";
import { searchMedicalKnowledge } from "../services/ragService";
import { strictAiRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

// GET /medical-knowledge/search
router.get("/medical-knowledge/search", strictAiRateLimiter, async (req, res): Promise<void> => {
  const { q, limit } = req.query as { q?: string; limit?: string };
  if (!q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  const topK = limit ? parseInt(limit, 10) : 3;
  const results = await searchMedicalKnowledge(q, topK);
  res.json(results);
});

export default router;

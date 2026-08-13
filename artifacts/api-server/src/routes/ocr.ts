import { Router } from "express";
import { processOCR, type OCRInput } from "../services/ocrService";
import { requireAuth } from "../middlewares/requireAuth";
import { strictAiRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

// POST /ocr/extract
router.post("/ocr/extract", requireAuth, strictAiRateLimiter, async (req, res): Promise<void> => {
  const input: OCRInput = req.body;
  if (!input.rawText && !input.imageBase64 && !input.fileUrl) {
    res.status(400).json({ error: "At least one of rawText, imageBase64, or fileUrl is required" });
    return;
  }

  const result = processOCR(input);
  res.json(result);
});

export default router;

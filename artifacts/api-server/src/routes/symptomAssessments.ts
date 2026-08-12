import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, symptomAssessmentsTable, timelineEventsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { analyzeSymptoms, generateFollowUpQuestions } from "../services/aiGateway";

const router = Router();

/**
 * Validates a duration string — accepts any non-empty duration text string.
 */
function isValidDuration(duration: string): boolean {
  return duration.trim().length > 0;
}

// GET /symptom-assessments
router.get("/symptom-assessments", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const assessments = await db
    .select()
    .from(symptomAssessmentsTable)
    .where(eq(symptomAssessmentsTable.patientId, req.userId!));

  res.json(
    assessments
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))
  );
});

// POST /symptom-assessments/follow-up (Stage 1 -> Generate Follow-up Questions / Emergency Check)
router.post("/symptom-assessments/follow-up", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { symptoms, severity, duration, additionalNotes } = req.body;
  if (!symptoms) {
    res.status(400).json({ error: "symptoms is required" });
    return;
  }

  // Backend duration validation
  if (duration && !isValidDuration(duration)) {
    res.status(400).json({
      error: "Invalid duration format. Please include a time unit, for example: '3 days', '2 weeks', '5 hours', '30 minutes'.",
      field: "duration",
    });
    return;
  }

  const followUpResult = await generateFollowUpQuestions({
    symptoms,
    severity,
    duration,
    additionalNotes,
    patientId: req.userId!,
  });

  res.json(followUpResult);
});

// POST /symptom-assessments (Stage 2 -> Final Structured Assessment Generation & Save)
router.post("/symptom-assessments", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { symptoms, severity, duration, additionalNotes, followUpQuestions, followUpAnswers } = req.body;
  if (!symptoms) {
    res.status(400).json({ error: "symptoms is required" });
    return;
  }

  // Backend duration validation
  if (duration && !isValidDuration(duration)) {
    res.status(400).json({
      error: "Invalid duration format. Please include a time unit, for example: '3 days', '2 weeks', '5 hours', '30 minutes'.",
      field: "duration",
    });
    return;
  }

  const aiAssessment = await analyzeSymptoms({
    symptoms,
    severity,
    duration,
    additionalNotes,
    followUpQuestions,
    followUpAnswers,
    patientId: req.userId!,
  });

  // Block saving INVALID_INPUT assessments — do not persist garbage to assessment history
  if (aiAssessment.assessmentStatus === "INVALID_INPUT") {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: aiAssessment.invalidInputMessage || "Your symptoms description does not appear to contain recognizable health information. Please describe your symptoms clearly.",
      assessmentStatus: "INVALID_INPUT",
    });
    return;
  }

  const [assessment] = await db
    .insert(symptomAssessmentsTable)
    .values({
      patientId: req.userId!,
      symptoms: additionalNotes ? `${symptoms} - ${additionalNotes}` : symptoms,
      severity: severity ?? null,
      duration: duration ?? null,
      aiResponse: aiAssessment.aiResponse,
      possibleConditions: aiAssessment.possibleConditions,
      recommendedAction: aiAssessment.recommendedAction,
      urgencyLevel: aiAssessment.urgencyLevel,
      assessmentStatus: aiAssessment.assessmentStatus ?? "COMPLETED",
      recommendedSpecialty: aiAssessment.recommendedSpecialty ?? null,
      followUpQuestions: followUpQuestions ?? null,
      followUpAnswers: followUpAnswers ?? null,
      riskFactors: aiAssessment.riskFactors ?? null,
      structuredAssessment: aiAssessment.structuredAssessment ?? null,
      sources: aiAssessment.sources ?? null,
    })
    .returning();

  // Create linked timeline event referencing canonical assessment.id
  try {
    const today = new Date().toISOString().split("T")[0];
    await db.insert(timelineEventsTable).values({
      patientId: req.userId!,
      eventType: "symptom_assessment",
      title: `AI Symptom Assessment: ${symptoms.slice(0, 45)}`,
      description: `Possible Conditions: ${aiAssessment.possibleConditions} | Urgency: ${aiAssessment.urgencyLevel}`,
      referenceId: assessment.id,
      eventDate: today,
    });
  } catch (tErr) {
    console.warn("Could not insert timeline event for symptom assessment:", tErr);
  }

  res.status(201).json({ ...assessment, createdAt: assessment.createdAt.toISOString() });
});

export default router;

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, timelineEventsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /timeline
router.get("/timeline", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const events = await db
    .select()
    .from(timelineEventsTable)
    .where(eq(timelineEventsTable.patientId, req.userId!));

  const sorted = events.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  res.json(sorted.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })));
});

export default router;

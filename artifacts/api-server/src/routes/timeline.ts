import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, timelineEventsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

// GET /timeline
router.get("/timeline", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const pagination = parsePaginationParams(req);
  const whereClause = eq(timelineEventsTable.patientId, req.userId!);

  const [totalCountResult] = await db
    .select({ count: db.$count(timelineEventsTable, whereClause) })
    .from(timelineEventsTable);
  const total = totalCountResult?.count ?? 0;

  const events = await db
    .select()
    .from(timelineEventsTable)
    .where(whereClause)
    .orderBy(desc(timelineEventsTable.eventDate))
    .limit(pagination.limit)
    .offset(pagination.offset);

  setPaginationHeaders(res, total, pagination);

  res.json(events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })));
});

export default router;

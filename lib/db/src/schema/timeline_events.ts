import { pgTable, text, serial, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timelineEventsTable = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  eventType: text("event_type", { enum: ["appointment", "prescription", "lab_report", "diagnostic_booking", "symptom_assessment", "medicine_reminder"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  referenceId: integer("reference_id"),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_timeline_events_patient_id").on(table.patientId),
  index("idx_timeline_events_date").on(table.eventDate),
]);

export const insertTimelineEventSchema = createInsertSchema(timelineEventsTable).omit({ id: true, createdAt: true });
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type TimelineEvent = typeof timelineEventsTable.$inferSelect;

import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const patientAiSummariesTable = pgTable("patient_ai_summaries", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  summaryType: text("summary_type", { enum: ["patient_overview", "doctor_briefing", "episode_summary"] })
    .notNull()
    .default("patient_overview"),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PatientAiSummary = typeof patientAiSummariesTable.$inferSelect;
export type NewPatientAiSummary = typeof patientAiSummariesTable.$inferInsert;

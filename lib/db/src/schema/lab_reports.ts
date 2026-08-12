import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const labReportsTable = pgTable("lab_reports", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  diagnosticCenterId: integer("diagnostic_center_id"),
  testName: text("test_name").notNull(),
  testDate: date("test_date", { mode: "string" }).notNull(),
  fileUrl: text("file_url"),
  aiSummary: text("ai_summary"),
  results: text("results"),
  status: text("status", { enum: ["pending", "completed", "reviewed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLabReportSchema = createInsertSchema(labReportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLabReport = z.infer<typeof insertLabReportSchema>;
export type LabReport = typeof labReportsTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const symptomAssessmentsTable = pgTable("symptom_assessments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  symptoms: text("symptoms").notNull(),
  severity: text("severity", { enum: ["mild", "moderate", "severe"] }),
  duration: text("duration"),
  aiResponse: text("ai_response"),
  possibleConditions: text("possible_conditions"),
  recommendedAction: text("recommended_action"),
  urgencyLevel: text("urgency_level"),
  assessmentStatus: text("assessment_status"), // VALID | INVALID_INPUT | EMERGENCY | COMPLETED
  recommendedSpecialty: text("recommended_specialty"),
  followUpQuestions: jsonb("follow_up_questions").$type<string[]>(),
  followUpAnswers: jsonb("follow_up_answers").$type<Record<string, string>>(),
  riskFactors: jsonb("risk_factors").$type<string[]>(),
  structuredAssessment: jsonb("structured_assessment").$type<Record<string, any>>(),
  sources: jsonb("sources").$type<any[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSymptomAssessmentSchema = createInsertSchema(symptomAssessmentsTable).omit({ id: true, createdAt: true });
export type InsertSymptomAssessment = z.infer<typeof insertSymptomAssessmentSchema>;
export type SymptomAssessment = typeof symptomAssessmentsTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const prescriptionsTable = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  appointmentId: integer("appointment_id"),
  pharmacyId: integer("pharmacy_id"),
  medicines: text("medicines").notNull(),
  diagnosis: text("diagnosis"),
  instructions: text("instructions"),
  fileUrl: text("file_url"),
  status: text("status", { enum: ["active", "dispensed", "expired"] }).notNull().default("active"),
  prescribedDate: date("prescribed_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_prescriptions_patient_id").on(table.patientId),
  index("idx_prescriptions_doctor_id").on(table.doctorId),
  index("idx_prescriptions_pharmacy_id").on(table.pharmacyId),
  index("idx_prescriptions_status").on(table.status),
]);

export const insertPrescriptionSchema = createInsertSchema(prescriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type Prescription = typeof prescriptionsTable.$inferSelect;

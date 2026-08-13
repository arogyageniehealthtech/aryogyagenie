import { pgTable, text, serial, timestamp, integer, boolean, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const medicineRemindersTable = pgTable("medicine_reminders", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency", { enum: ["once_daily", "twice_daily", "thrice_daily", "every_8_hours", "weekly", "as_needed"] }).notNull(),
  times: text("times").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  instructions: text("instructions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_medicine_reminders_patient_id").on(table.patientId),
]);

export const insertMedicineReminderSchema = createInsertSchema(medicineRemindersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMedicineReminder = z.infer<typeof insertMedicineReminderSchema>;
export type MedicineReminder = typeof medicineRemindersTable.$inferSelect;

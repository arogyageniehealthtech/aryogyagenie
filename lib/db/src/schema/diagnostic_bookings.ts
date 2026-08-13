import { pgTable, text, serial, timestamp, real, integer, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diagnosticBookingsTable = pgTable("diagnostic_bookings", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  diagnosticCenterId: integer("diagnostic_center_id").notNull(),
  testName: text("test_name").notNull(),
  bookingDate: date("booking_date", { mode: "string" }).notNull(),
  bookingTime: text("booking_time"),
  status: text("status", { enum: ["pending", "confirmed", "completed", "cancelled"] }).notNull().default("pending"),
  price: real("price"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_diagnostic_bookings_patient_id").on(table.patientId),
  index("idx_diagnostic_bookings_center_id").on(table.diagnosticCenterId),
  index("idx_diagnostic_bookings_status").on(table.status),
]);

export const insertDiagnosticBookingSchema = createInsertSchema(diagnosticBookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiagnosticBooking = z.infer<typeof insertDiagnosticBookingSchema>;
export type DiagnosticBooking = typeof diagnosticBookingsTable.$inferSelect;

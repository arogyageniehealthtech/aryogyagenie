import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diagnosticCentersTable = pgTable("diagnostic_centers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  accreditation: text("accreditation"),
  services: text("services"),
  openingHours: text("opening_hours"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  rating: real("rating").default(0),
  status: text("status", { enum: ["pending", "active", "suspended", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDiagnosticCenterSchema = createInsertSchema(diagnosticCentersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiagnosticCenter = z.infer<typeof insertDiagnosticCenterSchema>;
export type DiagnosticCenter = typeof diagnosticCentersTable.$inferSelect;

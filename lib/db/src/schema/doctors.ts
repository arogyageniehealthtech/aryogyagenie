import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  specialty: text("specialty").notNull(),
  qualification: text("qualification"),
  licenseNumber: text("license_number"),
  clinicName: text("clinic_name"),
  clinicAddress: text("clinic_address"),
  consultationFee: real("consultation_fee"),
  experience: integer("experience"),
  bio: text("bio"),
  rating: real("rating").default(0),
  reviewCount: integer("review_count").notNull().default(0),
  status: text("status", { enum: ["pending", "active", "suspended", "rejected"] }).notNull().default("pending"),
  availableDays: text("available_days"),
  availableHours: text("available_hours"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;

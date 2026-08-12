import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  role: text("role", { enum: ["patient", "doctor", "diagnostic_center", "pharmacy", "admin"] }),
  status: text("status", { enum: ["pending", "active", "suspended", "rejected"] }).notNull().default("pending"),
  avatarUrl: text("avatar_url"),
  dateOfBirth: text("date_of_birth"),
  age: text("age"),
  gender: text("gender"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  bloodGroup: text("blood_group"),
  allergies: text("allergies"),
  existingConditions: text("existing_conditions"),
  currentMedications: text("current_medications"),
  previousIllnesses: text("previous_illnesses"),
  emergencyContact: text("emergency_contact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

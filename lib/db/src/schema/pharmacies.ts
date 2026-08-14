import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pharmaciesTable = pgTable("pharmacies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  licenseNumber: text("license_number"),
  openingHours: text("opening_hours"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  status: text("status", { enum: ["pending", "active", "suspended", "rejected"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPharmacySchema = createInsertSchema(pharmaciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;
export type Pharmacy = typeof pharmaciesTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerApplicationsTable = pgTable("provider_applications", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["DOCTOR", "DIAGNOSTIC_CENTER", "PHARMACY"] }).notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] }).notNull().default("PENDING"),
  userId: integer("user_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  specialty: text("specialty"),
  address: text("address"),
  city: text("city"),
  details: text("details"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_provider_applications_status").on(table.status),
  index("idx_provider_applications_email").on(table.email),
  index("idx_provider_applications_user_id").on(table.userId),
]);

export const insertProviderApplicationSchema = createInsertSchema(providerApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProviderApplication = z.infer<typeof insertProviderApplicationSchema>;
export type ProviderApplication = typeof providerApplicationsTable.$inferSelect;

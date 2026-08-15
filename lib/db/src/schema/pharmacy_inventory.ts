import { pgTable, serial, integer, real, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pharmacyInventoryTable = pgTable("pharmacy_inventory", {
  id: serial("id").primaryKey(),
  pharmacyId: integer("pharmacy_id").notNull(),
  medicineId: integer("medicine_id").notNull(),
  price: real("price"),
  inStock: boolean("in_stock").notNull().default(true),
  quantity: integer("quantity").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_pharmacy_inventory_pharmacy_id").on(table.pharmacyId),
  index("idx_pharmacy_inventory_medicine_id").on(table.medicineId),
  unique("unq_pharmacy_medicine").on(table.pharmacyId, table.medicineId),
]);

export const insertPharmacyInventorySchema = createInsertSchema(pharmacyInventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPharmacyInventory = z.infer<typeof insertPharmacyInventorySchema>;
export type PharmacyInventory = typeof pharmacyInventoryTable.$inferSelect;

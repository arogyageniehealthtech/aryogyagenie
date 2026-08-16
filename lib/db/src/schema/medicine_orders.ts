import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const medicineOrdersTable = pgTable("medicine_orders", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  pharmacyId: integer("pharmacy_id"),
  prescriptionId: integer("prescription_id"),
  medicines: text("medicines").notNull(),
  patientName: text("patient_name"),
  patientPhone: text("patient_phone"),
  patientAddress: text("patient_address"),
  patientLat: real("patient_lat"),
  patientLng: real("patient_lng"),
  pharmacyName: text("pharmacy_name"),
  pharmacyAddress: text("pharmacy_address"),
  pharmacyLat: real("pharmacy_lat"),
  pharmacyLng: real("pharmacy_lng"),
  status: text("status", {
    enum: [
      "requested",
      "accepted",
      "delivery_confirmed",
      "packing",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ],
  }).notNull().default("requested"),
  totalPrice: real("total_price"),
  estimatedDeliveryMins: integer("estimated_delivery_mins").default(15),
  deliveryDistanceKm: real("delivery_distance_km"),
  deliveryPartnerName: text("delivery_partner_name"),
  deliveryPartnerPhone: text("delivery_partner_phone"),
  deliveryPartnerVehicle: text("delivery_partner_vehicle"),
  deliveryOtp: text("delivery_otp"),
  paymentMethod: text("payment_method").default("cash_on_delivery"),
  paymentStatus: text("payment_status").default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_med_orders_patient_id").on(table.patientId),
  index("idx_med_orders_pharmacy_id").on(table.pharmacyId),
  index("idx_med_orders_status").on(table.status),
  index("idx_med_orders_prescription_id").on(table.prescriptionId),
]);

export const insertMedicineOrderSchema = createInsertSchema(medicineOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMedicineOrder = z.infer<typeof insertMedicineOrderSchema>;
export type MedicineOrder = typeof medicineOrdersTable.$inferSelect;

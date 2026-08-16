import { Router } from "express";
import { eq, or, desc, and, isNull, inArray } from "drizzle-orm";
import {
  db,
  pool,
  medicineOrdersTable,
  pharmaciesTable,
  usersTable,
  prescriptionsTable,
  type MedicineOrder,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

const router = Router();

function parseParamId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return parseInt(str ?? "", 10);
}

// Ensure medicine_orders table exists
let tableChecked = false;
async function ensureMedicineOrdersTable() {
  if (tableChecked) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicine_orders (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        pharmacy_id INTEGER,
        prescription_id INTEGER,
        medicines TEXT NOT NULL,
        patient_name TEXT,
        patient_phone TEXT,
        patient_address TEXT,
        patient_lat REAL,
        patient_lng REAL,
        pharmacy_name TEXT,
        pharmacy_address TEXT,
        pharmacy_lat REAL,
        pharmacy_lng REAL,
        status TEXT NOT NULL DEFAULT 'requested',
        total_price REAL,
        estimated_delivery_mins INTEGER DEFAULT 15,
        delivery_distance_km REAL,
        delivery_partner_name TEXT,
        delivery_partner_phone TEXT,
        delivery_partner_vehicle TEXT,
        delivery_otp TEXT,
        payment_method TEXT DEFAULT 'cash_on_delivery',
        payment_status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_med_orders_patient_id ON medicine_orders (patient_id);
      CREATE INDEX IF NOT EXISTS idx_med_orders_pharmacy_id ON medicine_orders (pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_med_orders_status ON medicine_orders (status);
      CREATE INDEX IF NOT EXISTS idx_med_orders_prescription_id ON medicine_orders (prescription_id);
    `);
    tableChecked = true;
  } catch (err) {
    console.error("Error ensuring medicine_orders table:", err);
  }
}

// Haversine distance calculator
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

// Generate a random 4-digit OTP for delivery verification
function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Delivery partner pool
const DELIVERY_PARTNERS = [
  { name: "Rahul Sharma", phone: "+91 98301 22894", vehicle: "WB-02-AX-8912 (EV Scooter)" },
  { name: "Amitav Mondal", phone: "+91 98745 61230", vehicle: "WB-04-ER-3391 (Hero Electric)" },
  { name: "Vikram Sen", phone: "+91 91234 56789", vehicle: "WB-01-BK-4092 (Ather 450X)" },
  { name: "Snehasish Roy", phone: "+91 94321 09876", vehicle: "WB-06-QW-7810 (Ola S1 Pro)" },
];

// ─── GET /medicine-orders ──────────────────────────────────────────────────
// Returns list of medicine orders based on authenticated role
router.get("/medicine-orders", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await ensureMedicineOrdersTable();
  try {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const { status } = req.query as { status?: string };
    const pagination = parsePaginationParams(req);

    let whereClause: any;
    let pharmacyRecord: any = null;

    if (user.role === "pharmacy") {
      pharmacyRecord = await db.query.pharmaciesTable.findFirst({
        where: eq(pharmaciesTable.userId, req.userId!),
      });

      if (!pharmacyRecord) {
        res.json([]);
        return;
      }

      // Pharmacies see:
      // 1. Orders assigned to / accepted by them
      // 2. Open unassigned patient requests / search inquiries waiting for acceptance (status = 'requested')
      const pharmacyFilter = or(
        eq(medicineOrdersTable.pharmacyId, pharmacyRecord.id),
        and(eq(medicineOrdersTable.status, "requested"), isNull(medicineOrdersTable.pharmacyId)),
        eq(medicineOrdersTable.status, "requested")
      );

      whereClause = status
        ? and(pharmacyFilter, eq(medicineOrdersTable.status, status as any))
        : pharmacyFilter;
    } else if (user.role === "admin") {
      whereClause = status ? eq(medicineOrdersTable.status, status as any) : undefined;
    } else {
      // Patient role
      const patientFilter = eq(medicineOrdersTable.patientId, req.userId!);
      whereClause = status
        ? and(patientFilter, eq(medicineOrdersTable.status, status as any))
        : patientFilter;
    }

    const orders = await db
      .select()
      .from(medicineOrdersTable)
      .where(whereClause)
      .orderBy(desc(medicineOrdersTable.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    // If pharmacy role, enrich orders with real-time stock matching
    if (pharmacyRecord) {
      const inventoryItems = await pool.query(
        `SELECT pi.medicine_id, pi.price, pi.in_stock, pi.quantity, m.name, m.generic_name
         FROM pharmacy_inventory pi
         JOIN medicines m ON pi.medicine_id = m.id
         WHERE pi.pharmacy_id = $1`,
        [pharmacyRecord.id]
      );

      const enriched = orders.map((o) => {
        const orderMeds = o.medicines.toLowerCase();
        const matched = inventoryItems.rows.find((inv) =>
          orderMeds.includes(inv.name.toLowerCase()) ||
          (inv.generic_name && orderMeds.includes(inv.generic_name.toLowerCase()))
        );

        const isSearchInquiry = Boolean(
          o.notes && (o.notes.includes("Search Inquiry") || o.notes.includes("Searched for"))
        );

        return {
          ...o,
          isSearchInquiry,
          inStock: matched ? matched.in_stock : false,
          matchedMedicinePrice: matched ? matched.price : null,
          matchedMedicineName: matched ? matched.name : null,
        };
      });

      res.json(enriched);
      return;
    }

    res.json(orders);
  } catch (error: any) {
    console.error("Failed to fetch medicine orders:", error);
    res.status(500).json({ error: error.message || "Failed to fetch medicine orders" });
  }
});

// ─── POST /medicine-orders/search-inquiry ──────────────────────────────────
// Automatically logs patient live medicine search inquiries to nearby pharmacies
router.post("/medicine-orders/search-inquiry", async (req: any, res): Promise<void> => {
  await ensureMedicineOrdersTable();
  try {
    const { medicineName, lat, lng, address, pharmacyId } = req.body;

    if (!medicineName || !String(medicineName).trim()) {
      res.status(400).json({ error: "medicineName is required" });
      return;
    }

    const trimmedMed = String(medicineName).trim();

    // Deduplicate rapid re-searches within last 2 minutes for the same medicine
    const recentCheck = await pool.query(
      `SELECT id FROM medicine_orders
       WHERE LOWER(medicines) = LOWER($1)
         AND status = 'requested'
         AND notes LIKE 'Search Inquiry:%'
         AND created_at >= NOW() - INTERVAL '2 minutes'
       LIMIT 1`,
      [trimmedMed]
    );

    if (recentCheck.rows.length > 0) {
      res.json({ success: true, message: "Search inquiry already active", id: recentCheck.rows[0].id });
      return;
    }

    // Determine patient details (if auth header present or fallback guest)
    let patientId = 1;
    let patientName = "Patient";
    let patientPhone = "+91 98300 11223";

    if (req.headers.authorization) {
      try {
        const { getAuth } = await import("@clerk/express");
        const auth = getAuth(req);
        if (auth?.userId) {
          const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
          if (user) {
            patientId = user.id;
            patientName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "Patient";
            patientPhone = user.phone || "";
          }
        }
      } catch {
        // Fallback to default patient ID
      }
    }

    const patientLat = typeof lat === "number" ? lat : parseFloat(String(lat)) || 22.6057;
    const patientLng = typeof lng === "number" ? lng : parseFloat(String(lng)) || 88.4030;
    const patientAddress = address || "Lake Town / South Dum Dum, Kolkata";

    let targetPharmacyId: number | null = null;
    let pharmacyName: string | null = null;
    let pharmacyAddress: string | null = null;
    let pharmacyLat: number | null = null;
    let pharmacyLng: number | null = null;
    let distanceKm: number | null = null;

    if (pharmacyId) {
      targetPharmacyId = parseInt(String(pharmacyId), 10);
      const ph = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.id, targetPharmacyId) });
      if (ph) {
        pharmacyName = ph.name;
        pharmacyAddress = ph.address;
        pharmacyLat = ph.latitude;
        pharmacyLng = ph.longitude;
        if (pharmacyLat && pharmacyLng) {
          distanceKm = calculateDistanceKm(patientLat, patientLng, pharmacyLat, pharmacyLng);
        }
      }
    }

    const [order] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId,
        pharmacyId: targetPharmacyId,
        prescriptionId: null,
        medicines: trimmedMed,
        patientName,
        patientPhone,
        patientAddress,
        patientLat,
        patientLng,
        pharmacyName,
        pharmacyAddress,
        pharmacyLat,
        pharmacyLng,
        status: "requested",
        deliveryDistanceKm: distanceKm ?? 2.5,
        estimatedDeliveryMins: 18,
        totalPrice: null,
        notes: `Search Inquiry: Patient searched for "${trimmedMed}" nearby`,
      })
      .returning();

    res.status(201).json({ success: true, inquiry: order });
  } catch (error: any) {
    console.error("Failed to log search inquiry:", error);
    res.status(500).json({ error: error.message || "Failed to log search inquiry" });
  }
});

// ─── POST /medicine-orders ─────────────────────────────────────────────────
// Create a new patient medicine request
router.post("/medicine-orders", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await ensureMedicineOrdersTable();
  try {
    const {
      medicines,
      pharmacyId,
      prescriptionId,
      notes,
      address,
      latitude,
      longitude,
    } = req.body;

    if (!medicines || !medicines.trim()) {
      res.status(400).json({ error: "Medicines list is required" });
      return;
    }

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const patientName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || "Patient";
    const patientPhone = user.phone || "";
    const patientAddress = address || user.address || "Kolkata, West Bengal";
    const patientLat = latitude ?? user.latitude ?? 22.5726;
    const patientLng = longitude ?? user.longitude ?? 88.3639;

    let pharmacyName: string | null = null;
    let pharmacyAddress: string | null = null;
    let pharmacyLat: number | null = null;
    let pharmacyLng: number | null = null;
    let distanceKm: number | null = null;

    if (pharmacyId) {
      const pharmacy = await db.query.pharmaciesTable.findFirst({
        where: eq(pharmaciesTable.id, parseInt(String(pharmacyId), 10)),
      });
      if (pharmacy) {
        pharmacyName = pharmacy.name;
        pharmacyAddress = pharmacy.address;
        pharmacyLat = pharmacy.latitude;
        pharmacyLng = pharmacy.longitude;
        if (pharmacyLat && pharmacyLng && patientLat && patientLng) {
          distanceKm = calculateDistanceKm(patientLat, patientLng, pharmacyLat, pharmacyLng);
        }
      }
    }

    const [order] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: req.userId!,
        pharmacyId: pharmacyId ? parseInt(String(pharmacyId), 10) : null,
        prescriptionId: prescriptionId ? parseInt(String(prescriptionId), 10) : null,
        medicines: medicines.trim(),
        patientName,
        patientPhone,
        patientAddress,
        patientLat,
        patientLng,
        pharmacyName,
        pharmacyAddress,
        pharmacyLat,
        pharmacyLng,
        status: "requested",
        deliveryDistanceKm: distanceKm ?? 2.5,
        estimatedDeliveryMins: 20,
        totalPrice: null,
        notes: notes || null,
      })
      .returning();

    res.status(201).json(order);
  } catch (error: any) {
    console.error("Failed to create medicine order:", error);
    res.status(500).json({ error: error.message || "Failed to create medicine order" });
  }
});

// ─── POST /medicine-orders/from-prescription/:prescriptionId ───────────────
// 1-Click order creation directly from a doctor's prescription
router.post(
  "/medicine-orders/from-prescription/:prescriptionId",
  requireAuth,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await ensureMedicineOrdersTable();
    try {
      const prescriptionId = parseParamId(req.params.prescriptionId);
      if (isNaN(prescriptionId)) {
        res.status(400).json({ error: "Invalid prescriptionId" });
        return;
      }

      const prescription = await db.query.prescriptionsTable.findFirst({
        where: eq(prescriptionsTable.id, prescriptionId),
      });

      if (!prescription) {
        res.status(404).json({ error: "Prescription not found" });
        return;
      }

      const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });
      const patientName = user
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
        : "Patient";

      const patientLat = user?.latitude ?? 22.5726;
      const patientLng = user?.longitude ?? 88.3639;

      let pharmacyName: string | null = null;
      let pharmacyAddress: string | null = null;
      let pharmacyLat: number | null = null;
      let pharmacyLng: number | null = null;
      let distanceKm: number | null = null;

      if (prescription.pharmacyId) {
        const pharmacy = await db.query.pharmaciesTable.findFirst({
          where: eq(pharmaciesTable.id, prescription.pharmacyId),
        });
        if (pharmacy) {
          pharmacyName = pharmacy.name;
          pharmacyAddress = pharmacy.address;
          pharmacyLat = pharmacy.latitude;
          pharmacyLng = pharmacy.longitude;
          if (pharmacyLat && pharmacyLng) {
            distanceKm = calculateDistanceKm(patientLat, patientLng, pharmacyLat, pharmacyLng);
          }
        }
      }

      const [order] = await db
        .insert(medicineOrdersTable)
        .values({
          patientId: req.userId!,
          prescriptionId: prescription.id,
          pharmacyId: prescription.pharmacyId ?? null,
          medicines: prescription.medicines,
          patientName,
          patientPhone: user?.phone ?? "",
          patientAddress: user?.address ?? "Kolkata, West Bengal",
          patientLat,
          patientLng,
          pharmacyName,
          pharmacyAddress,
          pharmacyLat,
          pharmacyLng,
          status: "requested",
          deliveryDistanceKm: distanceKm ?? 2.5,
          estimatedDeliveryMins: 20,
          totalPrice: null,
          notes: prescription.instructions ? `Rx Notes: ${prescription.instructions}` : null,
        })
        .returning();

      res.status(201).json(order);
    } catch (error: any) {
      console.error("Failed to create order from prescription:", error);
      res.status(500).json({ error: error.message || "Failed to create order from prescription" });
    }
  }
);

// ─── GET /medicine-orders/:id ──────────────────────────────────────────────
// Get single medicine order details
router.get("/medicine-orders/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await ensureMedicineOrdersTable();
  try {
    const id = parseParamId(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    const order = await db.query.medicineOrdersTable.findFirst({
      where: eq(medicineOrdersTable.id, id),
    });

    if (!order) {
      res.status(404).json({ error: "Medicine order not found" });
      return;
    }

    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch medicine order" });
  }
});

// ─── POST /medicine-orders/:id/accept ──────────────────────────────────────
// Pharmacy accepts the patient's medicine request and confirms stock availability
router.post(
  "/medicine-orders/:id/accept",
  requireAuth,
  requireRole(["pharmacy", "admin"]),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await ensureMedicineOrdersTable();
    try {
      const id = parseParamId(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid order ID" });
        return;
      }

      const order = await db.query.medicineOrdersTable.findFirst({
        where: eq(medicineOrdersTable.id, id),
      });

      if (!order) {
        res.status(404).json({ error: "Medicine order not found" });
        return;
      }

      const pharmacy = await db.query.pharmaciesTable.findFirst({
        where: eq(pharmaciesTable.userId, req.userId!),
      });

      const pharmacyName = pharmacy?.name || "Apex Healthcare Pharmacy";
      const pharmacyAddress = pharmacy?.address || "Salt Lake Sector V, Kolkata";
      const pharmacyLat = pharmacy?.latitude ?? 22.5800;
      const pharmacyLng = pharmacy?.longitude ?? 88.4200;

      const { totalPrice, estimatedDeliveryMins, notes } = req.body;

      const price = totalPrice ? parseFloat(String(totalPrice)) : (order.totalPrice || 320);
      const deliveryMins = estimatedDeliveryMins ? parseInt(String(estimatedDeliveryMins), 10) : 18;

      let distanceKm = order.deliveryDistanceKm;
      if (order.patientLat && order.patientLng && pharmacyLat && pharmacyLng) {
        distanceKm = calculateDistanceKm(order.patientLat, order.patientLng, pharmacyLat, pharmacyLng);
      }

      const [updated] = await db
        .update(medicineOrdersTable)
        .set({
          pharmacyId: pharmacy?.id ?? order.pharmacyId,
          pharmacyName,
          pharmacyAddress,
          pharmacyLat,
          pharmacyLng,
          status: "accepted", // Accepted by pharmacy -> triggers patient 1-click doorstep prompt!
          totalPrice: price,
          estimatedDeliveryMins: deliveryMins,
          deliveryDistanceKm: distanceKm ?? 2.8,
          notes: notes || order.notes,
        })
        .where(eq(medicineOrdersTable.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to accept medicine order:", error);
      res.status(500).json({ error: error.message || "Failed to accept medicine order" });
    }
  }
);

// ─── POST /medicine-orders/:id/confirm-delivery ────────────────────────────
// Patient clicks "Yes, Deliver to My Doorstep (1-Click)"
router.post(
  "/medicine-orders/:id/confirm-delivery",
  requireAuth,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await ensureMedicineOrdersTable();
    try {
      const id = parseParamId(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid order ID" });
        return;
      }

      const order = await db.query.medicineOrdersTable.findFirst({
        where: eq(medicineOrdersTable.id, id),
      });

      if (!order) {
        res.status(404).json({ error: "Medicine order not found" });
        return;
      }

      // Assign random delivery rider from fleet
      const rider = DELIVERY_PARTNERS[Math.floor(Math.random() * DELIVERY_PARTNERS.length)];
      const otp = generateOtp();
      const { paymentMethod, deliveryAddress } = req.body;

      const [updated] = await db
        .update(medicineOrdersTable)
        .set({
          status: "delivery_confirmed",
          deliveryPartnerName: rider.name,
          deliveryPartnerPhone: rider.phone,
          deliveryPartnerVehicle: rider.vehicle,
          deliveryOtp: otp,
          paymentMethod: paymentMethod || "cash_on_delivery",
          patientAddress: deliveryAddress || order.patientAddress,
        })
        .where(eq(medicineOrdersTable.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to confirm delivery:", error);
      res.status(500).json({ error: error.message || "Failed to confirm delivery" });
    }
  }
);

// ─── POST /medicine-orders/:id/update-status ───────────────────────────────
// Advances order status (packing, out_for_delivery, delivered, cancelled)
router.post(
  "/medicine-orders/:id/update-status",
  requireAuth,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await ensureMedicineOrdersTable();
    try {
      const id = parseParamId(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid order ID" });
        return;
      }

      const { status } = req.body;
      const validStatuses = [
        "requested",
        "accepted",
        "delivery_confirmed",
        "packing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ];

      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        return;
      }

      const [updated] = await db
        .update(medicineOrdersTable)
        .set({ status })
        .where(eq(medicineOrdersTable.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update status:", error);
      res.status(500).json({ error: error.message || "Failed to update status" });
    }
  }
);

// ─── GET /medicine-orders/:id/tracking ─────────────────────────────────────
// Generates live route graph coordinates, current rider position, ETA, and status
router.get("/medicine-orders/:id/tracking", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await ensureMedicineOrdersTable();
  try {
    const id = parseParamId(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    const order = await db.query.medicineOrdersTable.findFirst({
      where: eq(medicineOrdersTable.id, id),
    });

    if (!order) {
      res.status(404).json({ error: "Medicine order not found" });
      return;
    }

    // Default coordinates if not populated
    const pLat = order.pharmacyLat ?? 22.5820;
    const pLng = order.pharmacyLng ?? 88.4210;
    const uLat = order.patientLat ?? 22.5697;
    const uLng = order.patientLng ?? 88.3697;

    // Generate realistic road waypoints / polyline route graph
    const waypoints = [
      { lat: pLat, lng: pLng },
      { lat: pLat + (uLat - pLat) * 0.25 + 0.002, lng: pLng + (uLng - pLng) * 0.25 - 0.001 },
      { lat: pLat + (uLat - pLat) * 0.5 - 0.001, lng: pLng + (uLng - pLng) * 0.5 + 0.003 },
      { lat: pLat + (uLat - pLat) * 0.75 + 0.0015, lng: pLng + (uLng - pLng) * 0.75 + 0.001 },
      { lat: uLat, lng: uLng },
    ];

    // Status map to active step
    let activeStepIndex = 0;
    let riderProgressPct = 0;

    switch (order.status) {
      case "requested":
        activeStepIndex = 0;
        riderProgressPct = 0;
        break;
      case "accepted":
        activeStepIndex = 1;
        riderProgressPct = 5;
        break;
      case "delivery_confirmed":
        activeStepIndex = 1;
        riderProgressPct = 15;
        break;
      case "packing":
        activeStepIndex = 2;
        riderProgressPct = 30;
        break;
      case "out_for_delivery":
        activeStepIndex = 3;
        riderProgressPct = 70;
        break;
      case "delivered":
        activeStepIndex = 4;
        riderProgressPct = 100;
        break;
      default:
        activeStepIndex = 1;
        riderProgressPct = 10;
    }

    // Current rider coordinates along waypoints
    const progressFrac = Math.min(Math.max(riderProgressPct / 100, 0), 1);
    const riderLat = pLat + (uLat - pLat) * progressFrac;
    const riderLng = pLng + (uLng - pLng) * progressFrac;

    const remainingMins =
      order.status === "delivered"
        ? 0
        : Math.max(1, Math.round((order.estimatedDeliveryMins ?? 15) * (1 - progressFrac)));

    res.json({
      order,
      origin: {
        title: order.pharmacyName || "Onboarded Pharmacy",
        address: order.pharmacyAddress || "Pharmacy Dispatch Hub",
        lat: pLat,
        lng: pLng,
      },
      destination: {
        title: order.patientName || "Patient Doorstep",
        address: order.patientAddress || "Delivery Address",
        lat: uLat,
        lng: uLng,
      },
      rider: {
        lat: riderLat,
        lng: riderLng,
        name: order.deliveryPartnerName || "Express Delivery Partner",
        phone: order.deliveryPartnerPhone || "+91 98300 12345",
        vehicle: order.deliveryPartnerVehicle || "EV Express Scooter",
        otp: order.deliveryOtp || "4829",
      },
      waypoints,
      riderProgressPct,
      remainingMins,
      distanceKm: order.deliveryDistanceKm ?? 2.4,
      activeStepIndex,
      steps: [
        { title: "Order Placed & Requested", desc: "Waiting for nearby pharmacy confirmation", done: true },
        { title: "Pharmacy Accepted", desc: `${order.pharmacyName || "Pharmacy"} verified medicines in stock`, done: activeStepIndex >= 1 },
        { title: "Medicines Packed & Sealed", desc: "Tamper-proof quality checked packaging", done: activeStepIndex >= 2 },
        { title: "Out for Delivery", desc: "Rider on the way to your doorstep", done: activeStepIndex >= 3 },
        { title: "Delivered", desc: "Medicines received at doorstep", done: activeStepIndex >= 4 },
      ],
    });
  } catch (error: any) {
    console.error("Failed to generate tracking payload:", error);
    res.status(500).json({ error: error.message || "Failed to generate tracking payload" });
  }
});

export default router;

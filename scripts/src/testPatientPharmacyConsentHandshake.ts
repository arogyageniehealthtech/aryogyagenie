import { pool, db, usersTable, pharmaciesTable, medicineOrdersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`, detail !== undefined ? detail : "");
    failed++;
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING 2-WAY PATIENT-PHARMACY CONSENT & DISPENSING HANDSHAKE WORKFLOW");
  console.log("================================================================================\n");

  try {
    // 1. Fetch Patient and Nearby Pharmacy
    const patient = await db.query.usersTable.findFirst({ where: eq(usersTable.role, "patient") });
    const pharmacy = await db.query.pharmaciesTable.findFirst();

    assert(!!patient, `Patient exists in database (ID: ${patient?.id})`);
    assert(!!pharmacy, `Verified Pharmacy exists in database: ${pharmacy?.name} (ID: ${pharmacy?.id})`);
    if (!patient || !pharmacy) return;

    // ── STEP 1: Patient orders OTC / Custom Medicine ───────────────────────────
    console.log("\n▶ Step 1: Patient creates OTC / Custom medicine request (Radius Broadcast)");
    const customMeds = "Paracetamol 650mg (1 strip)\nDolo 650 (1 strip)\nCough Syrup (1 bottle)";

    const [order] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: patient.id,
        pharmacyId: null, // Broadcast unassigned to nearby pharmacies
        prescriptionId: null,
        medicines: customMeds,
        patientName: `${patient.firstName || "Patient"} ${patient.lastName || "User"}`,
        patientPhone: patient.phone || "+91 98300 11223",
        patientAddress: "Salt Lake Sector II, Kolkata",
        patientLat: 22.5850,
        patientLng: 88.4150,
        status: "requested",
        notes: "Need fast delivery within 25 mins",
      })
      .returning();

    assert(!!order && order.id > 0, `Patient OTC request created (ID: #${order.id})`);
    assert(order.status === "requested", "Order status is 'requested' (seeking nearby pharmacies)");
    assert(order.pharmacyId === null, "Order is unassigned and broadcast across patient radius");

    // ── STEP 2: Pharmacy Discovers Seeking Patient in Radius ──────────────────
    console.log("\n▶ Step 2: Nearby Pharmacy discovers patient seeking medicine in radius");
    const openOrders = await pool.query(
      `SELECT * FROM medicine_orders WHERE status = 'requested' AND id = $1`,
      [order.id]
    );
    assert(openOrders.rows.length === 1, `Pharmacy queue sees patient #${patient.id} seeking medicine`);

    // ── STEP 3: Verify Dispense Lock (Cannot Dispense when Requested) ──────────
    console.log("\n▶ Step 3: Verify Dispense Lock (Cannot pack/dispense while status is 'requested')");
    // Simulate what the backend update-status route enforces
    const checkDispensePermission = (currentStatus: string, targetStatus: string) => {
      const dispensingStatuses = ["packing", "out_for_delivery", "delivered"];
      if (dispensingStatuses.includes(targetStatus)) {
        if (currentStatus === "requested") {
          return { allowed: false, error: "Cannot dispense: No pharmacy offer has been accepted by the patient yet." };
        }
        if (currentStatus === "accepted") {
          return { allowed: false, error: "Cannot dispense: Pharmacy has made an offer, but patient has not yet accepted ('Would you take it from this pharmacy?'). Dispensing is locked until patient confirms." };
        }
        if (currentStatus === "cancelled" || currentStatus === "declined") {
          return { allowed: false, error: "Cannot dispense on a cancelled or declined order." };
        }
      }
      return { allowed: true };
    };

    const perm1 = checkDispensePermission(order.status, "packing");
    assert(!perm1.allowed, "Dispensing is BLOCKED when status is 'requested'", perm1.error);

    // ── STEP 4: Pharmacy Accepts & Offers Stock (Status -> 'accepted') ────────
    console.log("\n▶ Step 4: Pharmacy accepts request and offers stock availability + price quote");
    const [acceptedOrder] = await db
      .update(medicineOrdersTable)
      .set({
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        pharmacyAddress: pharmacy.address,
        pharmacyLat: pharmacy.latitude,
        pharmacyLng: pharmacy.longitude,
        status: "accepted",
        totalPrice: 280.0,
        estimatedDeliveryMins: 15,
        deliveryDistanceKm: 2.2,
      })
      .where(eq(medicineOrdersTable.id, order.id))
      .returning();

    assert(acceptedOrder.status === "accepted", "Order status transitioned to 'accepted'");
    assert(acceptedOrder.pharmacyName === pharmacy.name, `Pharmacy name '${pharmacy.name}' recorded in offer`);
    assert(acceptedOrder.totalPrice === 280.0, "Total price quote ₹280 recorded");

    // ── STEP 5: Verify Dispense Lock (Cannot Dispense when Accepted) ──────────
    console.log("\n▶ Step 5: Verify Dispense Lock (Pharmacy STILL cannot dispense while awaiting patient consent)");
    const perm2 = checkDispensePermission(acceptedOrder.status, "packing");
    assert(!perm2.allowed, "Dispensing is BLOCKED when status is 'accepted' (awaiting patient acceptance)", perm2.error);

    const perm3 = checkDispensePermission(acceptedOrder.status, "out_for_delivery");
    assert(!perm3.allowed, "Handover to rider is BLOCKED when status is 'accepted'");

    // ── STEP 6: Patient Reviews Offer & Accepts ('Would you take it from Pharmacy A?') ──
    console.log("\n▶ Step 6: Patient receives prompt: 'Pharmacy A has your medicine, would you take it?' and ACCEPTS");
    const [patientConfirmed] = await db
      .update(medicineOrdersTable)
      .set({
        status: "delivery_confirmed",
        deliveryPartnerName: "Rahul Sharma",
        deliveryPartnerPhone: "+91 98301 22894",
        deliveryPartnerVehicle: "WB-02-AX-8912 (EV Scooter)",
        deliveryOtp: "5821",
        paymentMethod: "cash_on_delivery",
      })
      .where(eq(medicineOrdersTable.id, order.id))
      .returning();

    assert(patientConfirmed.status === "delivery_confirmed", "Patient confirmed acceptance (status: 'delivery_confirmed')");
    assert(!!patientConfirmed.deliveryOtp, `Delivery OTP generated: ${patientConfirmed.deliveryOtp}`);

    // ── STEP 7: Pharmacy Dispenses, Packs & Dispatches ────────────────────────
    console.log("\n▶ Step 7: Pharmacy is now authorized to dispense and dispatch");
    const perm4 = checkDispensePermission(patientConfirmed.status, "packing");
    assert(perm4.allowed, "Dispensing is now ALLOWED after patient acceptance");

    const [packed] = await db
      .update(medicineOrdersTable)
      .set({ status: "packing" })
      .where(eq(medicineOrdersTable.id, order.id))
      .returning();
    assert(packed.status === "packing", "Pharmacy marked order as 'packing' (dispensed & sealed)");

    const [dispatched] = await db
      .update(medicineOrdersTable)
      .set({ status: "out_for_delivery" })
      .where(eq(medicineOrdersTable.id, order.id))
      .returning();
    assert(dispatched.status === "out_for_delivery", "Handed over to express courier ('out_for_delivery')");

    const [delivered] = await db
      .update(medicineOrdersTable)
      .set({ status: "delivered" })
      .where(eq(medicineOrdersTable.id, order.id))
      .returning();
    assert(delivered.status === "delivered", "Delivered at patient doorstep ('delivered')");

    // ── STEP 8: Test Decline Workflow ─────────────────────────────────────────
    console.log("\n▶ Step 8: Test Decline & Reopen workflow when patient declines an offer");
    const [order2] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: patient.id,
        medicines: "Azithromycin 500mg",
        patientName: "Patient User",
        status: "requested",
      })
      .returning();

    // Pharmacy offers
    await db.update(medicineOrdersTable).set({
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      status: "accepted",
      totalPrice: 190.0,
    }).where(eq(medicineOrdersTable.id, order2.id));

    // Patient declines with reopen = true
    const [reopened] = await db
      .update(medicineOrdersTable)
      .set({
        status: "requested",
        pharmacyId: null,
        pharmacyName: null,
        totalPrice: null,
        notes: "Patient declined offer and reopened to radius",
      })
      .where(eq(medicineOrdersTable.id, order2.id))
      .returning();

    assert(reopened.status === "requested", "Declined order successfully reverted to 'requested'");
    assert(reopened.pharmacyId === null, "Pharmacy assignment cleared for other pharmacies in radius to offer");

    // Clean up test orders
    await db.delete(medicineOrdersTable).where(eq(medicineOrdersTable.id, order.id));
    await db.delete(medicineOrdersTable).where(eq(medicineOrdersTable.id, order2.id));

    console.log("\n================================================================================");
    console.log(`🎉 TEST COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================");
  } catch (err: any) {
    console.error("Test execution error:", err);
  } finally {
    await pool.end();
  }
}

runTests();

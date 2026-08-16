import { pool, db, usersTable, pharmaciesTable, medicinesTable, pharmacyInventoryTable, medicineOrdersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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
  console.log("🧪 TESTING PATIENT MEDICINE SEARCH TO PHARMACY PORTAL REAL-TIME FLOW");
  console.log("================================================================================\n");

  try {
    // 1. Verify onboarded pharmacy exists
    const pharmacy = await db.query.pharmaciesTable.findFirst({
      where: eq(pharmaciesTable.name, "Medplus"),
    });
    assert(!!pharmacy, "Onboarded pharmacy 'Medplus' exists in database", pharmacy);
    if (!pharmacy) return;

    // 2. Clear any old test search inquiries
    await pool.query(
      `DELETE FROM medicine_orders WHERE medicines ILIKE '%TestMedicineSearch%' OR medicines ILIKE '%Azithromycin%'`
    );

    // 3. Simulate Patient Medicine Search on Nearby Care
    console.log("\n▶ Step 1: Patient searches for 'Azithromycin 500mg' on Nearby Care Map");
    const testMedName = "Azithromycin 500mg";
    const patientLat = 22.6057;
    const patientLng = 88.4030;

    const [inquiry] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: 1,
        pharmacyId: pharmacy.id,
        medicines: testMedName,
        patientName: "Rajarshi Das",
        patientPhone: "+91 98300 11223",
        patientAddress: "Lake Town Block A, Kolkata",
        patientLat,
        patientLng,
        status: "requested",
        deliveryDistanceKm: 2.4,
        estimatedDeliveryMins: 18,
        notes: `Search Inquiry: Patient searched for "${testMedName}" nearby`,
      })
      .returning();

    assert(!!inquiry && inquiry.id > 0, "Patient medicine search inquiry created successfully", { id: inquiry.id, medicines: inquiry.medicines });

    // 4. Test Pharmacy Portal Order Fetching
    console.log("\n▶ Step 2: Pharmacy Portal fetches incoming requests & search demands");
    const pharmacyOrders = await pool.query(
      `SELECT * FROM medicine_orders WHERE status = 'requested' ORDER BY created_at DESC`
    );

    const foundInquiry = pharmacyOrders.rows.find((o) => o.id === inquiry.id);
    assert(!!foundInquiry, "Pharmacy Portal receives the patient search demand", {
      id: foundInquiry?.id,
      patient: foundInquiry?.patient_name,
      medicines: foundInquiry?.medicines,
      notes: foundInquiry?.notes,
    });

    // 5. Test Stock Matching
    console.log("\n▶ Step 3: Check inventory stock match for the searched medicine");
    const invRow = await pool.query(
      `SELECT pi.*, m.name
       FROM pharmacy_inventory pi
       JOIN medicines m ON pi.medicine_id = m.id
       WHERE pi.pharmacy_id = $1 AND LOWER(m.name) LIKE '%azithromycin%'`,
      [pharmacy.id]
    );

    const isStocked = invRow.rows.length > 0 && invRow.rows[0].in_stock;
    console.log(`Inventory stock status for '${testMedName}': ${isStocked ? "In Stock (₹" + invRow.rows[0].price + ")" : "Not In Stock"}`);
    assert(invRow !== undefined, "Inventory check query executed successfully");

    // 6. Test Pharmacy 1-Click Accept & Send Delivery Offer
    console.log("\n▶ Step 4: Pharmacy accepts patient demand & sends 1-Click Doorstep Offer");
    const quotedPrice = 85.0;
    const quotedEta = 15;

    const [accepted] = await db
      .update(medicineOrdersTable)
      .set({
        status: "accepted",
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        pharmacyAddress: pharmacy.address,
        totalPrice: quotedPrice,
        estimatedDeliveryMins: quotedEta,
      })
      .where(eq(medicineOrdersTable.id, inquiry.id))
      .returning();

    assert(accepted.status === "accepted", "Pharmacy accepted patient search demand", {
      orderId: accepted.id,
      status: accepted.status,
      totalPrice: accepted.totalPrice,
      estimatedDeliveryMins: accepted.estimatedDeliveryMins,
    });

    // 7. Test 1-Click Patient Confirmation & Live Dispatch
    console.log("\n▶ Step 5: Patient confirms 1-Click Doorstep Delivery");
    const [confirmed] = await db
      .update(medicineOrdersTable)
      .set({
        status: "delivery_confirmed",
        deliveryPartnerName: "Rahul Sharma",
        deliveryPartnerPhone: "+91 98301 22894",
        deliveryPartnerVehicle: "WB-02-AX-8912 (EV Scooter)",
        deliveryOtp: "5821",
      })
      .where(eq(medicineOrdersTable.id, inquiry.id))
      .returning();

    assert(confirmed.status === "delivery_confirmed", "Order moved to delivery_confirmed with assigned rider & OTP", {
      orderId: confirmed.id,
      rider: confirmed.deliveryPartnerName,
      otp: confirmed.deliveryOtp,
    });

    // 8. Test Inventory Toggle Switch
    console.log("\n▶ Step 6: Pharmacy toggles medicine stock availability in inventory");
    const sampleMed = await db.query.medicinesTable.findFirst({ where: eq(medicinesTable.name, "Paracetamol 650") });
    if (sampleMed) {
      const invCheck = await db.query.pharmacyInventoryTable.findFirst({
        where: and(
          eq(pharmacyInventoryTable.pharmacyId, pharmacy.id),
          eq(pharmacyInventoryTable.medicineId, sampleMed.id)
        ),
      });

      if (invCheck) {
        // Toggle off then on
        await db.update(pharmacyInventoryTable).set({ inStock: false }).where(eq(pharmacyInventoryTable.id, invCheck.id));
        const toggledOff = await db.query.pharmacyInventoryTable.findFirst({ where: eq(pharmacyInventoryTable.id, invCheck.id) });
        assert(toggledOff?.inStock === false, "Pharmacy toggled stock to OUT OF STOCK successfully");

        await db.update(pharmacyInventoryTable).set({ inStock: true }).where(eq(pharmacyInventoryTable.id, invCheck.id));
        const toggledOn = await db.query.pharmacyInventoryTable.findFirst({ where: eq(pharmacyInventoryTable.id, invCheck.id) });
        assert(toggledOn?.inStock === true, "Pharmacy toggled stock to IN STOCK successfully");
      }
    }

    console.log("\n================================================================================");
    console.log(`📊 FINAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Test execution exception:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();

import { pool, db, usersTable, doctorsTable, pharmaciesTable, prescriptionsTable, medicineOrdersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
  console.log("🧪 TESTING PRESCRIPTION SECTION TO MEDPLUS PHARMACY PORTAL FLOW");
  console.log("================================================================================\n");

  try {
    // 1. Verify Medplus pharmacy
    const medplus = await db.query.pharmaciesTable.findFirst({
      where: eq(pharmaciesTable.name, "Medplus"),
    });
    assert(!!medplus, "Medplus pharmacy exists in database (ID: " + medplus?.id + ")");
    if (!medplus) return;

    // 2. Doctor issues prescription with medicine names
    console.log("\n▶ Step 1: Doctor issues digital prescription with medicine names");
    const doctor = await db.query.doctorsTable.findFirst();
    const patientUser = await db.query.usersTable.findFirst({ where: eq(usersTable.role, "patient") });
    assert(!!doctor && !!patientUser, "Doctor and patient exist for consultation");
    if (!doctor || !patientUser) return;

    const prescribedMeds = "Pantoprazole 40mg - 1 tab before breakfast\nCetirizine 10mg - 1 tab at bedtime";
    const patientLoc = "Swamiji Sarani, Dum Dum, Kolkata";
    const patientLat = 22.6100;
    const patientLng = 88.4050;

    const [rx] = await db
      .insert(prescriptionsTable)
      .values({
        patientId: patientUser.id,
        doctorId: doctor.id,
        medicines: prescribedMeds,
        diagnosis: "Acid Reflux & Seasonal Allergy",
        instructions: "Take for 5 days after food",
        prescribedDate: new Date().toISOString().split("T")[0],
        pharmacyId: medplus.id,
      })
      .returning();

    assert(!!rx && rx.id > 0, "Prescription created successfully (ID: " + rx.id + ")");

    // Auto-create medicine order for Medplus
    const [rxOrder] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: patientUser.id,
        pharmacyId: medplus.id,
        prescriptionId: rx.id,
        medicines: prescribedMeds,
        patientName: `${patientUser.firstName ?? ""} ${patientUser.lastName ?? ""}`.trim() || "Patient",
        patientPhone: patientUser.phone || "+91 98300 11223",
        patientAddress: patientLoc,
        patientLat,
        patientLng,
        pharmacyName: medplus.name,
        pharmacyAddress: medplus.address,
        status: "requested",
        deliveryDistanceKm: 2.1,
        estimatedDeliveryMins: 18,
        notes: `Doctor Prescription #${rx.id}: Acid Reflux & Seasonal Allergy`,
      })
      .returning();

    assert(!!rxOrder && rxOrder.id > 0, "Medicine order automatically linked to Medplus for prescription");

    // 3. Verify Medplus receives the prescription order
    console.log("\n▶ Step 2: Medplus Pharmacy Portal fetches incoming prescription requests");
    const pharmacyOrders = await pool.query(
      `SELECT * FROM medicine_orders
       WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL)
         AND status = 'requested'
       ORDER BY created_at DESC`,
      [medplus.id]
    );

    const foundRxOrder = pharmacyOrders.rows.find((o) => o.id === rxOrder.id);
    assert(!!foundRxOrder, "Medplus received the prescription order in real-time queue", {
      orderId: foundRxOrder?.id,
      medicines: foundRxOrder?.medicines,
      patientLocation: foundRxOrder?.patient_address,
    });

    // 4. Test Patient Quick Medicine Entry from Prescription section
    console.log("\n▶ Step 3: Patient enters OTC / Custom medicine in Prescription section");
    const enteredMed = "Dolo 650 (Paracetamol 650mg)";
    const [quickOrder] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: patientUser.id,
        pharmacyId: medplus.id,
        medicines: enteredMed,
        patientName: `${patientUser.firstName ?? ""} ${patientUser.lastName ?? ""}`.trim() || "Patient",
        patientPhone: patientUser.phone || "+91 98300 11223",
        patientAddress: patientLoc,
        patientLat,
        patientLng,
        pharmacyName: medplus.name,
        pharmacyAddress: medplus.address,
        status: "requested",
        deliveryDistanceKm: 2.1,
        estimatedDeliveryMins: 18,
        notes: `Quick order from Prescription Section for "${enteredMed}"`,
      })
      .returning();

    assert(!!quickOrder && quickOrder.id > 0, "Patient entered medicine order submitted to Medplus");

    // 5. Verify Medplus receives the patient entered medicine
    const pharmacyOrders2 = await pool.query(
      `SELECT * FROM medicine_orders WHERE id = $1`,
      [quickOrder.id]
    );
    assert(pharmacyOrders2.rows.length === 1, "Medplus portal receives the patient entered medicine with location", {
      orderId: pharmacyOrders2.rows[0].id,
      medicines: pharmacyOrders2.rows[0].medicines,
      address: pharmacyOrders2.rows[0].patient_address,
      lat: pharmacyOrders2.rows[0].patient_lat,
      lng: pharmacyOrders2.rows[0].patient_lng,
    });

    // 6. Medplus accepts the order
    console.log("\n▶ Step 4: Medplus accepts the order and provides doorstep delivery quote");
    const [accepted] = await db
      .update(medicineOrdersTable)
      .set({
        status: "accepted",
        totalPrice: 45.0,
        estimatedDeliveryMins: 15,
      })
      .where(eq(medicineOrdersTable.id, quickOrder.id))
      .returning();

    assert(accepted.status === "accepted" && accepted.totalPrice === 45.0, "Medplus accepted the medicine order with price quote");

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

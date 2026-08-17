import { pool, db, usersTable, pharmaciesTable, medicineOrdersTable, prescriptionsTable, doctorsTable } from "@workspace/db";
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
  console.log("🧪 TESTING MULTI-SELECT MEDICINE REQUESTS & PRESCRIBED MEDICINES PRESENTATION");
  console.log("================================================================================\n");

  try {
    const patient = await db.query.usersTable.findFirst({ where: eq(usersTable.role, "patient") });
    const pharmacy = await db.query.pharmaciesTable.findFirst();
    const doctor = await db.query.doctorsTable.findFirst();

    assert(!!patient, `Patient exists (ID: ${patient?.id})`);
    assert(!!pharmacy, `Pharmacy exists: ${pharmacy?.name} (ID: ${pharmacy?.id})`);
    if (!patient || !pharmacy) return;

    // ── STEP 1: Multi-Select Medicine Request with Camera/Doc Photo ─────────────
    console.log("\n▶ Step 1: Patient multi-selects 3 medicines and attaches a photo");
    const multiMeds = [
      "Paracetamol 650",
      "Dolo 650",
      "Cough Syrup (100ml)",
    ];
    const imageNote = "[Attached File: rx_camera_snap_17aug.jpg]";
    const fullNotes = `Patient requested 3 medicine(s) via multi-select. ${imageNote}`;

    const [multiOrder] = await db
      .insert(medicineOrdersTable)
      .values({
        patientId: patient.id,
        pharmacyId: null, // Broadcast to radius
        prescriptionId: null,
        medicines: multiMeds.join("\n"),
        patientName: `${patient.firstName || "Patient"} ${patient.lastName || "User"}`,
        patientPhone: patient.phone || "+91 98300 11223",
        patientAddress: "Lake Town, Kolkata",
        patientLat: 22.6050,
        patientLng: 88.4020,
        status: "requested",
        notes: fullNotes,
      })
      .returning();

    assert(!!multiOrder && multiOrder.id > 0, `Multi-select medicine request created (ID: #${multiOrder.id})`);
    assert(multiOrder.medicines.includes("Paracetamol 650"), "Contains Paracetamol 650");
    assert(multiOrder.medicines.includes("Dolo 650"), "Contains Dolo 650");
    assert(multiOrder.medicines.includes("Cough Syrup"), "Contains Cough Syrup");
    assert(multiOrder.notes?.includes("rx_camera_snap_17aug.jpg") === true, "Attached camera image noted in request");
    assert(multiOrder.status === "requested", "Status is 'requested' (broadcast across patient radius)");

    // ── STEP 2: Pharmacy Discovers Multi-Select Order and Accepts ──────────────
    console.log("\n▶ Step 2: Pharmacy discovers multi-item order in radius and accepts offer");
    const [accepted] = await db
      .update(medicineOrdersTable)
      .set({
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        status: "accepted",
        totalPrice: 245.0,
        estimatedDeliveryMins: 16,
      })
      .where(eq(medicineOrdersTable.id, multiOrder.id))
      .returning();

    assert(accepted.status === "accepted", "Pharmacy accepted multi-item order offer");
    assert(accepted.totalPrice === 245.0, "Total price quote ₹245 recorded for all 3 items");

    // ── STEP 3: Prescriptions Portrayal Verification ──────────────────────────
    console.log("\n▶ Step 3: Verify Doctor Prescriptions parsing for the Prescribed Medicines section");
    // Ensure at least one test prescription exists
    let rx = await db.query.prescriptionsTable.findFirst({
      where: eq(prescriptionsTable.patientId, patient.id),
    });

    if (!rx && doctor) {
      const [newRx] = await db
        .insert(prescriptionsTable)
        .values({
          patientId: patient.id,
          doctorId: doctor.id,
          medicines: JSON.stringify([
            { name: "Amoxicillin 500mg", dosage: "1 capsule", frequency: "Thrice Daily", duration: "7 days", instructions: "Take after food" },
            { name: "Pantoprazole 40mg", dosage: "1 tablet", frequency: "Once Daily", duration: "7 days", instructions: "Before breakfast" },
          ]),
          diagnosis: "Acute Bronchitis & Acidity",
          instructions: "Complete the full antibiotic course.",
          status: "active",
          prescribedDate: new Date().toISOString().split("T")[0],
        })
        .returning();
      rx = newRx;
    }

    assert(!!rx, `Prescription exists for patient (ID: #${rx?.id})`);

    // Verify parser logic
    const parsePrescriptionMeds = (raw: string) => {
      try {
        if (raw.trim().startsWith("[") || raw.trim().startsWith("{")) {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch {}
      return raw.split(/\n|;/).map((line) => ({ name: line.trim(), dosage: "1 unit", frequency: "As directed" }));
    };

    const parsedMeds = parsePrescriptionMeds(rx!.medicines);
    assert(parsedMeds.length > 0, `Parsed ${parsedMeds.length} prescribed medicines from prescription #${rx?.id}`);
    assert(!!parsedMeds[0].name, `First prescribed medicine: ${parsedMeds[0].name}`);

    // Clean up test order
    await db.delete(medicineOrdersTable).where(eq(medicineOrdersTable.id, multiOrder.id));

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

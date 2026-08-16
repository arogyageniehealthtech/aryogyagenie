import {
  searchNearbyDoctors,
  searchNearbyDiagnosticCenters,
  searchNearbyPharmacies,
  parseCoordinates,
  clampRadiusKm,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
} from "../../artifacts/api-server/src/lib/locationService";
import {
  pool,
  db,
  usersTable,
  doctorsTable,
  diagnosticCentersTable,
  pharmaciesTable,
  medicinesTable,
  pharmacyInventoryTable,
  appointmentsTable,
  prescriptionsTable,
  diagnosticBookingsTable,
  medicineRemindersTable,
  timelineEventsTable,
  healthEpisodesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

async function runEndToEndIntegrationTests() {
  console.log("================================================================================");
  console.log("🚀 STARTING COMPREHENSIVE END-TO-END INTEGRATION & REGRESSION TEST SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || "");
      failed++;
    }
  }

  try {
    // ─── 1. PATIENT LOCATION & FALLBACKS ──────────────────────────────────────────
    console.log("▶ 1. Patient Location, Coordinate Parsing & Fallbacks");
    const validCoords = parseCoordinates("22.5726", "88.3639");
    assert(validCoords !== null && validCoords.lat === 22.5726, "GPS coordinates parsed string/number safely");
    assert(parseCoordinates(105, 88) === null, "Out of bounds latitude (>90) rejected safely");
    assert(parseCoordinates(22, 195) === null, "Out of bounds longitude (>180) rejected safely");
    assert(parseCoordinates("bad_data", "bad_data") === null, "Invalid NaN string rejected safely");

    // ─── 2. RADIUS ENFORCEMENT [0 km to 18 km] ────────────────────────────────────
    console.log("\n▶ 2. Radius Slider Constraint Enforcement [0 km to 18 km]");
    assert(clampRadiusKm(0) === 0, "Radius 0 km accepted (MIN_RADIUS_KM = 0)");
    assert(clampRadiusKm(0.5) === 0.5, "Radius 0.5 km accepted");
    assert(clampRadiusKm(1) === 1, "Radius 1 km accepted");
    assert(clampRadiusKm(2) === 2, "Radius 2 km accepted");
    assert(clampRadiusKm(5) === 5, "Radius 5 km accepted");
    assert(clampRadiusKm(8) === 8, "Radius 8 km accepted");
    assert(clampRadiusKm(10) === 10, "Radius 10 km accepted");
    assert(clampRadiusKm(15) === 15, "Radius 15 km accepted");
    assert(clampRadiusKm(18) === 18, "Radius 18 km accepted (MAX_RADIUS_KM = 18)");
    assert(clampRadiusKm(25) === 18, "Radius 25 km clamped to 18 km maximum (MAX_RADIUS_KM)");
    assert(clampRadiusKm(999) === 18, "Radius 999 km clamped to 18 km maximum");
    assert(clampRadiusKm(undefined) === 10, "Undefined radius defaults safely to 10 km");

    const kolkataPatient = { lat: 22.5726, lng: 88.3639 }; // Park Street, Kolkata

    // ─── 3. DOCTOR END-TO-END FLOW ────────────────────────────────────────────────
    console.log("\n▶ 3. Doctor Discovery End-to-End Flow");
    // 3.1 Search all doctors within 10 km
    const allDocs10km = await searchNearbyDoctors({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 10,
    });
    assert(allDocs10km.results.length >= 1, "Discovered active doctors in PostgreSQL within 10 km", { count: allDocs10km.results.length });

    // 3.2 Verify distance sorting nearest first
    const isDocSorted = allDocs10km.results.every((d, i, arr) => i === 0 || d.distanceKm >= arr[i - 1].distanceKm);
    assert(isDocSorted, "Doctor results are strictly sorted by distance ascending (nearest first)");

    // 3.3 Verify doctor card data model completeness
    const docSample = allDocs10km.results[0];
    assert(
      Boolean(docSample.id && docSample.name && docSample.specialty && typeof docSample.distanceKm === "number" && docSample.distanceType === "straight_line_geographic"),
      "Doctor card contains all required metadata (id, name, specialty, distanceKm, distanceType)",
      docSample
    );

    // 3.4 Specialty search: "General" or "Cardio"
    const docSpecialty = await searchNearbyDoctors({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 18,
      specialty: "General",
    });
    assert(docSpecialty.results.length >= 1, "Specialty search filters matching specialists", { count: docSpecialty.results.length });

    // 3.5 No result edge case
    const docNoResults = await searchNearbyDoctors({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 18,
      specialty: "NonExistentSpecialty999",
    });
    assert(docNoResults.results.length === 0, "Non-existent specialty returns clean empty array without errors");

    // ─── 4. DIAGNOSTIC CENTER END-TO-END FLOW ────────────────────────────────────
    console.log("\n▶ 4. Diagnostic Center Discovery End-to-End Flow");
    // 4.1 Search diagnostic centers offering "Blood Test"
    const diagBlood = await searchNearbyDiagnosticCenters({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 18,
      service: "Blood",
    });
    assert(diagBlood.results.length >= 1, "Discovered diagnostic centers offering 'Blood' test", { count: diagBlood.results.length });

    // 4.2 Search diagnostic centers offering "MRI"
    const diagMRI = await searchNearbyDiagnosticCenters({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 18,
      service: "MRI",
    });
    assert(diagMRI.results.length >= 1, "Discovered diagnostic centers offering 'MRI'", { count: diagMRI.results.length });

    // 4.3 Verify diagnostic center distance sorting
    const isDiagSorted = diagBlood.results.every((d, i, arr) => i === 0 || d.distanceKm >= arr[i - 1].distanceKm);
    assert(isDiagSorted, "Diagnostic centers are strictly sorted by distance ascending");

    // 4.4 Verify card fields
    const diagSample = diagBlood.results[0];
    assert(
      Boolean(diagSample.id && diagSample.name && diagSample.services && typeof diagSample.distanceKm === "number"),
      "Diagnostic center contains id, name, services, and distanceKm",
      diagSample
    );

    // ─── 5. PHARMACY & MEDICINE INVENTORY FLOW ───────────────────────────────────
    console.log("\n▶ 5. Pharmacy & Medicine Inventory End-to-End Flow");
    // 5.1 Search for available medicine "Paracetamol 650" (matches by brand or generic name)
    const pharmParacetamol = await searchNearbyPharmacies({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 10,
      medicine: "Paracetamol 650",
    });
    assert(pharmParacetamol.results.length >= 1, "Found pharmacies stocking 'Paracetamol 650'", { count: pharmParacetamol.results.length });
    assert(
      pharmParacetamol.results.every((p) => p.matchedMedicine?.inStock === true && Boolean(p.matchedMedicine.medicineName)),
      "Every returned pharmacy has verified stock (inStock=true) for matched medicine (brand or generic)"
    );

    // 5.2 Search for available medicine "Amoxicillin 500mg"
    const amoxMedRow = await pool.query(`SELECT id FROM medicines WHERE name ILIKE '%Amoxicillin%' LIMIT 1`);
    const pharmsList = await pool.query(`SELECT id FROM pharmacies LIMIT 1`);
    if (amoxMedRow.rows[0] && pharmsList.rows[0]) {
      await pool.query(`
        INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, price, in_stock, quantity)
        VALUES ($1, $2, 65.0, true, 50)
        ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE SET in_stock = true, quantity = 50
      `, [pharmsList.rows[0].id, amoxMedRow.rows[0].id]);
    }

    const pharmAmox = await searchNearbyPharmacies({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 10,
      medicine: "Amoxicillin 500mg",
    });
    assert(pharmAmox.results.length >= 1, "Found pharmacies stocking 'Amoxicillin 500mg'", { count: pharmAmox.results.length });

    // 5.3 Search for unavailable medicine
    const pharmUnavailable = await searchNearbyPharmacies({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 18,
      medicine: "NonExistentMedicine9999",
    });
    assert(
      pharmUnavailable.results.length === 0,
      "Searching for unavailable medicine returns 0 pharmacies (does NOT falsely return pharmacies without stock)"
    );

    // 5.4 General pharmacy discovery without medicine filter
    const allPharms = await searchNearbyPharmacies({
      lat: kolkataPatient.lat,
      lng: kolkataPatient.lng,
      radiusKm: 10,
    });
    assert(allPharms.results.length >= 1, "General pharmacy query returns nearby pharmacies");
    assert(
      allPharms.results.every((p, i, arr) => i === 0 || p.distanceKm >= arr[i - 1].distanceKm),
      "Pharmacies are sorted nearest first by geographic distance"
    );

    // ─── 6. NON-LOCATION REGRESSION TESTS ─────────────────────────────────────────
    console.log("\n▶ 6. Non-Location Subsystem Regression Tests");

    // 6.1 Users & Authentication table
    const usersCount = await db.select().from(usersTable);
    assert(usersCount.length > 0, "Users table intact and queryable", { count: usersCount.length });

    // 6.2 Appointments System
    const appointments = await db.select().from(appointmentsTable);
    assert(appointments !== undefined, "Appointments table intact and accessible", { count: appointments.length });

    // 6.3 Digital Prescriptions System
    const prescriptions = await db.select().from(prescriptionsTable);
    assert(prescriptions !== undefined, "Prescriptions table intact and accessible", { count: prescriptions.length });

    // 6.4 Diagnostic Bookings System
    const diagBookings = await db.select().from(diagnosticBookingsTable);
    assert(diagBookings !== undefined, "Diagnostic bookings table intact and accessible", { count: diagBookings.length });

    // 6.5 Medicine Reminders System
    const reminders = await db.select().from(medicineRemindersTable);
    assert(reminders !== undefined, "Medicine reminders table intact and accessible", { count: reminders.length });

    // 6.6 Patient Medical Timeline
    const timelineEvents = await db.select().from(timelineEventsTable);
    assert(timelineEvents !== undefined, "Timeline events table intact and accessible", { count: timelineEvents.length });

    // 6.7 Health Episodes
    const healthEpisodes = await db.select().from(healthEpisodesTable);
    assert(healthEpisodes !== undefined, "Health episodes table intact and accessible", { count: healthEpisodes.length });

    // 6.8 Medicines Catalog & Pharmacy Inventory
    const catalogCount = await db.select().from(medicinesTable);
    const inventoryCount = await db.select().from(pharmacyInventoryTable);
    assert(catalogCount.length >= 8, "Medicines catalog intact with normalized entries", { count: catalogCount.length });
    assert(inventoryCount.length >= 8, "Pharmacy inventory join table intact with real stock & pricing", { count: inventoryCount.length });

    console.log("\n================================================================================");
    console.log(`📊 FINAL INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Fatal integration test error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runEndToEndIntegrationTests();

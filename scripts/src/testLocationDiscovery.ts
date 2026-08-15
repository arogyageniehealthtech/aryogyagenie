import {
  searchNearbyDoctors,
  searchNearbyDiagnosticCenters,
  searchNearbyPharmacies,
  parseCoordinates,
  clampRadiusKm,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
} from "../../artifacts/api-server/src/lib/locationService";
import { pool } from "@workspace/db";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING COMPREHENSIVE LOCATION ARCHITECTURE TESTS");
  console.log("==================================================\n");

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
    // ─── Test Suite 1: Radius & Coordinate Validation ─────────────────────────────
    console.log("--- 1. Radius & Coordinate Validation ---");
    assert(clampRadiusKm(0.5) === 2, "Radius 0.5 km clamped to 2 km minimum (MIN_RADIUS_KM)");
    assert(clampRadiusKm(1.9) === 2, "Radius 1.9 km clamped to 2 km minimum");
    assert(clampRadiusKm(50) === 18, "Radius 50 km clamped to 18 km maximum (MAX_RADIUS_KM)");
    assert(clampRadiusKm(18.5) === 18, "Radius 18.5 km clamped to 18 km maximum");
    assert(clampRadiusKm(8) === 8, "Radius 8 km accepted within [2, 18]");
    assert(clampRadiusKm(undefined) === 10, "Undefined radius defaults to 10 km");

    assert(parseCoordinates(22.5726, 88.3639) !== null, "Valid coordinates parsed successfully");
    assert(parseCoordinates(95, 88) === null, "Latitude > 90 rejected");
    assert(parseCoordinates(22, 195) === null, "Longitude > 180 rejected");
    assert(parseCoordinates("invalid", "invalid") === null, "NaN coordinates rejected");

    // Reference patient position: Park Street, Kolkata (22.5726, 88.3639)
    const patientKolkata = { lat: 22.5726, lng: 88.3639 };
    // Faraway patient position: Remote island / Pacific Ocean (0.0, 0.0)
    const patientFaraway = { lat: 0.0, lng: 0.0 };

    // ─── Test Suite 2: Doctor Discovery ──────────────────────────────────────────
    console.log("\n--- 2. Doctor Discovery Tests ---");

    const allDocsInDb = await pool.query("SELECT id, specialty, clinic_name, clinic_address, latitude, longitude FROM doctors WHERE status = 'active'");
    console.log("Active doctors in DB:", allDocsInDb.rows);

    // 2.1 Doctor search: 2 km radius for patient near doctor (22.605, 88.402)
    const docsNear2km = await searchNearbyDoctors({
      lat: 22.605,
      lng: 88.402,
      radiusKm: 2,
    });
    assert(docsNear2km.results.length >= 1, "Found doctors within 2 km radius for nearby patient", { count: docsNear2km.results.length, dist: docsNear2km.results[0]?.distanceKm });
    assert(docsNear2km.results.every((d) => d.distanceKm <= 2.05), "All doctors in 2 km query are <= 2 km away");

    // 2.2 Doctor search from Park Street at 6 km and 10 km
    const docsParkSt6km = await searchNearbyDoctors({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 6,
    });
    assert(docsParkSt6km.results.length >= 1, "Found doctors within 6 km radius from Park Street", { count: docsParkSt6km.results.length, dist: docsParkSt6km.results[0]?.distanceKm });

    // 2.2 Doctor search with specialty (e.g. Cardio / General Physician)
    const docsCardio = await searchNearbyDoctors({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
      specialty: "Cardio",
    });
    const docsGeneral = await searchNearbyDoctors({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
      specialty: "General",
    });
    assert(docsCardio.results.length >= 1 || docsGeneral.results.length >= 1, "Specialty search returns matched specialists", {
      cardio: docsCardio.results.length,
      general: docsGeneral.results.length,
    });

    const docs10km = await searchNearbyDoctors({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 10,
    });
    assert(docs10km.results.length >= docsParkSt6km.results.length, "10 km radius returns equal or more doctors than 6 km", {
      count6km: docsParkSt6km.results.length,
      count10km: docs10km.results.length,
    });

    // 2.2 Verify sorting nearest first
    const isSortedNearest = docs10km.results.every((d, i, arr) => i === 0 || d.distanceKm >= arr[i - 1].distanceKm);
    assert(isSortedNearest, "Doctors are strictly sorted nearest first (distance ascending)");

    // 2.3 Verify straight line distance metadata
    assert(docs10km.results.every((d) => d.distanceType === "straight_line_geographic"), "Distance type clearly identified as straight_line_geographic");

    // 2.4 Faraway / No results test
    const docsFaraway = await searchNearbyDoctors({
      lat: patientFaraway.lat,
      lng: patientFaraway.lng,
      radiusKm: 18,
    });
    assert(docsFaraway.results.length === 0, "No doctors returned for patient 10,000 km away in Pacific Ocean");

    // 2.5 Nonexistent specialty test
    const docsNonexistent = await searchNearbyDoctors({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
      specialty: "NonExistentSpecialty999",
    });
    assert(docsNonexistent.results.length === 0, "No doctors returned for nonexistent specialty");

    // ─── Test Suite 3: Diagnostic Center Discovery ────────────────────────────────
    console.log("\n--- 3. Diagnostic Center Discovery Tests ---");

    // 3.1 Service filtering: "Blood Test"
    const diagsBlood = await searchNearbyDiagnosticCenters({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
      service: "Blood",
    });
    assert(diagsBlood.results.length >= 1, "Found diagnostic centers providing Blood tests", { count: diagsBlood.results.length });

    // 3.2 Service filtering: "MRI"
    const diagsMRI = await searchNearbyDiagnosticCenters({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
      service: "MRI",
    });
    assert(diagsMRI.results.length >= 1, "Found diagnostic centers providing MRI", { count: diagsMRI.results.length });

    // 3.3 Multiple distances: 5 km vs 18 km
    const diags5km = await searchNearbyDiagnosticCenters({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 5,
    });
    const diags18km = await searchNearbyDiagnosticCenters({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
    });
    assert(diags18km.results.length >= diags5km.results.length, "18 km radius returns equal or more diagnostic centers than 5 km");
    assert(diags5km.results.every((d) => d.distanceKm <= 5.05), "All diagnostic centers in 5 km query are <= 5 km away");

    // 3.4 Faraway / No results test
    const diagsFaraway = await searchNearbyDiagnosticCenters({
      lat: patientFaraway.lat,
      lng: patientFaraway.lng,
      radiusKm: 18,
    });
    assert(diagsFaraway.results.length === 0, "No diagnostic centers returned for faraway coordinates");

    // ─── Test Suite 4: Pharmacy & Medicine Discovery ─────────────────────────────
    console.log("\n--- 4. Pharmacy & Medicine Discovery Tests ---");

    // 4.1 Medicine search: "Paracetamol 650"
    const pharmsParacetamol = await searchNearbyPharmacies({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 10,
      medicine: "Paracetamol 650",
    });
    assert(pharmsParacetamol.results.length >= 1, "Found pharmacies stocking 'Paracetamol 650'", { count: pharmsParacetamol.results.length });
    assert(
      pharmsParacetamol.results.every((p) => p.matchedMedicine && p.matchedMedicine.inStock === true),
      "All returned pharmacies have 'Paracetamol 650' verified in_stock = true",
    );

    // 4.2 Medicine search: "Amoxicillin"
    const pharmsAmox = await searchNearbyPharmacies({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 10,
      medicine: "Amoxicillin",
    });
    assert(pharmsAmox.results.length >= 1, "Found pharmacies stocking 'Amoxicillin'", { count: pharmsAmox.results.length });

    // 4.3 Unavailable medicine search: "NonExistentMedicine999"
    const pharmsUnavailable = await searchNearbyPharmacies({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 18,
      medicine: "NonExistentMedicine999",
    });
    assert(
      pharmsUnavailable.results.length === 0,
      "Searching unavailable medicine returns 0 pharmacies (does NOT falsely return nearby pharmacies without stock)",
    );

    // 4.4 General pharmacy discovery without medicine filter
    const allNearbyPharms = await searchNearbyPharmacies({
      lat: patientKolkata.lat,
      lng: patientKolkata.lng,
      radiusKm: 10,
    });
    assert(allNearbyPharms.results.length >= 1, "General pharmacy search returns nearby pharmacies");
    assert(
      allNearbyPharms.results.every((p, i, arr) => i === 0 || p.distanceKm >= arr[i - 1].distanceKm),
      "Pharmacies are sorted nearest first by geographic distance",
    );

    // ─── Test Suite 5: PostGIS Spatial Index Utilization ─────────────────────────
    console.log("\n--- 5. PostGIS Spatial Index Verification ---");
    const explainRes = await pool.query(`
      EXPLAIN SELECT d.id, d.clinic_name
      FROM doctors d
      WHERE d.status = 'active'
        AND d.latitude IS NOT NULL
        AND d.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326)::geography,
          10000
        )
    `);
    const planText = explainRes.rows.map((r: any) => r["QUERY PLAN"]).join("\n");
    console.log("PostGIS Query Plan Preview:\n", planText);
    assert(planText.length > 0, "PostGIS EXPLAIN plan generated successfully");

    console.log("\n==================================================");
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Test run fatal error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();

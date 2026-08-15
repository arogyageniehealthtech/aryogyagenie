import {
  searchNearbyDoctors,
  searchNearbyDiagnosticCenters,
  searchNearbyPharmacies,
  parseCoordinates,
  clampRadiusKm,
  resolveProviderCoordinates,
  syncAllProviderCoordinates,
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
    // ─── Pre-test: Sync all provider coordinates ──────────────────────────────
    console.log("--- 0. Synchronize & Repair All Provider Coordinates ---");
    const syncRes = await syncAllProviderCoordinates();
    console.log("Sync result:", syncRes);
    assert(true, "syncAllProviderCoordinates completed without error");

    // ─── Test Suite 1: Radius & Coordinate Validation ─────────────────────────
    console.log("\n--- 1. Radius & Coordinate Validation ---");
    assert(clampRadiusKm(0) === 0, "Radius 0 km accepted as minimum");
    assert(clampRadiusKm(-5) === 10, "Negative radius defaults to 10 km");
    assert(clampRadiusKm(50) === 18, "Radius 50 km clamped to 18 km maximum");
    assert(clampRadiusKm(18.5) === 18, "Radius 18.5 km clamped to 18 km maximum");
    assert(clampRadiusKm(8) === 8, "Radius 8 km accepted within [0, 18]");
    assert(clampRadiusKm(undefined) === 10, "Undefined radius defaults to 10 km");

    assert(parseCoordinates(22.5726, 88.3639) !== null, "Valid coordinates parsed successfully");
    assert(parseCoordinates(95, 88) === null, "Latitude > 90 rejected");
    assert(parseCoordinates(22, 195) === null, "Longitude > 180 rejected");
    assert(parseCoordinates("invalid", "invalid") === null, "NaN coordinates rejected");
    assert(parseCoordinates(0, 0) === null, "(0, 0) null coordinates rejected");

    // ─── Test Suite 2: Offline Dictionary & Auto-Geocoding ────────────────────
    console.log("\n--- 2. Offline Dictionary & Auto-Geocoding Tests ---");
    const lakeTownCoords = await resolveProviderCoordinates({ address: "Lake Town, Block A" });
    assert(
      Math.abs(lakeTownCoords.lat - 22.6057) < 0.01 && Math.abs(lakeTownCoords.lng - 88.403) < 0.01,
      "Lake Town resolved to ~22.6057, 88.4030",
      lakeTownCoords,
    );

    const saltLakeCoords = await resolveProviderCoordinates({ address: "Salt Lake Sector V" });
    assert(
      Math.abs(saltLakeCoords.lat - 22.5794) < 0.01 && Math.abs(saltLakeCoords.lng - 88.4345) < 0.01,
      "Salt Lake Sector V resolved to ~22.5794, 88.4345",
      saltLakeCoords,
    );

    const dumdumCoords = await resolveProviderCoordinates({ address: "Dum Dum, Cantonment" });
    assert(
      Math.abs(dumdumCoords.lat - 22.6521) < 0.01 && Math.abs(dumdumCoords.lng - 88.436) < 0.01,
      "Dum Dum resolved to ~22.6521, 88.4360",
      dumdumCoords,
    );

    // ─── Test Suite 3: Dr. Rohit at Lake Town Discovery ───────────────────────
    console.log("\n--- 3. Dr. Rohit Location Discovery Tests ---");

    // Patient at Lake Town: lat 22.605728, lng 88.40296
    const patientLakeTown = { lat: 22.605728, lng: 88.40296 };

    // 3.1 Discover doctors at Lake Town within 18 km
    const docsLakeTown18km = await searchNearbyDoctors({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
    });
    assert(docsLakeTown18km.results.length >= 1, "Found doctors within 18 km of Lake Town", {
      count: docsLakeTown18km.results.length,
      doctors: docsLakeTown18km.results.map((d) => ({ name: d.name, dist: d.distanceKm, address: d.clinicAddress })),
    });

    // 3.2 Verify Dr. Rohit is in results at 0 km
    const rohitDoc = docsLakeTown18km.results.find((d) => d.name.toLowerCase().includes("rohit"));
    assert(!!rohitDoc, "Dr. Rohit is included in Lake Town 18 km radius results");
    if (rohitDoc) {
      assert(rohitDoc.distanceKm <= 0.5, "Dr. Rohit is within 0.5 km of Lake Town center", { distanceKm: rohitDoc.distanceKm });
    }

    // 3.3 Search specifically for "Rohit" by name
    const docsSearchRohit = await searchNearbyDoctors({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
      search: "Rohit",
    });
    assert(docsSearchRohit.results.length >= 1, "Keyword search for 'Rohit' returns Dr. Rohit", {
      results: docsSearchRohit.results.map((d) => d.name),
    });
    assert(
      docsSearchRohit.results.some((d) => d.name.toLowerCase().includes("rohit")),
      "Dr. Rohit is in the keyword search results",
    );

    // 3.4 Search with specialty filter "General Physician"
    const docsGenPhys = await searchNearbyDoctors({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
      specialty: "General Physician",
    });
    assert(docsGenPhys.results.length >= 1, "Filter by 'General Physician' returns matching doctors", {
      count: docsGenPhys.results.length,
      doctors: docsGenPhys.results.map((d) => d.name),
    });
    assert(
      docsGenPhys.results.some((d) => d.name.toLowerCase().includes("rohit")),
      "Dr. Rohit is included in 'General Physician' specialty results",
    );

    // ─── Test Suite 4: Diagnostic Centers & Pharmacies Discovery ──────────────
    console.log("\n--- 4. Diagnostic Centers & Pharmacies Discovery Tests ---");

    // 4.1 Diagnostic centers within 18 km of Lake Town
    const diags18km = await searchNearbyDiagnosticCenters({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
    });
    assert(diags18km.results.length >= 1, "Diagnostic centers found within 18 km of Lake Town", {
      count: diags18km.results.length,
      centers: diags18km.results.map((d) => ({ name: d.name, dist: d.distanceKm })),
    });

    // 4.2 Diagnostic center search by name "Suraksha"
    const diagsSuraksha = await searchNearbyDiagnosticCenters({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
      search: "Suraksha",
    });
    assert(diagsSuraksha.results.length >= 1, "Search for 'Suraksha' returns Suraksha Diagnostics", {
      results: diagsSuraksha.results.map((d) => d.name),
    });

    // 4.3 Pharmacies within 18 km of Lake Town
    const pharms18km = await searchNearbyPharmacies({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
    });
    assert(pharms18km.results.length >= 1, "Pharmacies found within 18 km of Lake Town", {
      count: pharms18km.results.length,
      pharmacies: pharms18km.results.map((p) => ({ name: p.name, dist: p.distanceKm })),
    });

    // 4.4 Pharmacy search by name "MedPlus"
    const pharmsMedPlus = await searchNearbyPharmacies({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
      search: "MedPlus",
    });
    assert(pharmsMedPlus.results.length >= 1, "Search for 'MedPlus' returns MedPlus Pharmacy", {
      results: pharmsMedPlus.results.map((p) => p.name),
    });

    // 4.5 Pharmacy search with medicine filter
    const pharmsWithMed = await searchNearbyPharmacies({
      lat: patientLakeTown.lat,
      lng: patientLakeTown.lng,
      radiusKm: 18,
      medicine: "Paracetamol 650",
    });
    assert(pharmsWithMed.results.length >= 1, "Search by medicine 'Paracetamol 650' returns stocking pharmacy", {
      count: pharmsWithMed.results.length,
      pharmacy: pharmsWithMed.results[0]?.name,
      medicine: pharmsWithMed.results[0]?.matchedMedicine?.medicineName,
    });

    console.log("\n==================================================");
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("==================================================");

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

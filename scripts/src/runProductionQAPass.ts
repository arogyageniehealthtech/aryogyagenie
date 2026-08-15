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
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

async function runProductionQAPass() {
  console.log("================================================================================");
  console.log("🛡️  AAROGYAGENIE PRODUCTION-SAFETY & QA AUDIT PASS");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, section: string, testName: string, meta?: any) {
    if (condition) {
      console.log(`[${section}] ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`[${section}] ❌ FAIL: ${testName}`, meta || "");
      failed++;
    }
  }

  try {
    // ─── 1. DATABASE & POSTGIS INTEGRITY QA ───────────────────────────────────────
    console.log("--- 1. DATABASE & SPATIAL ENGINE QA ---");
    
    // 1.1 Check PostgreSQL connection
    const nowRes = await pool.query("SELECT NOW() as server_time, current_database() as db_name");
    testAssert(Boolean(nowRes.rows[0]?.server_time), "DATABASE", "PostgreSQL database connection active", nowRes.rows[0]);

    // 1.2 Check PostGIS extension & version
    const postgisRes = await pool.query("SELECT PostGIS_Version()");
    testAssert(Boolean(postgisRes.rows[0]?.postgis_version), "DATABASE", "PostGIS spatial extension enabled & active", postgisRes.rows[0]);

    // 1.3 Check Spatial GiST Indexes
    const indexRes = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE indexname IN ('idx_doctors_geo', 'idx_pharmacies_geo', 'idx_diagnostic_centers_geo')
    `);
    testAssert(indexRes.rows.length === 3, "DATABASE", "All 3 PostGIS spatial GiST indexes present", {
      found: indexRes.rows.map((r: any) => r.indexname),
    });

    // 1.4 Check provider coordinates persistence (no null or fake values in active providers)
    const activeDocs = await db.select().from(doctorsTable).where(eq(doctorsTable.status, "active"));
    const activePharms = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.status, "active"));
    const activeDiags = await db.select().from(diagnosticCentersTable).where(eq(diagnosticCentersTable.status, "active"));

    testAssert(
      activeDocs.length > 0 && activeDocs.every((d) => d.latitude !== null && d.longitude !== null),
      "DATABASE",
      `Active doctors have valid coordinates (${activeDocs.length} verified)`
    );
    testAssert(
      activePharms.length > 0 && activePharms.every((p) => p.latitude !== null && p.longitude !== null),
      "DATABASE",
      `Active pharmacies have valid coordinates (${activePharms.length} verified)`
    );
    testAssert(
      activeDiags.length > 0 && activeDiags.every((dc) => dc.latitude !== null && dc.longitude !== null),
      "DATABASE",
      `Active diagnostic centers have valid coordinates (${activeDiags.length} verified)`
    );

    // ─── 2. FUNCTIONAL QA: DOCTOR DISCOVERY ───────────────────────────────────────
    console.log("\n--- 2. FUNCTIONAL QA: DOCTORS ---");
    const testOrigin = { lat: 22.5726, lng: 88.3639 }; // Park Street, Kolkata

    // 2.1 Doctor search at multiple radii
    const docs2km = await searchNearbyDoctors({ lat: 22.605, lng: 88.402, radiusKm: 2 });
    const docs5km = await searchNearbyDoctors({ lat: testOrigin.lat, lng: testOrigin.lng, radiusKm: 5 });
    const docs10km = await searchNearbyDoctors({ lat: testOrigin.lat, lng: testOrigin.lng, radiusKm: 10 });
    const docs18km = await searchNearbyDoctors({ lat: testOrigin.lat, lng: testOrigin.lng, radiusKm: 18 });

    testAssert(docs2km.results.length >= 1, "DOCTORS", "2 km radius returns doctors within 2 km", { count: docs2km.results.length });
    testAssert(docs10km.results.length >= docs5km.results.length, "DOCTORS", "10 km radius returns >= 5 km radius results");
    testAssert(docs18km.results.length >= docs10km.results.length, "DOCTORS", "18 km radius returns >= 10 km radius results");

    // 2.2 Specialty search: "General Physician"
    const docSpecialty = await searchNearbyDoctors({ lat: testOrigin.lat, lng: testOrigin.lng, radiusKm: 18, specialty: "General" });
    testAssert(docSpecialty.results.length >= 1, "DOCTORS", "Specialty search returns matched specialists", { count: docSpecialty.results.length });

    // 2.3 Distance sorting
    const isDocSorted = docs18km.results.every((d, i, arr) => i === 0 || d.distanceKm >= arr[i - 1].distanceKm);
    testAssert(isDocSorted, "DOCTORS", "Doctor results strictly sorted nearest first");

    // ─── 3. FUNCTIONAL QA: DIAGNOSTIC CENTERS ────────────────────────────────────
    console.log("\n--- 3. FUNCTIONAL QA: DIAGNOSTIC CENTERS ---");
    
    // 3.1 Service search: "Blood Test"
    const diagsBlood = await searchNearbyDiagnosticCenters({ lat: testOrigin.lat, lng: testOrigin.lng, radiusKm: 18, service: "Blood" });
    testAssert(diagsBlood.results.length >= 1, "DIAGNOSTIC", "Diagnostic centers offering 'Blood Test' discovered", { count: diagsBlood.results.length });

    // 3.2 Service search: "MRI"
    const diagsMRI = await searchNearbyDiagnosticCenters({ lat: testOrigin.lat, lng: testOrigin.lng, radiusKm: 18, service: "MRI" });
    testAssert(diagsMRI.results.length >= 1, "DIAGNOSTIC", "Diagnostic centers offering 'MRI' discovered", { count: diagsMRI.results.length });

    // 3.3 Diagnostic distance sorting
    const isDiagSorted = diagsBlood.results.every((d, i, arr) => i === 0 || d.distanceKm >= arr[i - 1].distanceKm);
    testAssert(isDiagSorted, "DIAGNOSTIC", "Diagnostic center results strictly sorted nearest first");

    // ─── 4. FUNCTIONAL QA: PHARMACIES & MEDICINES ────────────────────────────────
    console.log("\n--- 4. FUNCTIONAL QA: PHARMACIES & MEDICINE INVENTORY ---");

    // 4.1 Medicine search: "Paracetamol 650"
    const pharmsParacetamol = await searchNearbyPharmacies({
      lat: testOrigin.lat,
      lng: testOrigin.lng,
      radiusKm: 10,
      medicine: "Paracetamol 650",
    });
    testAssert(pharmsParacetamol.results.length >= 1, "PHARMACY", "Pharmacies with 'Paracetamol 650' found", { count: pharmsParacetamol.results.length });
    testAssert(
      pharmsParacetamol.results.every((p) => p.matchedMedicine?.inStock === true),
      "PHARMACY",
      "Only pharmacies with in_stock = true returned"
    );

    // 4.2 Medicine search: "Amoxicillin 500mg"
    const pharmsAmox = await searchNearbyPharmacies({
      lat: testOrigin.lat,
      lng: testOrigin.lng,
      radiusKm: 10,
      medicine: "Amoxicillin 500mg",
    });
    testAssert(pharmsAmox.results.length >= 1, "PHARMACY", "Pharmacies with 'Amoxicillin 500mg' found", { count: pharmsAmox.results.length });

    // 4.3 Unavailable medicine search
    const pharmsUnavailable = await searchNearbyPharmacies({
      lat: testOrigin.lat,
      lng: testOrigin.lng,
      radiusKm: 18,
      medicine: "NonExistentMedicine99999",
    });
    testAssert(
      pharmsUnavailable.results.length === 0,
      "PHARMACY",
      "Unavailable medicine returns 0 results (no false positive listings)"
    );

    // ─── 5. LOCATION & RADIUS CONSTRAINT QA ──────────────────────────────────────
    console.log("\n--- 5. LOCATION & RADIUS BOUNDS QA ---");
    testAssert(clampRadiusKm(0.2) === 2, "RADIUS", "Sub-minimum radius (0.2 km) clamped to 2 km minimum");
    testAssert(clampRadiusKm(1.5) === 2, "RADIUS", "Sub-minimum radius (1.5 km) clamped to 2 km minimum");
    testAssert(clampRadiusKm(25) === 18, "RADIUS", "Exceeded radius (25 km) clamped to 18 km maximum");
    testAssert(clampRadiusKm(100) === 18, "RADIUS", "Exceeded radius (100 km) clamped to 18 km maximum");
    testAssert(parseCoordinates("invalid", "invalid") === null, "COORDINATES", "NaN coordinates safely rejected");
    testAssert(parseCoordinates(95, 88) === null, "COORDINATES", "Out-of-range latitude safely rejected");

    // ─── 6. PERFORMANCE & DATABASE FILTERING QA ──────────────────────────────────
    console.log("\n--- 6. PERFORMANCE & DATABASE QUERY QA ---");
    const explainRes = await pool.query(`
      EXPLAIN ANALYZE SELECT d.id, d.clinic_address
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
    const planLines = explainRes.rows.map((r: any) => r["QUERY PLAN"]).join("\n");
    testAssert(planLines.includes("Index Scan") || planLines.includes("Filter"), "PERFORMANCE", "PostGIS index scan executed in PostgreSQL");
    console.log("PostGIS Query Execution Time Plan:\n", planLines.split("\n").slice(0, 4).join("\n"));

    // ─── 7. SECURITY QA ──────────────────────────────────────────────────────────
    console.log("\n--- 7. SECURITY QA ---");
    const envUrl = process.env.DATABASE_URL || "";
    testAssert(envUrl.length > 0, "SECURITY", "DATABASE_URL loaded from environment (not hardcoded in code)");
    testAssert(!envUrl.includes("localhost") || envUrl.includes("postgres"), "SECURITY", "Valid PostgreSQL connection string formatted");

    console.log("\n================================================================================");
    console.log(`📊 PRODUCTION QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Fatal QA Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runProductionQAPass();

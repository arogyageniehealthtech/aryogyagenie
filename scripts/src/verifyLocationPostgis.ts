import { pool } from "@workspace/db";
import {
  searchNearbyDoctors,
  searchNearbyDiagnosticCenters,
  searchNearbyPharmacies,
  parseCoordinates,
  clampRadiusKm,
  resolveProviderCoordinates,
} from "../../artifacts/api-server/src/lib/locationService";

async function main() {
  console.log("===============================================================================");
  console.log("🔍 AROGYAGENIE POSTGIS & LOCATION SERVICE COMPLETE VERIFICATION & QA SUITE");
  console.log("===============================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || "");
    }
  }

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1 & 3: Check PostGIS Extension
    // ──────────────────────────────────────────────────────────────────────────
    console.log("--- STEP 1 & 3: Check & Ensure PostGIS Extension ---");
    await pool.query("CREATE EXTENSION IF NOT EXISTS postgis");
    const versionRes = await pool.query("SELECT PostGIS_Version()");
    const postgisVersion = versionRes.rows[0]?.postgis_version;
    console.log("PostGIS Version Output:", postgisVersion);
    assert(Boolean(postgisVersion && postgisVersion.length > 0), "PostGIS extension is active and version is queryable");

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Doctor Coordinate Format & Numeric Types
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- STEP 4: Verify Doctor & Provider Coordinate Format & Data Types ---");
    const docTypes = await pool.query(`
      SELECT 
        id, 
        clinic_name, 
        latitude, 
        longitude, 
        status, 
        pg_typeof(latitude)::text as lat_type, 
        pg_typeof(longitude)::text as lng_type 
      FROM doctors 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
      LIMIT 5
    `);
    console.log("Doctors sample records:", docTypes.rows);
    assert(docTypes.rows.length > 0, "Doctors table contains valid coordinates");
    if (docTypes.rows.length > 0) {
      const firstDoc = docTypes.rows[0];
      assert(
        firstDoc.lat_type === "real" || firstDoc.lat_type === "double precision",
        `Doctor latitude column is numeric type in Postgres (${firstDoc.lat_type})`
      );
      assert(
        firstDoc.lng_type === "real" || firstDoc.lng_type === "double precision",
        `Doctor longitude column is numeric type in Postgres (${firstDoc.lng_type})`
      );
      assert(typeof firstDoc.latitude === "number", "Driver returns latitude as JavaScript number");
      assert(typeof firstDoc.longitude === "number", "Driver returns longitude as JavaScript number");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Test Spatial Query Directly with PostGIS Geography Cast & ST_DWithin
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- STEP 5: Direct SQL ST_DWithin & ST_Distance Geography Query ---");
    // Testing around Kolkata / Lake Town coordinates (lat: 22.6057, lng: 88.4030)
    const direct1km = await pool.query(`
      SELECT 
        d.id,
        d.user_id,
        u.first_name,
        u.last_name,
        d.specialty,
        d.clinic_name,
        d.latitude,
        d.longitude,
        ROUND((ST_Distance(
          ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint(88.4030::float8, 22.6057::float8), 4326)::geography
        ) / 1000.0)::numeric, 3)::float as distance_km
      FROM doctors d
      INNER JOIN users u ON d.user_id = u.id
      WHERE 
        LOWER(COALESCE(d.status, 'active')) IN ('active', 'approved')
        AND d.latitude IS NOT NULL 
        AND d.longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint(88.4030::float8, 22.6057::float8), 4326)::geography,
          1000::float8 -- 1 km in meters
        )
      LIMIT 10;
    `);
    console.log(`Direct 1 km query returned ${direct1km.rows.length} doctors:`, direct1km.rows);
    assert(direct1km.rows.length >= 1, "Direct PostGIS 1km ST_DWithin query executes and finds nearby doctors");
    if (direct1km.rows.length > 0) {
      assert(direct1km.rows[0].distance_km <= 1.0, `Doctor distance (${direct1km.rows[0].distance_km} km) is within 1 km threshold`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: LocationService searchNearbyDoctors API Function Tests
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- STEP 6: locationService searchNearbyDoctors Function Execution ---");

    // 6.1: 1 km radius search
    const docs1km = await searchNearbyDoctors({
      lat: 22.6057,
      lng: 88.4030,
      radiusKm: 1,
    });
    console.log(`searchNearbyDoctors (radius 1 km) returned ${docs1km.results.length} results:`, docs1km.results.map(d => ({ name: d.name, dist: d.distanceKm })));
    assert(docs1km.results.length >= 1, "searchNearbyDoctors returns results for 1 km radius");
    assert(docs1km.results[0].distanceKm <= 1.0, `First doctor distance (${docs1km.results[0].distanceKm} km) <= 1.0 km`);

    // 6.2: 10 km default radius search
    const docs10km = await searchNearbyDoctors({
      lat: 22.6057,
      lng: 88.4030,
      radiusKm: 10,
    });
    assert(docs10km.results.length >= 1, "searchNearbyDoctors returns results for 10 km radius");

    // 6.3: 18 km max radius search
    const docs18km = await searchNearbyDoctors({
      lat: 22.6057,
      lng: 88.4030,
      radiusKm: 18,
    });
    assert(docs18km.results.length >= docs1km.results.length, "searchNearbyDoctors 18 km returns >= 1 km results");

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 7: Parameter Validation & Parsing (Simulating API Query String)
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- STEP 7: API Parameter Validation & Clamping ---");
    const testQuery = { lat: "22.5726", lng: "88.3639", radius: "1" };
    const parsedCoords = parseCoordinates(testQuery.lat, testQuery.lng);
    const clampedRadius = clampRadiusKm(testQuery.radius);

    assert(parsedCoords !== null && parsedCoords.lat === 22.5726 && parsedCoords.lng === 88.3639, "API string coordinates correctly parsed to numeric lat/lng");
    assert(clampedRadius === 1, "API radius '1' correctly parsed and clamped to 1 km");

    const apiSimulatedSearch = await searchNearbyDoctors({
      lat: parsedCoords!.lat,
      lng: parsedCoords!.lng,
      radiusKm: clampedRadius,
    });
    assert(apiSimulatedSearch.results.length >= 1, "API simulation: Doctors returned successfully for query parameters");

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 8: Diagnostic Centers & Pharmacies PostGIS Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n--- STEP 8: Diagnostic Centers & Pharmacies PostGIS Queries ---");
    const diagResults = await searchNearbyDiagnosticCenters({
      lat: 22.6057,
      lng: 88.4030,
      radiusKm: 18,
    });
    console.log(`Diagnostic Centers found: ${diagResults.results.length}`);
    assert(Array.isArray(diagResults.results), "searchNearbyDiagnosticCenters executes without PostGIS errors");

    const pharmResults = await searchNearbyPharmacies({
      lat: 22.6057,
      lng: 88.4030,
      radiusKm: 18,
    });
    console.log(`Pharmacies found: ${pharmResults.results.length}`);
    assert(Array.isArray(pharmResults.results), "searchNearbyPharmacies executes without PostGIS errors");

    // Summary
    console.log("\n===============================================================================");
    console.log(`🏁 VERIFICATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log("===============================================================================\n");

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ Fatal verification error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

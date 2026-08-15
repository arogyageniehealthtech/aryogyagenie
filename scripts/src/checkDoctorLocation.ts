import { pool } from "@workspace/db";
import { searchNearbyDoctors, searchNearbyDiagnosticCenters, searchNearbyPharmacies } from "../../artifacts/api-server/src/lib/locationService";

async function main() {
  console.log("=== ALL USERS ===");
  const users = await pool.query("SELECT id, email, role, status, first_name, last_name FROM users");
  console.table(users.rows);

  console.log("\n=== ALL DOCTORS ===");
  const docs = await pool.query(`
    SELECT d.id, d.user_id, d.specialty, d.clinic_address, d.latitude, d.longitude, d.status,
           u.first_name, u.last_name, u.email, u.status as user_status
    FROM doctors d LEFT JOIN users u ON d.user_id = u.id
  `);
  console.table(docs.rows);

  console.log("\n=== ALL DIAGNOSTIC CENTERS ===");
  const diags = await pool.query("SELECT id, name, status, latitude, longitude, address FROM diagnostic_centers");
  console.table(diags.rows);

  console.log("\n=== ALL PHARMACIES ===");
  const pharms = await pool.query("SELECT id, name, status, latitude, longitude, address FROM pharmacies");
  console.table(pharms.rows);

  console.log("\n=== PostGIS Version ===");
  try {
    const ext = await pool.query(`SELECT PostGIS_Version()`);
    console.log("PostGIS:", ext.rows[0]);
  } catch (e: any) {
    console.error("PostGIS NOT AVAILABLE:", e.message);
  }

  console.log("\n=== SPATIAL SEARCH: Doctors from (22.61, 88.405) radius=18km ===");
  const res1 = await searchNearbyDoctors({ lat: 22.61, lng: 88.405, radiusKm: 18 });
  console.log(`Found ${res1.total} doctors:`);
  console.log(JSON.stringify(res1.results.map(r => ({ id: r.id, name: r.name, lat: r.latitude, lng: r.longitude, dist: r.distanceKm, status: "active" })), null, 2));

  console.log("\n=== SPATIAL SEARCH: Doctors from default Kolkata (22.5726, 88.3639) radius=18km ===");
  const res2 = await searchNearbyDoctors({ lat: 22.5726, lng: 88.3639, radiusKm: 18 });
  console.log(`Found ${res2.total} doctors:`);
  console.log(JSON.stringify(res2.results.map(r => ({ id: r.id, name: r.name, lat: r.latitude, lng: r.longitude, dist: r.distanceKm })), null, 2));

  console.log("\n=== SPATIAL SEARCH: Diagnostic Centers from (22.61, 88.405) radius=18km ===");
  const res3 = await searchNearbyDiagnosticCenters({ lat: 22.61, lng: 88.405, radiusKm: 18 });
  console.log(`Found ${res3.total} diagnostic centers`);

  console.log("\n=== SPATIAL SEARCH: Pharmacies from (22.61, 88.405) radius=18km ===");
  const res4 = await searchNearbyPharmacies({ lat: 22.61, lng: 88.405, radiusKm: 18 });
  console.log(`Found ${res4.total} pharmacies`);

  await pool.end();
}

main().catch(console.error);

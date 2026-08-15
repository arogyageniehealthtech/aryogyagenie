import { pool } from "@workspace/db";
import { searchNearbyDoctors, searchNearbyDiagnosticCenters, searchNearbyPharmacies } from "../../artifacts/api-server/src/lib/locationService";

async function test() {
  console.log("=== Doctors in DB ===");
  const docsInDb = await pool.query(
    "SELECT d.id, d.user_id, d.specialty, d.clinic_address, d.latitude, d.longitude, d.status, u.first_name, u.last_name, u.role as user_role, u.status as user_status FROM doctors d LEFT JOIN users u ON d.user_id = u.id"
  );
  console.table(docsInDb.rows);

  console.log("=== Users in DB ===");
  const usersInDb = await pool.query(
    "SELECT id, email, role, status, address, city, latitude, longitude FROM users"
  );
  console.table(usersInDb.rows);

  console.log("\n--- Test 1: Search from Lake Town (22.6057, 88.4030) radius=18km ---");
  const res1 = await searchNearbyDoctors({ lat: 22.6057, lng: 88.4030, radiusKm: 18 });
  console.log("Result 1 count:", res1.total, "results:", res1.results);

  console.log("\n--- Test 2: Search from Park Street (22.5532, 88.3512) radius=10km ---");
  const res2 = await searchNearbyDoctors({ lat: 22.5532, lng: 88.3512, radiusKm: 10 });
  console.log("Result 2 count:", res2.total, "results:", res2.results);

  console.log("\n--- Test 3: Search from Default Kolkata (22.5726, 88.3639) radius=10km ---");
  const res3 = await searchNearbyDoctors({ lat: 22.5726, lng: 88.3639, radiusKm: 10 });
  console.log("Result 3 count:", res3.total, "results:", res3.results);

  console.log("\n--- Test 4: Search from Swamiji Sarani (22.6100, 88.4050) radius=18km ---");
  const res4 = await searchNearbyDoctors({ lat: 22.6100, lng: 88.4050, radiusKm: 18 });
  console.log("Result 4 count:", res4.total, "results:", res4.results);

  await pool.end();
}

test().catch(console.error);

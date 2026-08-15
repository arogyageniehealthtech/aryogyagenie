import { pool } from "@workspace/db";
import { searchNearbyDoctors, resolveProviderCoordinates } from "../../artifacts/api-server/src/lib/locationService";

async function main() {
  const docs = await pool.query("SELECT id, user_id, specialty, clinic_address, latitude, longitude, status FROM doctors");
  console.log("DOCTORS IN DB:", docs.rows);

  const testLoc1 = { lat: 22.61, lng: 88.405 }; // South Dumdum (Lake Town)
  const res1 = await searchNearbyDoctors({ lat: testLoc1.lat, lng: testLoc1.lng, radiusKm: 18 });
  console.log("SEARCH FROM (22.61, 88.405):", JSON.stringify(res1, null, 2));

  const testLoc2 = { lat: 22.5726, lng: 88.3639 }; // Kolkata Center
  const res2 = await searchNearbyDoctors({ lat: testLoc2.lat, lng: testLoc2.lng, radiusKm: 18 });
  console.log("SEARCH FROM Kolkata Center (22.5726, 88.3639):", JSON.stringify(res2, null, 2));
}

main().catch(console.error);

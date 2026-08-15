import { searchNearbyDoctors } from "../../artifacts/api-server/src/lib/locationService";
import { pool } from "@workspace/db";

async function testVariousCoords() {
  try {
    // 1. Kolkata center (Park Street: 22.5726, 88.3639)
    console.log("--- Query from Park Street (22.5726, 88.3639), radius: 18km ---");
    const res1 = await searchNearbyDoctors({
      lat: 22.5726,
      lng: 88.3639,
      radiusKm: 18,
    });
    console.log("Results from Park Street:", JSON.stringify(res1.results, null, 2));

    // 2. Query with specialty "Cardiology" vs "General Physician" vs undefined
    console.log("\n--- Query with specialty 'Cardiology' ---");
    const resCardio = await searchNearbyDoctors({
      lat: 22.5726,
      lng: 88.3639,
      radiusKm: 18,
      specialty: "Cardiology",
    });
    console.log("Cardiology results:", resCardio.results.length);

    console.log("\n--- Query with specialty 'General' ---");
    const resGeneral = await searchNearbyDoctors({
      lat: 22.5726,
      lng: 88.3639,
      radiusKm: 18,
      specialty: "General",
    });
    console.log("General Physician results:", resGeneral.results.length);

    // 3. What if patient coordinates were in a different city or location?
    // Let's check coordinates around Howrah, Salt Lake, etc.
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testVariousCoords();

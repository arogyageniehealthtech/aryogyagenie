import express from "express";
import nearbyRouter from "../../artifacts/api-server/src/routes/nearby";

async function runApiNearbyFilterTests() {
  console.log("=== TESTING /api/nearby UNIFIED DISCOVERY & FILTERS ===");

  const app = express();
  app.use(express.json());
  app.use("/api", nearbyRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/nearby?lat=22.6100&lng=88.4050&radius=18`;

  try {
    interface NearbyItem {
      id: number | string;
      name: string;
      type: "doctor" | "hospital" | "diagnostic_center" | "pharmacy" | string;
      distanceKm: number;
      [key: string]: any;
    }

    interface NearbyApiResponse {
      count: number;
      total: number;
      radiusKm: number;
      results: NearbyItem[];
      [key: string]: any;
    }

    // 1. type=all
    const allRes = await fetch(`${baseUrl}&type=all`);
    const allData = (await allRes.json()) as NearbyApiResponse;
    console.log(`\n✨ Unified type=all: ${allData.results.length} total providers returned.`);
    const typesFound = new Set(allData.results.map((r: any) => r.type));
    console.log("Found provider types:", Array.from(typesFound));
    if (!typesFound.has("doctor") || !typesFound.has("hospital") || !typesFound.has("diagnostic_center") || !typesFound.has("pharmacy")) {
      throw new Error(`FAIL: Expected all 4 types (doctor, hospital, diagnostic_center, pharmacy) but found: ${Array.from(typesFound)}`);
    }
    console.log("✅ PASS: Nearest Care Map API returns all 4 healthcare facility categories!");

    // 2. type=doctor
    const docRes = await fetch(`${baseUrl}&type=doctor`);
    const docData = (await docRes.json()) as NearbyApiResponse;
    console.log(`\n🩺 Filter type=doctor: ${docData.results.length} results returned.`);
    const docTypes = new Set(docData.results.map((r: any) => r.type));
    if (docTypes.size !== 1 || !docTypes.has("doctor")) {
      throw new Error(`FAIL: Found non-doctor items when filtering type=doctor: ${Array.from(docTypes)}`);
    }
    console.log("✅ PASS: type=doctor returns doctors exclusively.");

    // 3. type=hospital
    const hospRes = await fetch(`${baseUrl}&type=hospital`);
    const hospData = (await hospRes.json()) as NearbyApiResponse;
    console.log(`\n🏥 Filter type=hospital: ${hospData.results.length} results returned.`);
    const hospTypes = new Set(hospData.results.map((r: any) => r.type));
    if (hospTypes.size !== 1 || !hospTypes.has("hospital")) {
      throw new Error(`FAIL: Found non-hospital items when filtering type=hospital: ${Array.from(hospTypes)}`);
    }
    console.log("✅ PASS: type=hospital returns hospitals exclusively.");

    // 4. type=diagnostic_center
    const diagRes = await fetch(`${baseUrl}&type=diagnostic_center`);
    const diagData = (await diagRes.json()) as NearbyApiResponse;
    console.log(`\n🔬 Filter type=diagnostic_center: ${diagData.results.length} results returned.`);
    const diagTypes = new Set(diagData.results.map((r: any) => r.type));
    if (diagTypes.size !== 1 || !diagTypes.has("diagnostic_center")) {
      throw new Error(`FAIL: Found non-lab items when filtering type=diagnostic_center: ${Array.from(diagTypes)}`);
    }
    console.log("✅ PASS: type=diagnostic_center returns diagnostic labs exclusively.");

    // 5. type=pharmacy
    const pharmRes = await fetch(`${baseUrl}&type=pharmacy`);
    const pharmData = (await pharmRes.json()) as NearbyApiResponse;
    console.log(`\n💊 Filter type=pharmacy: ${pharmData.results.length} results returned.`);
    const pharmTypes = new Set(pharmData.results.map((r: any) => r.type));
    if (pharmTypes.size !== 1 || !pharmTypes.has("pharmacy")) {
      throw new Error(`FAIL: Found non-pharmacy items when filtering type=pharmacy: ${Array.from(pharmTypes)}`);
    }
    console.log("✅ PASS: type=pharmacy returns pharmacies exclusively.");

    console.log("\n=======================================================");
    console.log("🎉 ALL API ROUTE ENDPOINT TESTS PASSED COMPLETELY!");
    console.log("=======================================================");
    server.close();
    process.exit(0);
  } catch (err) {
    server.close();
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runApiNearbyFilterTests();

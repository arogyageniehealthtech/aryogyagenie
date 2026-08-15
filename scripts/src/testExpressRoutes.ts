import { pool } from "@workspace/db";
import app from "../../artifacts/api-server/src/app";

async function testRoutes() {
  console.log("Testing Express routes directly...");
  
  // Test 1: GET /doctors
  const req1 = {
    method: "GET",
    url: "/api/doctors",
    query: {},
  };
  
  const server = app.listen(4567, async () => {
    try {
      console.log("Server listening on 4567");
      
      const res1 = await fetch("http://localhost:4567/api/doctors");
      const json1 = await res1.json();
      console.log("=== /api/doctors response ===");
      console.log("Status:", res1.status);
      console.log("Result count:", Array.isArray(json1) ? json1.length : 0);
      console.log("Data:", json1);

      const res2 = await fetch("http://localhost:4567/api/nearby?lat=22.6057&lng=88.4030&radius=18&type=all");
      const json2 = (await res2.json()) as any;
      console.log("\n=== /api/nearby response (Lake Town) ===");
      console.log("Status:", res2.status);
      console.log("Result count:", json2.count);
      console.log("Results:", json2.results);

      const res3 = await fetch("http://localhost:4567/api/nearby?lat=22.5726&lng=88.3639&radius=10&type=doctor");
      const json3 = (await res3.json()) as any;
      console.log("\n=== /api/nearby response (Park Street / Central Kolkata) ===");
      console.log("Status:", res3.status);
      console.log("Result count:", json3.count);
      console.log("Results:", json3.results);

    } catch (e: any) {
      console.error("Fetch error:", e.message);
    } finally {
      server.close();
      await pool.end();
    }
  });
}

testRoutes().catch(console.error);

import { seedCoordinates } from "../../artifacts/api-server/src/seed";
import { pool } from "@workspace/db";

async function run() {
  try {
    await seedCoordinates();
    console.log("🌟 Seeding run completed successfully!");
  } catch (err: any) {
    console.error("Seeding error:", err);
  } finally {
    await pool.end();
  }
}

run();

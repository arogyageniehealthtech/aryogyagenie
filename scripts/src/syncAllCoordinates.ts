import { pool } from "@workspace/db";
import { syncAllProviderCoordinates } from "../../artifacts/api-server/src/lib/locationService";

async function main() {
  console.log("Starting full database coordinate auto-resolution & backfill...");
  const result = await syncAllProviderCoordinates();
  console.log("Synchronization result:", result);

  console.log("\n--- Current Users in Database ---");
  const users = await pool.query(`
    SELECT id, email, role, status, first_name, last_name, address, city, state, latitude, longitude
    FROM users
    ORDER BY id ASC
  `);
  console.table(users.rows);

  console.log("\n--- Current Doctors in Database ---");
  const docs = await pool.query(`
    SELECT id, user_id, specialty, clinic_address, latitude, longitude, status
    FROM doctors
    ORDER BY id ASC
  `);
  console.table(docs.rows);

  await pool.end();
}

main().catch(console.error);

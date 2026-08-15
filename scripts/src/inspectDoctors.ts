import { pool } from "@workspace/db";

async function inspect() {
  try {
    const docs = await pool.query(`
      SELECT d.id, d.user_id, d.specialty, d.status, d.latitude, d.longitude, d.clinic_address,
             u.first_name, u.last_name, u.role, u.status as user_status
      FROM doctors d
      LEFT JOIN users u ON d.user_id = u.id
    `);
    console.log("=== ALL DOCTORS IN DB ===");
    console.log(JSON.stringify(docs.rows, null, 2));

    const apps = await pool.query(`
      SELECT id, user_id, type, status, specialty, address, city, latitude, longitude, first_name, last_name, email
      FROM provider_applications
    `);
    console.log("\n=== ALL PROVIDER APPLICATIONS IN DB ===");
    console.log(JSON.stringify(apps.rows, null, 2));
  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await pool.end();
  }
}

inspect();

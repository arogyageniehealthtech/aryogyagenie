import { pool } from "@workspace/db";

async function purgeOtherUsers() {
  console.log("==================================================");
  console.log("🧹 PURGING ALL USERS EXCEPT ADMIN AND RAJARSHI DAS");
  console.log("==================================================\n");

  const ADMIN_EMAIL = "arogyageniehealthtech.tech@gmail.com";
  const PATIENT_EMAIL = "rajarshidas729@gmail.com";

  try {
    // 1. Ensure Admin User exists and is active
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [ADMIN_EMAIL]
    );
    if (adminCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (clerk_id, email, first_name, last_name, role, status, created_at, updated_at)
         VALUES ($1, $2, 'Admin', 'ArogyaGenie', 'admin', 'active', NOW(), NOW())`,
        [`admin_clerk_${Date.now()}`, ADMIN_EMAIL]
      );
      console.log(`✅ Created Admin user: ${ADMIN_EMAIL}`);
    } else {
      await pool.query(
        `UPDATE users SET role = 'admin', status = 'active' WHERE LOWER(email) = LOWER($1)`,
        [ADMIN_EMAIL]
      );
      console.log(`✅ Verified Admin user: ${ADMIN_EMAIL}`);
    }

    // 2. Ensure Patient User exists and is active
    const patientCheck = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [PATIENT_EMAIL]
    );
    if (patientCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (clerk_id, email, first_name, last_name, role, status, address, city, state, blood_group, created_at, updated_at)
         VALUES ($1, $2, 'Rajarshi', 'Das', 'patient', 'active', 'Lake Town, South Dumdum', 'Kolkata', 'West Bengal', 'O+', NOW(), NOW())`,
        [`patient_rajarshi_${Date.now()}`, PATIENT_EMAIL]
      );
      console.log(`✅ Created Patient user: ${PATIENT_EMAIL}`);
    } else {
      await pool.query(
        `UPDATE users SET role = 'patient', status = 'active', first_name = COALESCE(NULLIF(first_name, ''), 'Rajarshi'), last_name = COALESCE(NULLIF(last_name, ''), 'Das') WHERE LOWER(email) = LOWER($1)`,
        [PATIENT_EMAIL]
      );
      console.log(`✅ Verified Patient user: ${PATIENT_EMAIL}`);
    }

    // Get the IDs of the only 2 kept users
    const keptUsersRes = await pool.query(
      "SELECT id, email FROM users WHERE LOWER(email) IN (LOWER($1), LOWER($2))",
      [ADMIN_EMAIL, PATIENT_EMAIL]
    );
    const keptUserIds = keptUsersRes.rows.map((r) => r.id);
    console.log("Kept User IDs:", keptUserIds, keptUsersRes.rows.map((r) => r.email));

    // 3. Delete dependent rows for other users first to avoid foreign key issues
    await pool.query("DELETE FROM pharmacy_inventory WHERE pharmacy_id NOT IN (SELECT id FROM pharmacies WHERE user_id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM lab_reports WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM prescriptions WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM appointments WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM diagnostic_bookings WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM medicine_reminders WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM timeline_events WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM health_episodes WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM symptom_assessments WHERE patient_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);

    await pool.query("DELETE FROM doctors WHERE user_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM diagnostic_centers WHERE user_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM pharmacies WHERE user_id NOT IN (SELECT id FROM users WHERE id = ANY($1))", [keptUserIds]);
    await pool.query("DELETE FROM provider_applications WHERE LOWER(email) NOT IN (LOWER($1), LOWER($2))", [ADMIN_EMAIL, PATIENT_EMAIL]);

    // 4. Delete all other users from users table
    const deleteRes = await pool.query(
      "DELETE FROM users WHERE id NOT IN (SELECT id FROM users WHERE id = ANY($1))",
      [keptUserIds]
    );
    console.log(`🗑️ Deleted ${deleteRes.rowCount} other user account(s).`);

    // 5. Verify final users count
    const finalUsersRes = await pool.query("SELECT id, email, role, first_name, last_name, status FROM users ORDER BY id ASC");
    console.log("\n📋 Final Users in Database:");
    console.table(finalUsersRes.rows);

    if (finalUsersRes.rows.length === 2) {
      console.log("\n🎉 SUCCESS: Exactly 2 users remain in the database!");
    } else {
      console.warn(`\n⚠️ Warning: Found ${finalUsersRes.rows.length} users in the database.`);
    }
  } catch (error) {
    console.error("❌ Error during purge:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

purgeOtherUsers();

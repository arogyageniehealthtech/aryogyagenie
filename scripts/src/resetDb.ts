import {
  db,
  usersTable,
  doctorsTable,
  diagnosticCentersTable,
  pharmaciesTable,
  appointmentsTable,
  prescriptionsTable,
  diagnosticBookingsTable,
  labReportsTable,
  medicineRemindersTable,
  timelineEventsTable,
  healthEpisodesTable,
  symptomAssessmentsTable,
} from "@workspace/db";
import path from "node:path";
import fs from "node:fs";

async function resetDb() {
  console.log("🧹 Wiping database to start completely fresh...");

  if (!process.env.DATABASE_URL) {
    try {
      let dir = process.cwd();
      while (dir) {
        const envPath = path.join(dir, ".env");
        if (fs.existsSync(envPath)) {
          process.loadEnvFile?.(envPath);
          break;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      // .env is optional
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ Error: DATABASE_URL is not set.");
    process.exit(1);
  }

  try {
    // Delete in reverse foreign-key order
    await db.delete(timelineEventsTable);
    await db.delete(medicineRemindersTable);
    await db.delete(labReportsTable);
    await db.delete(diagnosticBookingsTable);
    await db.delete(prescriptionsTable);
    await db.delete(appointmentsTable);
    await db.delete(pharmaciesTable);
    await db.delete(diagnosticCentersTable);
    await db.delete(doctorsTable);
    await db.delete(healthEpisodesTable);
    await db.delete(symptomAssessmentsTable);
    await db.delete(usersTable);

    console.log("✅ All existing users, appointments, doctors, pharmacies, and reports deleted.");

    // Create fresh pre-provisioned Admin record
    await db.insert(usersTable).values({
      clerkId: "pending_admin_arogyageniehealthtech",
      email: "arogyageniehealthtech.tech@gmail.com",
      firstName: "System",
      lastName: "Admin",
      role: "admin",
      status: "active",
    });

    console.log("👑 Fresh System Admin pre-provisioned (arogyageniehealthtech.tech@gmail.com).");
    console.log("🎉 Database reset complete! You have a 100% fresh environment.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
}

resetDb();

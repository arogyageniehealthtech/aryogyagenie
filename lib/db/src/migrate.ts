import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import path from "node:path";

/**
 * Migration runner script for production deployments.
 * Applies all pending SQL migrations from lib/db/drizzle directory in chronological order.
 */
export async function runMigrations() {
  console.log("=================================================");
  console.log("STARTING CONTROLLED DATABASE MIGRATION");
  console.log("=================================================");

  const migrationsFolder = path.resolve(import.meta.dirname, "../drizzle");
  console.log(`Applying SQL migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("✓ All pending migrations applied successfully.");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.includes("migrate")) {
  runMigrations();
}

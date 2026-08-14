import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import path from "node:path";

/**
 * Migration runner script for production deployments.
 * Applies all pending SQL migrations from lib/db/drizzle directory in chronological order.
 */
import fs from "node:fs";

export async function runMigrations(closePool = true) {
  console.log("=================================================");
  console.log("STARTING CONTROLLED DATABASE MIGRATION");
  console.log("=================================================");

  let migrationsFolder = path.resolve(import.meta.dirname, "../drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    migrationsFolder = path.resolve(process.cwd(), "lib/db/drizzle");
  }
  console.log(`Applying SQL migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("✓ All pending migrations applied successfully.");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    if (closePool) process.exit(1);
    throw err;
  } finally {
    if (closePool) {
      await pool.end();
    }
  }
}

if (process.argv[1]?.includes("migrate")) {
  runMigrations();
}

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import path from "node:path";

/**
 * Migration runner script for production deployments.
 * Applies all pending SQL migrations from lib/db/drizzle directory in chronological order.
 */
import fs from "node:fs";

function findMigrationsFolder(): string {
  let current = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate1 = path.join(current, "lib/db/drizzle");
    if (fs.existsSync(path.join(candidate1, "meta/_journal.json"))) {
      return candidate1;
    }
    const candidate2 = path.join(current, "drizzle");
    if (fs.existsSync(path.join(candidate2, "meta/_journal.json"))) {
      return candidate2;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(import.meta.dirname, "../drizzle");
}

export async function runMigrations(closePool = true) {
  console.log("=================================================");
  console.log("STARTING CONTROLLED DATABASE MIGRATION");
  console.log("=================================================");

  const migrationsFolder = findMigrationsFolder();
  console.log(`Applying SQL migrations from: ${migrationsFolder}`);

  try {
    // Ensure required extensions are active prior to migration execution
    await pool.query("CREATE EXTENSION IF NOT EXISTS postgis;");
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");

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

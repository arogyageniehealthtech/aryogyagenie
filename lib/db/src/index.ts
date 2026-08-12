import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

import fs from "node:fs";
import path from "node:path";

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
    // .env file is optional if env vars are passed directly
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isRemoteDb = Boolean(
  process.env.DATABASE_URL?.includes("render.com") ||
  process.env.DATABASE_URL?.includes("sslmode=") ||
  process.env.NODE_ENV === "production"
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

/// <reference types="node" />
import { defineConfig } from "drizzle-kit";
import path from "node:path";
import fs from "node:fs";

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
    // .env file is optional
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Ensure .env is provisioned with DATABASE_URL.");
}

const isRemoteDb = Boolean(
  process.env.DATABASE_URL?.includes("render.com") ||
  process.env.DATABASE_URL?.includes("sslmode=") ||
  process.env.NODE_ENV === "production"
);

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: isRemoteDb ? "require" : undefined,
  },
});

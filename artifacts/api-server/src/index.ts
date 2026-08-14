import fs from "node:fs";
import path from "node:path";

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

import app from "./app";
import { logger } from "./lib/logger";
import { pool, runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"] || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

import { seedCoordinates } from "./seed";

// Auto-apply database migrations on server startup to provision fresh PostgreSQL DB instances
try {
  await runMigrations(false);
  await seedCoordinates();
} catch (err) {
  logger.warn({ err }, "Startup database migration check warning");
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

  // Stop accepting new connections
  server.close(() => {
    logger.info("HTTP server closed");

    // Drain database pool
    pool.end()
      .then(() => {
        logger.info("Database pool drained");
        process.exit(0);
      })
      .catch((err) => {
        logger.error({ err }, "Error draining database pool");
        process.exit(1);
      });
  });

  // Force exit after 15 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.error("Graceful shutdown timed out after 15s, forcing exit");
    process.exit(1);
  }, 15_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

import {
  db,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting ArogyaGenie Initialization System...");

  if (!process.env.DATABASE_URL) {
    try {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const rootEnv = path.resolve(process.cwd(), "../../.env");
      const localEnv = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(rootEnv)) {
        process.loadEnvFile?.(rootEnv);
      } else if (fs.existsSync(localEnv)) {
        process.loadEnvFile?.(localEnv);
      } else {
        process.loadEnvFile?.();
      }
    } catch {
      // .env is optional
    }
  }

  if (!process.env.DATABASE_URL) {
    console.log("⚠️ DATABASE_URL environment variable is not set. Seed script operates when a PostgreSQL database is active.");
    return;
  }

  try {
    const ADMIN_EMAIL = "arogyageniehealthtech.tech@gmail.com";
    const PATIENT_EMAIL = "rajarshidas729@gmail.com";

    // 1. Ensure Admin User
    const existingAdmin = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, ADMIN_EMAIL),
    });
    if (!existingAdmin) {
      await db.insert(usersTable).values({
        clerkId: "clerk_admin_main",
        email: ADMIN_EMAIL,
        firstName: "Admin",
        lastName: "ArogyaGenie",
        role: "admin",
        status: "active",
      });
      console.log(`✅ Admin account created: ${ADMIN_EMAIL}`);
    } else {
      await db.update(usersTable).set({ role: "admin", status: "active" }).where(eq(usersTable.id, existingAdmin.id));
      console.log(`✅ Admin account ensured: ${ADMIN_EMAIL}`);
    }

    // 2. Ensure Patient User
    const existingPatient = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, PATIENT_EMAIL),
    });
    if (!existingPatient) {
      await db.insert(usersTable).values({
        clerkId: "clerk_patient_main",
        email: PATIENT_EMAIL,
        firstName: "Rajarshi",
        lastName: "Das",
        role: "patient",
        status: "active",
        address: "Lake Town, South Dumdum",
        city: "Kolkata",
        state: "West Bengal",
      });
      console.log(`✅ Patient account created: ${PATIENT_EMAIL}`);
    } else {
      await db.update(usersTable).set({ role: "patient", status: "active" }).where(eq(usersTable.id, existingPatient.id));
      console.log(`✅ Patient account ensured: ${PATIENT_EMAIL}`);
    }

    console.log("🎉 ArogyaGenie 2-User Configuration Complete!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();

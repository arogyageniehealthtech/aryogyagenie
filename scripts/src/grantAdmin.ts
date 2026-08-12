import { db, usersTable, doctorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";

async function grantAdmin() {
  const targetEmail = "arogyageniehealthtech.tech@gmail.com";

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

  console.log(`🔍 Granting Admin access for: ${targetEmail}`);

  // Find existing user by email
  const existingUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, targetEmail),
  });

  if (existingUser) {
    // Delete any linked doctor profile if present
    await db.delete(doctorsTable).where(eq(doctorsTable.userId, existingUser.id));

    // Promote user to admin
    await db
      .update(usersTable)
      .set({
        role: "admin",
        status: "active",
        firstName: existingUser.firstName || "System",
        lastName: existingUser.lastName || "Admin",
      })
      .where(eq(usersTable.id, existingUser.id));

    console.log(`✅ Promoted existing user #${existingUser.id} (${targetEmail}) to ADMIN role and set status to ACTIVE.`);
    console.log(`✅ Cleaned up any doctor profile associated with this user.`);
  } else {
    // Pre-provision Admin record
    await db.insert(usersTable).values({
      clerkId: "pending_admin_arogyageniehealthtech",
      email: targetEmail,
      firstName: "System",
      lastName: "Admin",
      role: "admin",
      status: "active",
    });

    console.log(`✅ Pre-provisioned user (${targetEmail}) as ADMIN role.`);
  }

  console.log("🎉 Admin access successfully granted!");
  process.exit(0);
}

grantAdmin().catch((err) => {
  console.error("❌ Failed to grant admin access:", err);
  process.exit(1);
});

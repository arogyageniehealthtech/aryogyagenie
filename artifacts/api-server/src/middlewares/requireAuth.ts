import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, doctorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface AuthenticatedRequest extends Request {
  userId?: number;
  clerkId?: string;
  userRole?: string;
  userStatus?: string;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;

  if (!clerkId) {
    logger.warn(
      {
        path: req.path,
        method: req.method,
        hasAuthHeader: Boolean(req.headers.authorization),
        authReason: (auth as any)?.authReason,
      },
      "Unauthorized API request"
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.clerkId = clerkId;

  // JIT provision the user if needed
  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkId),
  });

  if (!user) {
    // Create user on first access
    let email = (auth.sessionClaims?.email || auth.sessionClaims?.email_address) as string;

    if (!email) {
      try {
        const { clerkClient } = await import("@clerk/express");
        const clerkUser = await clerkClient.users.getUser(clerkId);
        email = clerkUser.emailAddresses[0]?.emailAddress || `${clerkId}@clerk.user`;
      } catch {
        email = `${clerkId}@clerk.user`;
      }
    }

    // Check if user pre-exists by email (e.g. pre-provisioned Admin or Provider Application)
    const existingByEmail = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });

    if (existingByEmail) {
      const [updated] = await db
        .update(usersTable)
        .set({ clerkId })
        .where(eq(usersTable.id, existingByEmail.id))
        .returning();
      user = updated;
    } else {
      const [newUser] = await db
        .insert(usersTable)
        .values({ clerkId, email, status: "pending" })
        .onConflictDoNothing()
        .returning();

      user = newUser || (await db.query.usersTable.findFirst({
        where: eq(usersTable.clerkId, clerkId),
      }));
    }
  }

  if (!user) {
    logger.error({ clerkId }, "Failed to find or initialize user record");
    res.status(500).json({ error: "Failed to initialize user account" });
    return;
  }

  // Auto-promote system admin email and remove doctor profile if present
  const ADMIN_EMAIL = "arogyageniehealthtech.tech@gmail.com";
  const sessionEmail = (auth.sessionClaims?.email || auth.sessionClaims?.email_address) as string | undefined;
  const isTargetAdmin =
    user.email?.toLowerCase() === ADMIN_EMAIL ||
    sessionEmail?.toLowerCase() === ADMIN_EMAIL;

  if (user && isTargetAdmin) {
    if (user.role !== "admin" || !user.email) {
      try {
        await db.delete(doctorsTable).where(eq(doctorsTable.userId, user.id));
        const [promoted] = await db
          .update(usersTable)
          .set({ role: "admin", status: "active", email: ADMIN_EMAIL })
          .where(eq(usersTable.id, user.id))
          .returning();
        if (promoted) user = promoted;
      } catch (err) {
        logger.warn({ err }, "Could not auto-promote admin email");
      }
    }
  }

  req.userId = user.id;
  req.userRole = user.role ?? undefined;
  req.userStatus = user.status;
  next();
};

export const requireRole = (roles: string[]) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const providerRoles = ["doctor", "diagnostic_center", "pharmacy"];
    const containsProviderRole = roles.some((r) => providerRoles.includes(r));

    if (containsProviderRole && providerRoles.includes(req.userRole)) {
      if (req.userStatus !== "active") {
        res.status(403).json({
          error:
            req.userStatus === "rejected"
              ? "Application rejected. Access to provider portal is denied."
              : "Application pending approval. Access to provider portal will be provided after approval.",
        });
        return;
      }
    }

    next();
  };


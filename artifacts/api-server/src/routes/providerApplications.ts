import { Router, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  doctorsTable,
  diagnosticCentersTable,
  pharmaciesTable,
  providerApplicationsTable,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";

const router = Router();

// Helper to extract clerkId / email if user is authenticated optionally
async function resolveUserFromReq(req: Request) {
  try {
    const auth = getAuth(req);
    const clerkId = auth?.userId;
    if (!clerkId) return null;

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    });
    return user || null;
  } catch {
    return null;
  }
}

// POST /provider-applications (Public & Authenticated)
router.post("/provider-applications", async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, firstName, lastName, name, phone, email, specialty, address, city, latitude, longitude } = req.body;
    const lat = latitude != null ? parseFloat(latitude) : null;
    const lng = longitude != null ? parseFloat(longitude) : null;

    if (!type || !["DOCTOR", "DIAGNOSTIC_CENTER", "PHARMACY"].includes(type)) {
      res.status(400).json({ error: "Valid type (DOCTOR, DIAGNOSTIC_CENTER, PHARMACY) is required." });
      return;
    }

    if (!email || !phone) {
      res.status(400).json({ error: "Email and phone are required." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (type === "DOCTOR") {
      if (!firstName || !lastName || !specialty) {
        res.status(400).json({ error: "First Name, Last Name, and Specialty are required for Doctor registration." });
        return;
      }
    } else if (type === "DIAGNOSTIC_CENTER" || type === "PHARMACY") {
      if (!name || !address) {
        res.status(400).json({
          error: `${type === "DIAGNOSTIC_CENTER" ? "Center Name" : "Pharmacy Name"} and Address are required.`,
        });
        return;
      }
    }

    const roleMap: Record<string, "doctor" | "diagnostic_center" | "pharmacy"> = {
      DOCTOR: "doctor",
      DIAGNOSTIC_CENTER: "diagnostic_center",
      PHARMACY: "pharmacy",
    };
    const targetRole = roleMap[type];

    // Check if user exists or JIT create user record
    let currentUser = await resolveUserFromReq(req);
    if (!currentUser) {
      currentUser = (await db.query.usersTable.findFirst({
        where: eq(usersTable.email, cleanEmail),
      })) || null;
    }

    if (!currentUser) {
      const placeholderClerkId = `pending_provider_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const [newUser] = await db
        .insert(usersTable)
        .values({
          clerkId: placeholderClerkId,
          email: cleanEmail,
          firstName: firstName || name || "Provider",
          lastName: lastName || "",
          phone: cleanPhone,
          address: address || null,
          city: city || null,
          role: targetRole,
          status: "pending",
        })
        .returning();
      currentUser = newUser;
    } else {
      // Update user role & status to pending
      const [updatedUser] = await db
        .update(usersTable)
        .set({
          role: targetRole,
          status: currentUser.status === "active" && currentUser.role === targetRole ? "active" : "pending",
          firstName: firstName || currentUser.firstName || name || "Provider",
          lastName: lastName !== undefined ? lastName : currentUser.lastName,
          phone: cleanPhone || currentUser.phone,
          address: address || currentUser.address,
          city: city || currentUser.city,
        })
        .where(eq(usersTable.id, currentUser.id))
        .returning();
      currentUser = updatedUser;
    }

    // Check existing provider application by email
    const existingApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, cleanEmail),
    });

    let application;
    if (existingApp) {
      const [updatedApp] = await db
        .update(providerApplicationsTable)
        .set({
          type,
          status: existingApp.status === "APPROVED" ? "APPROVED" : "PENDING",
          userId: currentUser.id,
          firstName: firstName || null,
          lastName: lastName || null,
          name: name || null,
          email: cleanEmail,
          phone: cleanPhone,
          specialty: specialty || null,
          address: address || null,
          city: city || null,
        })
        .where(eq(providerApplicationsTable.id, existingApp.id))
        .returning();
      application = updatedApp;
    } else {
      const [newApp] = await db
        .insert(providerApplicationsTable)
        .values({
          type,
          status: "PENDING",
          userId: currentUser.id,
          firstName: firstName || null,
          lastName: lastName || null,
          name: name || null,
          email: cleanEmail,
          phone: cleanPhone,
          specialty: specialty || null,
          address: address || null,
          city: city || null,
          latitude: lat,
          longitude: lng,
        })
        .returning();
      application = newApp;
    }

    // Create or update role-specific domain record
    const providerStatus = application.status === "APPROVED" ? "active" : "pending";

    if (type === "DOCTOR") {
      const existingDoc = await db.query.doctorsTable.findFirst({
        where: eq(doctorsTable.userId, currentUser.id),
      });
      if (existingDoc) {
        await db
          .update(doctorsTable)
          .set({ specialty: specialty!, status: providerStatus, latitude: lat, longitude: lng })
          .where(eq(doctorsTable.id, existingDoc.id));
      } else {
        await db.insert(doctorsTable).values({
          userId: currentUser.id,
          specialty: specialty!,
          status: providerStatus,
          latitude: lat,
          longitude: lng,
        });
      }
    } else if (type === "DIAGNOSTIC_CENTER") {
      const existingCenter = await db.query.diagnosticCentersTable.findFirst({
        where: eq(diagnosticCentersTable.userId, currentUser.id),
      });
      if (existingCenter) {
        await db
          .update(diagnosticCentersTable)
          .set({ name: name!, phone: cleanPhone, address: address!, city: city || null, status: providerStatus })
          .where(eq(diagnosticCentersTable.id, existingCenter.id));
      } else {
        await db.insert(diagnosticCentersTable).values({
          userId: currentUser.id,
          name: name!,
          phone: cleanPhone,
          address: address!,
          city: city || null,
          latitude: lat,
          longitude: lng,
          status: providerStatus,
        });
      }
    } else if (type === "PHARMACY") {
      const existingPharm = await db.query.pharmaciesTable.findFirst({
        where: eq(pharmaciesTable.userId, currentUser.id),
      });
      if (existingPharm) {
        await db
          .update(pharmaciesTable)
          .set({ name: name!, phone: cleanPhone, address: address!, city: city || null, status: providerStatus })
          .where(eq(pharmaciesTable.id, existingPharm.id));
      } else {
        await db.insert(pharmaciesTable).values({
          userId: currentUser.id,
          name: name!,
          phone: cleanPhone,
          address: address!,
          city: city || null,
          latitude: lat,
          longitude: lng,
          status: providerStatus,
        });
      }
    }

    res.status(201).json({
      message:
        "Application submitted successfully. Our team will review your details and contact you shortly. Portal access will be provided after approval.",
      application,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to submit provider application" });
  }
});

// GET /provider-applications/me (Authenticated)
router.get("/provider-applications/me", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.userId!),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const application = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.userId, user.id),
    }) || await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, user.email),
    });

    res.json({
      user,
      application: application || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve provider application status" });
  }
});

import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

// GET /admin/provider-applications (Admin Only)
router.get(
  "/admin/provider-applications",
  requireAuth,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.query as { status?: string };
      const pagination = parsePaginationParams(req);

      const whereClause = status ? eq(providerApplicationsTable.status, status.toUpperCase() as any) : undefined;

      const [totalCountResult] = await db
        .select({ count: db.$count(providerApplicationsTable, whereClause) })
        .from(providerApplicationsTable);
      const total = totalCountResult?.count ?? 0;

      setPaginationHeaders(res, total, pagination);

      const paginatedApps = await db
        .select()
        .from(providerApplicationsTable)
        .where(whereClause)
        .orderBy(desc(providerApplicationsTable.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset);

      res.json(
        paginatedApps.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
        })),
      );
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch provider applications" });
    }
  },
);

// POST /admin/provider-applications/:id/approve (Admin Only)
router.post(
  "/admin/provider-applications/:id/approve",
  requireAuth,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const appId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
      if (isNaN(appId)) {
        res.status(400).json({ error: "Invalid application id" });
        return;
      }

      const application = await db.query.providerApplicationsTable.findFirst({
        where: eq(providerApplicationsTable.id, appId),
      });

      if (!application) {
        res.status(404).json({ error: "Provider application not found" });
        return;
      }

      // Update application
      const [approvedApp] = await db
        .update(providerApplicationsTable)
        .set({
          status: "APPROVED",
          reviewedBy: req.userId!,
          reviewedAt: new Date(),
        })
        .where(eq(providerApplicationsTable.id, appId))
        .returning();

      const roleMap: Record<string, "doctor" | "diagnostic_center" | "pharmacy"> = {
        DOCTOR: "doctor",
        DIAGNOSTIC_CENTER: "diagnostic_center",
        PHARMACY: "pharmacy",
      };
      const targetRole = roleMap[application.type];

      // Update linked user
      let linkedUser;
      if (application.userId) {
        const [u] = await db
          .update(usersTable)
          .set({ status: "active", role: targetRole })
          .where(eq(usersTable.id, application.userId))
          .returning();
        linkedUser = u;
      } else {
        const [u] = await db
          .update(usersTable)
          .set({ status: "active", role: targetRole })
          .where(eq(usersTable.email, application.email))
          .returning();
        linkedUser = u;
      }

      const userIdToSync = linkedUser?.id || application.userId;

      if (userIdToSync) {
        if (application.type === "DOCTOR") {
          const doc = await db.query.doctorsTable.findFirst({
            where: eq(doctorsTable.userId, userIdToSync),
          });
          if (doc) {
            await db
              .update(doctorsTable)
              .set({
                status: "active",
                specialty: application.specialty || doc.specialty || "General Physician",
                clinicAddress: doc.clinicAddress || application.address,
                latitude: doc.latitude || application.latitude,
                longitude: doc.longitude || application.longitude,
              })
              .where(eq(doctorsTable.userId, userIdToSync));
          } else {
            await db.insert(doctorsTable).values({
              userId: userIdToSync,
              specialty: application.specialty || "General Physician",
              clinicAddress: application.address,
              status: "active",
              latitude: application.latitude,
              longitude: application.longitude,
            });
          }
        } else if (application.type === "DIAGNOSTIC_CENTER") {
          const center = await db.query.diagnosticCentersTable.findFirst({
            where: eq(diagnosticCentersTable.userId, userIdToSync),
          });
          if (center) {
            await db
              .update(diagnosticCentersTable)
              .set({
                status: "active",
                address: center.address || application.address || "Main Address",
                city: center.city || application.city,
                latitude: center.latitude || application.latitude,
                longitude: center.longitude || application.longitude,
              })
              .where(eq(diagnosticCentersTable.userId, userIdToSync));
          } else {
            await db.insert(diagnosticCentersTable).values({
              userId: userIdToSync,
              name: application.name || application.firstName || "Diagnostic Center",
              address: application.address || "Main Address",
              phone: application.phone,
              city: application.city || undefined,
              latitude: application.latitude,
              longitude: application.longitude,
              status: "active",
            });
          }
        } else if (application.type === "PHARMACY") {
          const pharm = await db.query.pharmaciesTable.findFirst({
            where: eq(pharmaciesTable.userId, userIdToSync),
          });
          if (pharm) {
            await db
              .update(pharmaciesTable)
              .set({
                status: "active",
                address: pharm.address || application.address || "Main Address",
                city: pharm.city || application.city,
                latitude: pharm.latitude || application.latitude,
                longitude: pharm.longitude || application.longitude,
              })
              .where(eq(pharmaciesTable.userId, userIdToSync));
          } else {
            await db.insert(pharmaciesTable).values({
              userId: userIdToSync,
              name: application.name || application.firstName || "Pharmacy",
              address: application.address || "Main Address",
              phone: application.phone,
              city: application.city || undefined,
              latitude: application.latitude,
              longitude: application.longitude,
              status: "active",
            });
          }
        }
      }

      res.json({
        message: "Provider application approved successfully.",
        application: approvedApp,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to approve provider application" });
    }
  },
);

// POST /admin/provider-applications/:id/reject (Admin Only)
router.post(
  "/admin/provider-applications/:id/reject",
  requireAuth,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const appId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
      if (isNaN(appId)) {
        res.status(400).json({ error: "Invalid application id" });
        return;
      }

      const { rejectionReason } = req.body;

      const application = await db.query.providerApplicationsTable.findFirst({
        where: eq(providerApplicationsTable.id, appId),
      });

      if (!application) {
        res.status(404).json({ error: "Provider application not found" });
        return;
      }

      const [rejectedApp] = await db
        .update(providerApplicationsTable)
        .set({
          status: "REJECTED",
          rejectionReason: rejectionReason || "Application details could not be verified.",
          reviewedBy: req.userId!,
          reviewedAt: new Date(),
        })
        .where(eq(providerApplicationsTable.id, appId))
        .returning();

      // Update linked user
      let linkedUser;
      if (application.userId) {
        const [u] = await db
          .update(usersTable)
          .set({ status: "rejected" })
          .where(eq(usersTable.id, application.userId))
          .returning();
        linkedUser = u;
      } else {
        const [u] = await db
          .update(usersTable)
          .set({ status: "rejected" })
          .where(eq(usersTable.email, application.email))
          .returning();
        linkedUser = u;
      }

      const userIdToSync = linkedUser?.id || application.userId;

      if (userIdToSync) {
        if (application.type === "DOCTOR") {
          await db
            .update(doctorsTable)
            .set({ status: "rejected" })
            .where(eq(doctorsTable.userId, userIdToSync));
        } else if (application.type === "DIAGNOSTIC_CENTER") {
          await db
            .update(diagnosticCentersTable)
            .set({ status: "rejected" })
            .where(eq(diagnosticCentersTable.userId, userIdToSync));
        } else if (application.type === "PHARMACY") {
          await db
            .update(pharmaciesTable)
            .set({ status: "rejected" })
            .where(eq(pharmaciesTable.userId, userIdToSync));
        }
      }

      res.json({
        message: "Provider application rejected.",
        application: rejectedApp,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to reject provider application" });
    }
  },
);

export default router;

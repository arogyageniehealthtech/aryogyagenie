import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, doctorsTable, diagnosticCentersTable, pharmaciesTable, providerApplicationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

// GET /users/me
router.get("/users/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.userId!),
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userName = `${user.firstName ?? ""}`.trim() + (user.lastName ? ` ${user.lastName}` : "") || user.email;

  let entityName = userName;
  if (user.role === "diagnostic_center") {
    const dc = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, user.id) });
    if (dc?.name) entityName = dc.name;
  } else if (user.role === "pharmacy") {
    const ph = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, user.id) });
    if (ph?.name) entityName = ph.name;
  }

  let displayName = entityName;
  if (user.role === "patient" || user.role === "doctor") {
    const fn = user.firstName?.trim() || userName.split(" ")[0] || (user.role === "doctor" ? "Doctor" : "Patient");
    displayName = `Hello ${fn}`;
  }

  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    userName,
    name: entityName,
    displayName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    dateOfBirth: user.dateOfBirth,
    age: user.age,
    gender: user.gender,
    address: user.address,
    city: user.city,
    state: user.state,
    bloodGroup: user.bloodGroup,
    allergies: user.allergies,
    existingConditions: user.existingConditions,
    currentMedications: user.currentMedications,
    previousIllnesses: user.previousIllnesses,
    emergencyContact: user.emergencyContact,
    createdAt: user.createdAt.toISOString(),
  });
});

import { resolveProviderCoordinates } from "../lib/locationService";

// PUT /users/me
router.put("/users/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const {
    firstName, lastName, phone, dateOfBirth, age, gender,
    address, city, state, bloodGroup, allergies, existingConditions, currentMedications, previousIllnesses, emergencyContact, avatarUrl,
  } = req.body;

  const [user] = await db
    .update(usersTable)
    .set({ firstName, lastName, phone, dateOfBirth, age, gender, address, city, state, bloodGroup, allergies, existingConditions, currentMedications, previousIllnesses, emergencyContact, avatarUrl })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  // If user is a provider and address/city was updated, sync coordinates to provider tables
  if (address || city) {
    try {
      const coords = await resolveProviderCoordinates({ address, city, state });
      if (user.role === "doctor") {
        await db.update(doctorsTable).set({ clinicAddress: address, latitude: coords.lat, longitude: coords.lng }).where(eq(doctorsTable.userId, user.id));
      } else if (user.role === "diagnostic_center") {
        await db.update(diagnosticCentersTable).set({ address, city, latitude: coords.lat, longitude: coords.lng }).where(eq(diagnosticCentersTable.userId, user.id));
      } else if (user.role === "pharmacy") {
        await db.update(pharmaciesTable).set({ address, city, latitude: coords.lat, longitude: coords.lng }).where(eq(pharmaciesTable.userId, user.id));
      }
    } catch {
      // Non-fatal
    }
  }

  res.json({
    ...user,
    createdAt: user.createdAt.toISOString(),
  });
});

// POST /users/me/onboard
router.post("/users/me/onboard", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { role, firstName, lastName, phone, dateOfBirth, age, gender, specialty, centerName, pharmacyName, address } = req.body;

  if (!role) {
    res.status(400).json({ error: "role is required" });
    return;
  }

  const validRoles = ["patient", "doctor", "diagnostic_center", "pharmacy"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const ADMIN_EMAIL = "arogyageniehealthtech.tech@gmail.com";
  const effectiveRole =
    req.userRole === "admin" ||
    req.body.email?.toLowerCase() === ADMIN_EMAIL
      ? "admin"
      : role;

  const initialStatus = (effectiveRole === "patient" || effectiveRole === "admin") ? "active" : "pending";

  const existingUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.userId!),
  });

  const resolvedFirstName = firstName || centerName || pharmacyName || existingUser?.firstName || "Patient";

  const [user] = await db
    .update(usersTable)
    .set({
      role: effectiveRole,
      firstName: resolvedFirstName,
      lastName: lastName !== undefined ? lastName : (existingUser?.lastName || ""),
      phone: phone || existingUser?.phone || undefined,
      dateOfBirth: dateOfBirth || existingUser?.dateOfBirth || undefined,
      gender: gender || existingUser?.gender || undefined,
      address: address || existingUser?.address || undefined,
      status: initialStatus,
    })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  // Create role-specific profile & provider application if applicable
  if (role === "doctor") {
    const docSpecialty = specialty || "General Physician";
    const coords = await resolveProviderCoordinates({ address: address || user.address || "Lake Town, Kolkata", city: user.city || "Kolkata" });

    await db.insert(doctorsTable).values({
      userId: user.id,
      specialty: docSpecialty,
      clinicAddress: address || user.address || "Lake Town, Kolkata",
      latitude: coords.lat,
      longitude: coords.lng,
      status: initialStatus,
    }).onConflictDoNothing();

    const existingApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, user.email),
    });
    if (!existingApp) {
      await db.insert(providerApplicationsTable).values({
        type: "DOCTOR",
        status: "PENDING",
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || phone || "",
        specialty: docSpecialty,
        address: address || user.address || "Lake Town, Kolkata",
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }
  } else if (role === "diagnostic_center") {
    const cName = centerName || `${user.firstName} ${user.lastName || ""} Diagnostics`.trim();
    const coords = await resolveProviderCoordinates({ address: address || user.address || cName, city: user.city || "Kolkata" });

    await db.insert(diagnosticCentersTable).values({
      userId: user.id,
      name: cName,
      phone: user.phone || phone,
      address: address || user.address || "Main Address",
      latitude: coords.lat,
      longitude: coords.lng,
      status: initialStatus,
    }).onConflictDoNothing();

    const existingApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, user.email),
    });
    if (!existingApp) {
      await db.insert(providerApplicationsTable).values({
        type: "DIAGNOSTIC_CENTER",
        status: "PENDING",
        userId: user.id,
        name: cName,
        email: user.email,
        phone: user.phone || phone || "",
        address: address || user.address,
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }
  } else if (role === "pharmacy") {
    const pName = pharmacyName || `${user.firstName} ${user.lastName || ""} Pharmacy`.trim();
    const coords = await resolveProviderCoordinates({ address: address || user.address || pName, city: user.city || "Kolkata" });

    await db.insert(pharmaciesTable).values({
      userId: user.id,
      name: pName,
      phone: user.phone || phone,
      address: address || user.address || "Main Address",
      latitude: coords.lat,
      longitude: coords.lng,
      status: initialStatus,
    }).onConflictDoNothing();

    const existingApp = await db.query.providerApplicationsTable.findFirst({
      where: eq(providerApplicationsTable.email, user.email),
    });
    if (!existingApp) {
      await db.insert(providerApplicationsTable).values({
        type: "PHARMACY",
        status: "PENDING",
        userId: user.id,
        name: pName,
        email: user.email,
        phone: user.phone || phone || "",
        address: address || user.address,
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }
  }

  res.json({
    ...user,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;

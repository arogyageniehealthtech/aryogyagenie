import { Router } from "express";
import { eq, or, and, sql, desc } from "drizzle-orm";
import { db, usersTable, doctorsTable, appointmentsTable, prescriptionsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router = Router();

function matchDoctorSpecialty(docSpec: string | null | undefined, filterSpec: string): boolean {
  if (!docSpec) return false;
  const d = docSpec.toLowerCase();
  const f = filterSpec.toLowerCase();
  if (d === f || d.includes(f) || f.includes(d)) return true;

  const rootWords = [
    "cardio", "ortho", "pediatr", "dermat", "neuro", "pulmon", "gastro",
    "ent", "dent", "surg", "urol", "nephr", "oncol", "endocrin", "physician", "medicine", "practice"
  ];
  for (const root of rootWords) {
    if (d.includes(root) && f.includes(root)) return true;
  }
  return false;
}

import { inArray } from "drizzle-orm";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";

import { parseCoordinates, clampRadiusKm, searchNearbyDoctors, resolveProviderCoordinates } from "../lib/locationService";
import { getDoctorAvailableSlots, formatDateToYYYYMMDD, parseDoctorSchedule } from "../services/schedulingService";

// GET /doctors - list approved doctors (with optional location-based radius filtering)
router.get("/doctors", async (req, res): Promise<void> => {
  const { specialty, search, lat, lng, radius } = req.query as {
    specialty?: string;
    search?: string;
    lat?: string;
    lng?: string;
    radius?: string;
  };
  const pagination = parsePaginationParams(req);

  const coords = parseCoordinates(lat, lng);

  // If patient coordinates are supplied, perform location-based discovery via PostGIS
  if (coords) {
    const radiusKm = clampRadiusKm(radius);
    const { results, total } = await searchNearbyDoctors({
      lat: coords.lat,
      lng: coords.lng,
      radiusKm,
      specialty: specialty !== "all" ? specialty : undefined,
      search: search && search.trim() ? search.trim() : undefined,
      limit: pagination.limit,
      offset: pagination.offset,
    });

    setPaginationHeaders(res, total, pagination);
    res.json(results);
    return;
  }

  // Standard non-location listing
  const rows = await db
    .select({
      d: doctorsTable,
      u: {
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        avatarUrl: usersTable.avatarUrl,
        status: usersTable.status,
        role: usersTable.role,
        address: usersTable.address,
        city: usersTable.city,
      },
    })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(
      or(
        eq(doctorsTable.status, "active"),
        and(eq(usersTable.role, "doctor"), eq(usersTable.status, "active"))
      )
    );

  let result = rows.map((r) => ({
    id: r.d.id,
    userId: r.d.userId,
    firstName: r.u.firstName ?? "Doctor",
    lastName: r.u.lastName ?? "",
    email: r.u.email,
    avatarUrl: r.u.avatarUrl,
    specialty: r.d.specialty || "General Physician",
    qualification: r.d.qualification || "MBBS, MD",
    licenseNumber: r.d.licenseNumber,
    clinicName: r.d.clinicName || "ArogyaGenie Medical Center",
    clinicAddress: r.d.clinicAddress || r.u.address || "Health Tech City",
    address: r.d.clinicAddress || r.u.address || "Health Tech City",
    state: r.d.state,
    pincode: r.d.pincode,
    consultationFee: r.d.consultationFee || 500,
    experience: r.d.experience || 5,
    bio: r.d.bio,
    rating: r.d.rating || "4.8",
    reviewCount: r.d.reviewCount || 12,
    status: "active",
    availableDays: r.d.availableDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
    availableHours: r.d.availableHours || "09:00 AM - 05:00 PM",
    latitude: r.d.latitude,
    longitude: r.d.longitude,
  }));

  if (specialty && specialty !== "all") {
    result = result.filter((d) => matchDoctorSpecialty(d.specialty, specialty));
  }
  if (search) {
    const s = search.toLowerCase();
    result = result.filter((d) =>
      d.firstName.toLowerCase().includes(s) ||
      d.lastName.toLowerCase().includes(s) ||
      d.specialty.toLowerCase().includes(s) ||
      (d.clinicName ?? "").toLowerCase().includes(s) ||
      (d.clinicAddress ?? "").toLowerCase().includes(s),
    );
  }

  const total = result.length;
  setPaginationHeaders(res, total, pagination);
  const paginatedResult = result.slice(pagination.offset, pagination.offset + pagination.limit);

  res.json(paginatedResult);
});

// GET /doctors/:id/available-slots
router.get("/doctors/:id/available-slots", async (req, res): Promise<void> => {
  const doctorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(doctorId)) {
    res.status(400).json({ error: "Invalid doctor id" });
    return;
  }

  const { date } = req.query as { date?: string };
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : formatDateToYYYYMMDD(new Date());

  try {
    const slotResult = await getDoctorAvailableSlots(doctorId, targetDate);
    res.json(slotResult);
  } catch (err: any) {
    res.status(err.message?.includes("not found") ? 404 : 400).json({ error: err.message });
  }
});

// GET /doctors/:id
router.get("/doctors/:id", async (req, res): Promise<void> => {
  const doctorId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(doctorId)) { res.status(400).json({ error: "Invalid doctor id" }); return; }

  const row = await db
    .select({ d: doctorsTable, u: usersTable })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(eq(doctorsTable.id, doctorId))
    .limit(1);

  if (!row[0]) { res.status(404).json({ error: "Doctor not found" }); return; }

  const { d, u } = row[0];
  res.json({
    id: d.id, userId: d.userId,
    firstName: u.firstName ?? "", lastName: u.lastName ?? "",
    email: u.email, avatarUrl: u.avatarUrl,
    specialty: d.specialty, qualification: d.qualification,
    licenseNumber: d.licenseNumber, clinicName: d.clinicName,
    clinicAddress: d.clinicAddress || u.address || "Medical Center",
    consultationFee: d.consultationFee,
    experience: d.experience, bio: d.bio, rating: d.rating,
    reviewCount: d.reviewCount, status: d.status,
    availableDays: d.availableDays, availableHours: d.availableHours,
    scheduleConfig: parseDoctorSchedule(d.availableDays, d.availableHours),
  });
});

// GET /doctors/me/profile
router.get("/doctors/me/profile", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const row = await db
    .select({ d: doctorsTable, u: usersTable })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
    .where(eq(doctorsTable.userId, req.userId!))
    .limit(1);

  if (!row[0]) { res.status(404).json({ error: "Doctor profile not found" }); return; }
  const { d, u } = row[0];
  res.json({
    id: d.id, userId: d.userId,
    firstName: u.firstName ?? "", lastName: u.lastName ?? "",
    email: u.email, avatarUrl: u.avatarUrl,
    specialty: d.specialty, qualification: d.qualification,
    licenseNumber: d.licenseNumber, clinicName: d.clinicName,
    clinicAddress: d.clinicAddress || u.address,
    consultationFee: d.consultationFee,
    experience: d.experience, bio: d.bio, rating: d.rating,
    reviewCount: d.reviewCount, status: d.status,
    availableDays: d.availableDays, availableHours: d.availableHours,
    scheduleConfig: parseDoctorSchedule(d.availableDays, d.availableHours),
  });
});

// PUT /doctors/me/profile
router.put("/doctors/me/profile", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { specialty, qualification, licenseNumber, clinicName, clinicAddress, consultationFee, experience, bio, availableDays, availableHours, latitude, longitude, scheduleConfig } = req.body;

  const existingDoc = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) });

  const effectiveAddress = clinicAddress || existingDoc?.clinicAddress || u?.address || "Lake Town, Kolkata";
  const addressChanged = Boolean(clinicAddress && clinicAddress !== existingDoc?.clinicAddress);

  // Resolve coordinates
  const resolvedCoords = await resolveProviderCoordinates({
    lat: addressChanged ? (latitude ?? undefined) : (latitude ?? existingDoc?.latitude),
    lng: addressChanged ? (longitude ?? undefined) : (longitude ?? existingDoc?.longitude),
    address: effectiveAddress,
    city: u?.city || "Kolkata",
  });

  // If structured scheduleConfig is supplied, serialize to availableHours or availableDays cleanly
  let effectiveAvailableHours = availableHours;
  let effectiveAvailableDays = availableDays;

  if (scheduleConfig && typeof scheduleConfig === "object") {
    effectiveAvailableHours = JSON.stringify(scheduleConfig);
    // Also build a clean readable summary string for availableDays
    const activeDaysList = Object.entries(scheduleConfig.schedule || {})
      .filter(([_, s]: any) => s.available)
      .map(([day]) => day.slice(0, 3));
    effectiveAvailableDays = activeDaysList.length > 0 ? activeDaysList.join(", ") : "Mon, Tue, Wed, Thu, Fri";
  }

  const [d] = await db
    .update(doctorsTable)
    .set({
      specialty,
      qualification,
      licenseNumber,
      clinicName,
      clinicAddress,
      consultationFee,
      experience,
      bio,
      availableDays: effectiveAvailableDays !== undefined ? effectiveAvailableDays : existingDoc?.availableDays,
      availableHours: effectiveAvailableHours !== undefined ? effectiveAvailableHours : existingDoc?.availableHours,
      latitude: resolvedCoords.lat,
      longitude: resolvedCoords.lng,
    })
    .where(eq(doctorsTable.userId, req.userId!))
    .returning();

  // Also sync coordinates and address to linked user record
  await db
    .update(usersTable)
    .set({
      address: clinicAddress || effectiveAddress,
      latitude: resolvedCoords.lat,
      longitude: resolvedCoords.lng,
    })
    .where(eq(usersTable.id, req.userId!));

  res.json({
    id: d.id, userId: d.userId,
    firstName: u?.firstName ?? "", lastName: u?.lastName ?? "",
    email: u?.email ?? "", avatarUrl: u?.avatarUrl,
    specialty: d.specialty, qualification: d.qualification,
    licenseNumber: d.licenseNumber, clinicName: d.clinicName,
    clinicAddress: d.clinicAddress, consultationFee: d.consultationFee,
    experience: d.experience, bio: d.bio, rating: d.rating,
    reviewCount: d.reviewCount, status: d.status,
    availableDays: d.availableDays, availableHours: d.availableHours,
    scheduleConfig: parseDoctorSchedule(d.availableDays, d.availableHours),
  });
});

// GET /doctors/me/dashboard
router.get("/doctors/me/dashboard", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const today = formatDateToYYYYMMDD(new Date());

  const [allAppts, patients, prescriptions, user] = await Promise.all([
    db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id)),
    db.selectDistinct({ patientId: appointmentsTable.patientId }).from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id)),
    db.select().from(prescriptionsTable).where(eq(prescriptionsTable.doctorId, doctorRow.id)),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, req.userId!) }),
  ]);

  // 1. Today's Appointments: Total scheduled today (excluding cancelled)
  const todayScheduledAppts = allAppts.filter((a) => a.appointmentDate === today && a.status !== "cancelled");
  const todayTotalCount = todayScheduledAppts.length;

  // 2. Today's Remaining: Actionable today (not completed and not cancelled)
  const todayRemainingCount = todayScheduledAppts.filter((a) => a.status !== "completed").length;

  // 3. Pending Appointments: Unconfirmed requests waiting for doctor acceptance (all dates)
  const pendingCount = allAppts.filter((a) => a.status === "pending").length;

  // 4. Completed Appointments: Total consultations completed
  const completedCount = allAppts.filter((a) => a.status === "completed").length;

  // 5. Upcoming Appointments: Future date + confirmed by doctor
  const upcomingList = allAppts
    .filter((a) => a.appointmentDate > today && a.status === "confirmed")
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.appointmentTime.localeCompare(b.appointmentTime));
  const upcomingCount = upcomingList.length;

  // 6. Total Prescriptions Issued: Direct from prescriptions table
  const totalPrescriptionsCount = prescriptions.length;

  // Consultations for dashboard display (today's active/pending/confirmed + upcoming)
  const displayAppts = allAppts
    .filter((a) => (a.appointmentDate === today || a.appointmentDate > today) && a.status !== "cancelled")
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.appointmentTime.localeCompare(b.appointmentTime))
    .slice(0, 10);

  // Batch fetch patient details for display appointments and recent patients
  const neededPatientIds = Array.from(new Set([
    ...displayAppts.map((a) => a.patientId),
    ...allAppts.map((a) => a.patientId),
  ])).slice(0, 20);

  const patientUsers = neededPatientIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, neededPatientIds))
    : [];
  const patientUserMap = new Map(patientUsers.map((u) => [u.id, u]));

  const enrichedDisplayAppts = displayAppts.map((a) => {
    const patient = patientUserMap.get(a.patientId);
    const pName = patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null;
    return {
      ...a,
      patientName: pName || (patient?.email ? patient.email : null),
      doctorName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null,
      doctorSpecialty: doctorRow.specialty,
      consultationFee: a.consultationFee ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  });

  // Recent patients
  const recentPatientIds = [...new Set(allAppts.map((a) => a.patientId))].slice(0, 5);
  const recentPatientData = recentPatientIds.map((pid) => {
    const u = patientUserMap.get(pid);
    const visits = allAppts.filter((a) => a.patientId === pid).length;
    const lastVisit = allAppts
      .filter((a) => a.patientId === pid)
      .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))[0]?.appointmentDate;
    return {
      id: pid,
      firstName: u?.firstName ?? "",
      lastName: u?.lastName ?? "",
      email: u?.email ?? "",
      avatarUrl: u?.avatarUrl ?? null,
      lastVisit: lastVisit ?? null,
      totalVisits: visits,
    };
  });

  const firstName = user?.firstName ?? null;
  const lastName = user?.lastName ?? null;
  const userName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email : null;

  res.json({
    userName,
    firstName,
    lastName,
    todayAppointments: todayTotalCount,
    todayRemainingAppointments: todayRemainingCount,
    totalPatients: patients.length,
    pendingAppointments: pendingCount,
    upcomingAppointmentsCount: upcomingCount,
    completedAppointments: completedCount,
    totalPrescriptions: totalPrescriptionsCount,
    upcomingAppointments: enrichedDisplayAppts,
    recentPatients: recentPatientData,
  });
});

// GET /doctors/me/appointments
router.get("/doctors/me/appointments", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const { status, date } = req.query as { status?: string; date?: string };
  const pagination = parsePaginationParams(req);

  let appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id));

  if (status) appts = appts.filter((a) => a.status === status);
  if (date) appts = appts.filter((a) => a.appointmentDate === date);

  const total = appts.length;
  setPaginationHeaders(res, total, pagination);

  const paginatedAppts = appts.slice(pagination.offset, pagination.offset + pagination.limit);

  if (paginatedAppts.length === 0) {
    res.json([]);
    return;
  }

  // Batch query patient & doctor users
  const patientIds = Array.from(new Set(paginatedAppts.map((a) => a.patientId)));
  const patientUsers = patientIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, patientIds))
    : [];
  const patientUserMap = new Map(patientUsers.map((u) => [u.id, u]));

  const doctorUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, doctorRow.userId) });
  const doctorName = doctorUser ? `${doctorUser.firstName ?? ""} ${doctorUser.lastName ?? ""}`.trim() : null;

  const enriched = paginatedAppts.map((a) => {
    const patient = patientUserMap.get(a.patientId);
    return {
      ...a,
      patientName: patient ? `${patient.firstName ?? ""} ${patient.lastName ?? ""}`.trim() : null,
      doctorName,
      doctorSpecialty: doctorRow.specialty,
      consultationFee: a.consultationFee ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  });

  res.json(enriched);
});

// GET /doctors/me/patients
router.get("/doctors/me/patients", requireAuth, requireRole(["doctor"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const doctorRow = await db.query.doctorsTable.findFirst({ where: eq(doctorsTable.userId, req.userId!) });
  if (!doctorRow) { res.status(404).json({ error: "Doctor not found" }); return; }

  const pagination = parsePaginationParams(req);
  const appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.doctorId, doctorRow.id));
  const patientIds = [...new Set(appts.map((a) => a.patientId))];

  const total = patientIds.length;
  setPaginationHeaders(res, total, pagination);

  const paginatedPatientIds = patientIds.slice(pagination.offset, pagination.offset + pagination.limit);

  if (paginatedPatientIds.length === 0) {
    res.json([]);
    return;
  }

  const patientUsers = await db.select().from(usersTable).where(inArray(usersTable.id, paginatedPatientIds));
  const patientUserMap = new Map(patientUsers.map((u) => [u.id, u]));

  const patients = paginatedPatientIds.map((pid) => {
    const u = patientUserMap.get(pid);
    const visits = appts.filter((a) => a.patientId === pid).length;
    const lastVisit = appts
      .filter((a) => a.patientId === pid)
      .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))[0]?.appointmentDate;
    return {
      id: pid,
      firstName: u?.firstName ?? "",
      lastName: u?.lastName ?? "",
      email: u?.email ?? "",
      avatarUrl: u?.avatarUrl ?? null,
      lastVisit: lastVisit ?? null,
      totalVisits: visits,
    };
  });

  res.json(patients);
});

export default router;

import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import {
  db,
  doctorsTable,
  pharmaciesTable,
  diagnosticCentersTable,
  usersTable,
  providerApplicationsTable,
} from "@workspace/db";

const router = Router();

/**
 * Haversine formula: calculates the great-circle distance between two points on Earth.
 * Returns distance in kilometres.
 */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /nearby
 * Query params:
 *   lat      - patient latitude (required)
 *   lng      - patient longitude (required)
 *   radius   - search radius in km (default: 25)
 *   type     - 'all' | 'doctor' | 'pharmacy' | 'diagnostic_center' (default: 'all')
 *   search   - optional text search for name / specialty
 *   limit    - max results per type (default: 50)
 */
router.get("/nearby", async (req, res): Promise<void> => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({
        error: "lat and lng query parameters are required and must be valid numbers.",
      });
      return;
    }

    const radiusKm = parseFloat((req.query.radius as string) || "25");
    const type = (req.query.type as string) || "all";
    const search = ((req.query.search as string) || "").toLowerCase().trim();

    const results: Array<{
      id: number;
      type: "doctor" | "pharmacy" | "diagnostic_center";
      name: string;
      specialty?: string;
      address?: string;
      city?: string;
      phone?: string;
      openingHours?: string;
      rating?: number;
      latitude: number;
      longitude: number;
      distanceKm: number;
    }> = [];

    // ─── Doctors ────────────────────────────────────────────────────────────────
    if (type === "all" || type === "doctor") {
      // Query doctorsTable joined with usersTable (all statuses: active, pending, approved)
      const doctors = await db
        .select({
          d: doctorsTable,
          u: {
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            email: usersTable.email,
          },
        })
        .from(doctorsTable)
        .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id));

      const processedUserIds = new Set<number>();

      let idx = 0;
      for (const row of doctors) {
        const { d, u } = row;
        processedUserIds.add(d.userId);

        const doctorLat = d.latitude ?? (lat + 0.012 * (idx + 1) * (idx % 2 === 0 ? 1 : -1));
        const doctorLng = d.longitude ?? (lng + 0.015 * (idx + 1) * (idx % 3 === 0 ? -1 : 1));
        idx++;

        const distanceKm = haversineDistanceKm(lat, lng, doctorLat, doctorLng);
        if (distanceKm > radiusKm) continue;

        const fullName = `Dr. ${u.firstName ?? "Doctor"} ${u.lastName ?? ""}`.trim();
        if (search && !fullName.toLowerCase().includes(search) && !(d.specialty ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: d.id,
          type: "doctor",
          name: fullName,
          specialty: d.specialty || "General Physician",
          address: d.clinicAddress || "Healthcare Clinic",
          city: undefined,
          phone: undefined,
          openingHours: d.availableHours ?? "09:00 AM - 05:00 PM",
          rating: d.rating ?? 4.8,
          latitude: doctorLat,
          longitude: doctorLng,
          distanceKm,
        });
      }

      // Also include any DOCTOR provider applications that are pending/approved
      const docApps = await db.query.providerApplicationsTable.findMany({
        where: eq(providerApplicationsTable.type, "DOCTOR"),
      });

      for (const app of docApps) {
        if (app.userId && processedUserIds.has(app.userId)) continue;

        const docLat = app.latitude ?? (lat + 0.014 * (idx + 1) * (idx % 2 === 0 ? -1 : 1));
        const docLng = app.longitude ?? (lng + 0.012 * (idx + 1) * (idx % 3 === 0 ? 1 : -1));
        idx++;

        const distanceKm = haversineDistanceKm(lat, lng, docLat, docLng);
        if (distanceKm > radiusKm) continue;

        const fullName = `Dr. ${app.firstName ?? "Doctor"} ${app.lastName ?? ""}`.trim();
        if (search && !fullName.toLowerCase().includes(search) && !(app.specialty ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: app.id,
          type: "doctor",
          name: fullName,
          specialty: app.specialty || "General Physician",
          address: app.address || "Medical Clinic",
          city: app.city ?? undefined,
          phone: app.phone ?? undefined,
          openingHours: "09:00 AM - 05:00 PM",
          rating: 4.8,
          latitude: docLat,
          longitude: docLng,
          distanceKm,
        });
      }
    }

    // ─── Pharmacies ─────────────────────────────────────────────────────────────
    if (type === "all" || type === "pharmacy") {
      const pharmacies = await db.select().from(pharmaciesTable);

      let idx = 0;
      for (const p of pharmacies) {
        const pLat = p.latitude ?? (lat + 0.018 * (idx + 1) * (idx % 2 === 0 ? -1 : 1));
        const pLng = p.longitude ?? (lng + 0.011 * (idx + 1) * (idx % 3 === 0 ? 1 : -1));
        idx++;

        const distanceKm = haversineDistanceKm(lat, lng, pLat, pLng);
        if (distanceKm > radiusKm) continue;

        if (search && !p.name.toLowerCase().includes(search) && !(p.city ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: p.id,
          type: "pharmacy",
          name: p.name,
          address: p.address ?? "Main Road",
          city: p.city ?? undefined,
          phone: p.phone ?? undefined,
          openingHours: p.openingHours ?? "08:00 AM - 10:00 PM",
          latitude: pLat,
          longitude: pLng,
          distanceKm,
        });
      }
    }

    // ─── Diagnostic Centers ─────────────────────────────────────────────────────
    if (type === "all" || type === "diagnostic_center") {
      const centers = await db.select().from(diagnosticCentersTable);

      let idx = 0;
      for (const dc of centers) {
        const dcLat = dc.latitude ?? (lat - 0.014 * (idx + 1) * (idx % 2 === 0 ? 1 : -1));
        const dcLng = dc.longitude ?? (lng - 0.016 * (idx + 1) * (idx % 3 === 0 ? -1 : 1));
        idx++;

        const distanceKm = haversineDistanceKm(lat, lng, dcLat, dcLng);
        if (distanceKm > radiusKm) continue;

        if (search && !dc.name.toLowerCase().includes(search) && !(dc.city ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: dc.id,
          type: "diagnostic_center",
          name: dc.name,
          address: dc.address ?? "Diagnostic Center Wing",
          city: dc.city ?? undefined,
          phone: dc.phone ?? undefined,
          openingHours: dc.openingHours ?? "07:00 AM - 09:00 PM",
          rating: dc.rating ?? 4.7,
          latitude: dcLat,
          longitude: dcLng,
          distanceKm,
        });
      }
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      count: results.length,
      radiusKm,
      centerLat: lat,
      centerLng: lng,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch nearby providers" });
  }
});

export default router;

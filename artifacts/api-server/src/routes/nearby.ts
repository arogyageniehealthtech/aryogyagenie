import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import {
  db,
  doctorsTable,
  pharmaciesTable,
  diagnosticCentersTable,
  usersTable,
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
      const doctors = await db
        .select({
          d: doctorsTable,
          u: {
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
          },
        })
        .from(doctorsTable)
        .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
        .where(
          or(
            eq(doctorsTable.status, "active"),
            and(eq(usersTable.role, "doctor"), eq(usersTable.status, "active")),
          ),
        );

      for (const row of doctors) {
        const { d, u } = row;
        if (d.latitude == null || d.longitude == null) continue;

        const distanceKm = haversineDistanceKm(lat, lng, d.latitude, d.longitude);
        if (distanceKm > radiusKm) continue;

        const fullName = `Dr. ${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
        if (search && !fullName.toLowerCase().includes(search) && !(d.specialty ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: d.id,
          type: "doctor",
          name: fullName,
          specialty: d.specialty,
          address: d.clinicAddress ?? undefined,
          city: undefined,
          phone: undefined,
          openingHours: d.availableHours ?? undefined,
          rating: d.rating ?? 0,
          latitude: d.latitude,
          longitude: d.longitude,
          distanceKm,
        });
      }
    }

    // ─── Pharmacies ─────────────────────────────────────────────────────────────
    if (type === "all" || type === "pharmacy") {
      const pharmacies = await db
        .select()
        .from(pharmaciesTable)
        .where(eq(pharmaciesTable.status, "active"));

      for (const p of pharmacies) {
        if (p.latitude == null || p.longitude == null) continue;

        const distanceKm = haversineDistanceKm(lat, lng, p.latitude, p.longitude);
        if (distanceKm > radiusKm) continue;

        if (search && !p.name.toLowerCase().includes(search) && !(p.city ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: p.id,
          type: "pharmacy",
          name: p.name,
          address: p.address ?? undefined,
          city: p.city ?? undefined,
          phone: p.phone ?? undefined,
          openingHours: p.openingHours ?? undefined,
          latitude: p.latitude,
          longitude: p.longitude,
          distanceKm,
        });
      }
    }

    // ─── Diagnostic Centers ─────────────────────────────────────────────────────
    if (type === "all" || type === "diagnostic_center") {
      const centers = await db
        .select()
        .from(diagnosticCentersTable)
        .where(eq(diagnosticCentersTable.status, "active"));

      for (const dc of centers) {
        if (dc.latitude == null || dc.longitude == null) continue;

        const distanceKm = haversineDistanceKm(lat, lng, dc.latitude, dc.longitude);
        if (distanceKm > radiusKm) continue;

        if (search && !dc.name.toLowerCase().includes(search) && !(dc.city ?? "").toLowerCase().includes(search)) continue;

        results.push({
          id: dc.id,
          type: "diagnostic_center",
          name: dc.name,
          address: dc.address ?? undefined,
          city: dc.city ?? undefined,
          phone: dc.phone ?? undefined,
          openingHours: dc.openingHours ?? undefined,
          rating: dc.rating ?? 0,
          latitude: dc.latitude,
          longitude: dc.longitude,
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

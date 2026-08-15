import { Router } from "express";
import {
  parseCoordinates,
  clampRadiusKm,
  searchNearbyDoctors,
  searchNearbyDiagnosticCenters,
  searchNearbyPharmacies,
  resolveProviderCoordinates,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  DEFAULT_RADIUS_KM,
} from "../lib/locationService";

const router = Router();

/**
 * GET /geocode
 * Resolves any address, locality, or pincode into geographic coordinates.
 */
router.get("/geocode", async (req, res): Promise<void> => {
  try {
    const rawAddress = (req.query.address || req.query.q) as string | undefined;
    if (!rawAddress || !rawAddress.trim()) {
      res.status(400).json({ error: "Address parameter 'address' or 'q' is required." });
      return;
    }

    const resolved = await resolveProviderCoordinates({ address: rawAddress.trim() });
    res.json({
      lat: resolved.lat,
      lng: resolved.lng,
      displayName: rawAddress.trim(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to geocode address." });
  }
});

/**
 * GET /nearby
 * Discover nearby verified Doctors, Diagnostic Centers, and Pharmacies/Medicines.
 *
 * Query parameters:
 *   lat        - Patient latitude (required, between -90 and 90)
 *   lng        - Patient longitude (required, between -180 and 180)
 *   radius     - Search radius in km (enforced range: 0 km min to 18 km max, default: 10 km)
 *   type       - 'all' | 'doctor' | 'pharmacy' | 'diagnostic_center' (default: 'all')
 *   specialty  - Optional doctor specialty filter (e.g., 'Cardiologist', 'General Physician')
 *   service    - Optional diagnostic center service filter (e.g., 'Blood Test', 'MRI')
 *   medicine   - Optional medicine name filter (only returns pharmacies stocking that medicine)
 *   search     - Optional general text keyword search (matches provider names, doctor names, clinic names, addresses)
 *   limit      - Max results per type (default: 50, max: 200)
 *   offset     - Pagination offset (default: 0)
 */
router.get("/nearby", async (req, res): Promise<void> => {
  try {
    const rawLat = req.query.lat;
    const rawLng = req.query.lng;

    const coords = parseCoordinates(rawLat, rawLng);
    if (!coords) {
      res.status(400).json({
        error: "Valid lat (-90 to 90) and lng (-180 to 180) query parameters are required.",
        minRadiusKm: MIN_RADIUS_KM,
        maxRadiusKm: MAX_RADIUS_KM,
      });
      return;
    }

    const radiusKm = clampRadiusKm(req.query.radius, DEFAULT_RADIUS_KM);
    const type = (req.query.type as string) || "all";
    const rawSpecialty = req.query.specialty as string | undefined;
    const specialty = rawSpecialty && rawSpecialty !== "all" ? rawSpecialty.trim() : undefined;
    const rawService = req.query.service as string | undefined;
    const service = rawService && rawService !== "all" ? rawService.trim() : undefined;
    const rawMedicine = req.query.medicine as string | undefined;
    const medicine = rawMedicine && rawMedicine.trim() ? rawMedicine.trim() : undefined;
    const rawSearch = req.query.search as string | undefined;
    const search = rawSearch && rawSearch.trim() ? rawSearch.trim() : undefined;
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "50", 10), 1), 200);
    const offset = Math.max(parseInt((req.query.offset as string) || "0", 10), 0);

    const promises: Promise<any>[] = [];

    // 1. Doctors
    if (type === "all" || type === "doctor") {
      promises.push(
        searchNearbyDoctors({
          lat: coords.lat,
          lng: coords.lng,
          radiusKm,
          specialty,
          search,
          limit,
          offset,
        }).then((r) => ({ type: "doctor", ...r })),
      );
    }

    // 2. Diagnostic Centers
    if (type === "all" || type === "diagnostic_center") {
      promises.push(
        searchNearbyDiagnosticCenters({
          lat: coords.lat,
          lng: coords.lng,
          radiusKm,
          service,
          search,
          limit,
          offset,
        }).then((r) => ({ type: "diagnostic_center", ...r })),
      );
    }

    // 3. Pharmacies & Medicines
    if (type === "all" || type === "pharmacy") {
      promises.push(
        searchNearbyPharmacies({
          lat: coords.lat,
          lng: coords.lng,
          radiusKm,
          medicine,
          search,
          limit,
          offset,
        }).then((r) => ({ type: "pharmacy", ...r })),
      );
    }

    const categoryResults = await Promise.all(promises);

    // Merge and sort all results by distance ascending
    const combinedResults: any[] = [];
    let grandTotal = 0;

    for (const cat of categoryResults) {
      grandTotal += cat.total;
      combinedResults.push(...cat.results);
    }

    combinedResults.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      count: combinedResults.length,
      total: grandTotal,
      radiusKm,
      radiusConstraints: {
        minKm: MIN_RADIUS_KM,
        maxKm: MAX_RADIUS_KM,
      },
      center: {
        lat: coords.lat,
        lng: coords.lng,
      },
      distanceType: "straight_line_geographic",
      results: combinedResults,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch nearby providers" });
  }
});

export default router;

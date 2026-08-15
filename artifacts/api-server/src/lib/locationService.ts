import { pool } from "@workspace/db";

// ─── Constants ────────────────────────────────────────────────────────────────
export const MIN_RADIUS_KM = 0;
export const MAX_RADIUS_KM = 18;
export const DEFAULT_RADIUS_KM = 10;

// ─── Validation Helpers ───────────────────────────────────────────────────────
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Validates and sanitizes latitude and longitude.
 * Latitude must be in [-90, 90], Longitude in [-180, 180].
 */
export function parseCoordinates(rawLat: any, rawLng: any): Coordinates | null {
  if (rawLat === undefined || rawLat === null || rawLng === undefined || rawLng === null) {
    return null;
  }
  const lat = typeof rawLat === "number" ? rawLat : parseFloat(String(rawLat));
  const lng = typeof rawLng === "number" ? rawLng : parseFloat(String(rawLng));

  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

/**
 * Enforces search radius constraints: 0 km min to 18 km max.
 * Clamps out-of-range values or defaults to 10 km.
 */
export function clampRadiusKm(rawRadius: any, defaultRadius = DEFAULT_RADIUS_KM): number {
  if (rawRadius === undefined || rawRadius === null) return defaultRadius;
  const parsed = typeof rawRadius === "number" ? rawRadius : parseFloat(String(rawRadius));
  if (isNaN(parsed) || parsed < 0) return defaultRadius;

  if (parsed < MIN_RADIUS_KM) return MIN_RADIUS_KM;
  if (parsed > MAX_RADIUS_KM) return MAX_RADIUS_KM;
  return Math.round(parsed * 10) / 10;
}

/**
 * Attempts to forward geocode an address string using Nominatim if coordinates are missing.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address || !address.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ArogyaGenie/1.0",
      },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch (err) {
    // Non-fatal geocoding error
  }
  return null;
}

// ─── Type Definitions ─────────────────────────────────────────────────────────
export interface NearbyDoctorResult {
  id: number;
  userId: number;
  type: "doctor";
  name: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string | null;
  specialty: string;
  qualification?: string | null;
  licenseNumber?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  state?: string | null;
  pincode?: string | null;
  consultationFee?: number | null;
  experience?: number | null;
  bio?: string | null;
  rating?: number | null;
  reviewCount?: number;
  availableDays?: string[] | null;
  availableHours?: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceType: "straight_line_geographic";
}

export interface NearbyDiagnosticResult {
  id: number;
  userId: number;
  type: "diagnostic_center";
  name: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  accreditation?: string | null;
  services?: string | null;
  openingHours?: string | null;
  rating?: number | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceType: "straight_line_geographic";
}

export interface NearbyPharmacyResult {
  id: number;
  userId: number;
  type: "pharmacy";
  name: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  openingHours?: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceType: "straight_line_geographic";
  matchedMedicine?: {
    medicineId: number;
    medicineName: string;
    genericName?: string | null;
    category?: string | null;
    price?: number | null;
    inStock: boolean;
    quantity?: number | null;
  } | null;
}

// ─── PostGIS Query Implementations ────────────────────────────────────────────

/**
 * Searches active doctors within radiusKm using PostGIS ST_DWithin and ST_Distance.
 */
export async function searchNearbyDoctors(options: {
  lat: number;
  lng: number;
  radiusKm: number;
  specialty?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: NearbyDoctorResult[]; total: number }> {
  const { lat, lng, radiusKm, specialty, search, limit = 50, offset = 0 } = options;
  const radiusMeters = radiusKm * 1000.0;

  const params: any[] = [lng, lat, radiusMeters];
  let paramIdx = 4;

  let whereClauses = `
    LOWER(COALESCE(d.status, 'active')) IN ('active', 'approved')
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
  `;

  if (specialty && specialty !== "all") {
    params.push(`%${specialty}%`);
    whereClauses += ` AND (d.specialty ILIKE $${paramIdx})`;
    paramIdx++;
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    whereClauses += ` AND (
      u.first_name ILIKE $${paramIdx}
      OR u.last_name ILIKE $${paramIdx}
      OR d.specialty ILIKE $${paramIdx}
      OR d.clinic_name ILIKE $${paramIdx}
      OR d.clinic_address ILIKE $${paramIdx}
      OR d.city ILIKE $${paramIdx}
      OR d.state ILIKE $${paramIdx}
      OR d.pincode ILIKE $${paramIdx}
    )`;
    paramIdx++;
  }

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM doctors d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE ${whereClauses}
  `;

  const dataQuery = `
    SELECT
      d.id,
      d.user_id as "userId",
      u.first_name as "firstName",
      u.last_name as "lastName",
      u.email,
      u.avatar_url as "avatarUrl",
      d.specialty,
      d.qualification,
      d.license_number as "licenseNumber",
      d.clinic_name as "clinicName",
      d.clinic_address as "clinicAddress",
      d.state,
      d.pincode,
      d.consultation_fee as "consultationFee",
      d.experience,
      d.bio,
      d.rating,
      d.review_count as "reviewCount",
      d.available_days as "availableDays",
      d.available_hours as "availableHours",
      d.latitude,
      d.longitude,
      ROUND(
        (ST_Distance(
          ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0)::numeric,
        2
      )::float as "distanceKm"
    FROM doctors d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE ${whereClauses}
    ORDER BY "distanceKm" ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  params.push(limit, offset);

  const [countRes, dataRes] = await Promise.all([
    pool.query(countQuery, params.slice(0, paramIdx - 1)),
    pool.query(dataQuery, params),
  ]);

  const total = countRes.rows[0]?.total ?? 0;
  const results: NearbyDoctorResult[] = dataRes.rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    type: "doctor",
    name: `Dr. ${r.firstName ?? "Doctor"} ${r.lastName ?? ""}`.trim(),
    firstName: r.firstName ?? "Doctor",
    lastName: r.lastName ?? "",
    email: r.email,
    avatarUrl: r.avatarUrl,
    specialty: r.specialty || "General Physician",
    qualification: r.qualification,
    licenseNumber: r.licenseNumber,
    clinicName: r.clinicName,
    clinicAddress: r.clinicAddress,
    state: r.state,
    pincode: r.pincode,
    consultationFee: r.consultationFee,
    experience: r.experience,
    bio: r.bio,
    rating: r.rating,
    reviewCount: r.reviewCount ?? 0,
    availableDays: r.availableDays ? (Array.isArray(r.availableDays) ? r.availableDays : JSON.parse(r.availableDays || "[]")) : null,
    availableHours: r.availableHours,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distanceKm,
    distanceType: "straight_line_geographic",
  }));

  return { results, total };
}

/**
 * Searches active diagnostic centers within radiusKm using PostGIS ST_DWithin and ST_Distance.
 */
export async function searchNearbyDiagnosticCenters(options: {
  lat: number;
  lng: number;
  radiusKm: number;
  service?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: NearbyDiagnosticResult[]; total: number }> {
  const { lat, lng, radiusKm, service, search, limit = 50, offset = 0 } = options;
  const radiusMeters = radiusKm * 1000.0;

  const params: any[] = [lng, lat, radiusMeters];
  let paramIdx = 4;

  let whereClauses = `
    LOWER(COALESCE(dc.status, 'active')) IN ('active', 'approved')
    AND dc.latitude IS NOT NULL
    AND dc.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(dc.longitude, dc.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
  `;

  if (service && service.trim()) {
    params.push(`%${service.trim()}%`);
    whereClauses += ` AND (dc.services ILIKE $${paramIdx})`;
    paramIdx++;
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    whereClauses += ` AND (
      dc.name ILIKE $${paramIdx}
      OR dc.services ILIKE $${paramIdx}
      OR dc.address ILIKE $${paramIdx}
      OR dc.city ILIKE $${paramIdx}
      OR dc.state ILIKE $${paramIdx}
      OR dc.pincode ILIKE $${paramIdx}
    )`;
    paramIdx++;
  }

  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM diagnostic_centers dc
    LEFT JOIN users u ON dc.user_id = u.id
    WHERE ${whereClauses}
  `;

  const dataQuery = `
    SELECT
      dc.id,
      dc.user_id as "userId",
      dc.name,
      u.email,
      dc.phone,
      dc.address,
      dc.city,
      dc.state,
      dc.pincode,
      dc.accreditation,
      dc.services,
      dc.opening_hours as "openingHours",
      dc.rating,
      dc.latitude,
      dc.longitude,
      ROUND(
        (ST_Distance(
          ST_SetSRID(ST_MakePoint(dc.longitude, dc.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0)::numeric,
        2
      )::float as "distanceKm"
    FROM diagnostic_centers dc
    LEFT JOIN users u ON dc.user_id = u.id
    WHERE ${whereClauses}
    ORDER BY "distanceKm" ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  params.push(limit, offset);

  const [countRes, dataRes] = await Promise.all([
    pool.query(countQuery, params.slice(0, paramIdx - 1)),
    pool.query(dataQuery, params),
  ]);

  const total = countRes.rows[0]?.total ?? 0;
  const results: NearbyDiagnosticResult[] = dataRes.rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    type: "diagnostic_center",
    name: r.name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    accreditation: r.accreditation,
    services: r.services,
    openingHours: r.openingHours,
    rating: r.rating,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distanceKm,
    distanceType: "straight_line_geographic",
  }));

  return { results, total };
}

/**
 * Searches active pharmacies within radiusKm.
 * When `medicine` is specified:
 *   Joins `pharmacy_inventory` and `medicines` where `in_stock = true`.
 *   Returns only pharmacies stocking that medicine, along with medicine details and distance.
 */
export async function searchNearbyPharmacies(options: {
  lat: number;
  lng: number;
  radiusKm: number;
  medicine?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: NearbyPharmacyResult[]; total: number }> {
  const { lat, lng, radiusKm, medicine, search, limit = 50, offset = 0 } = options;
  const radiusMeters = radiusKm * 1000.0;

  const params: any[] = [lng, lat, radiusMeters];
  let paramIdx = 4;

  const hasMedicineSearch = Boolean(medicine && medicine.trim());

  let whereClauses = `
    LOWER(COALESCE(p.status, 'active')) IN ('active', 'approved')
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
  `;

  if (hasMedicineSearch) {
    params.push(`%${medicine!.trim()}%`);
    whereClauses += `
      AND pi.in_stock = true
      AND (
        m.name ILIKE $${paramIdx}
        OR m.generic_name ILIKE $${paramIdx}
        OR m.category ILIKE $${paramIdx}
      )
    `;
    paramIdx++;
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    whereClauses += ` AND (
      p.name ILIKE $${paramIdx}
      OR p.city ILIKE $${paramIdx}
      OR p.address ILIKE $${paramIdx}
      OR p.state ILIKE $${paramIdx}
      OR p.pincode ILIKE $${paramIdx}
    )`;
    paramIdx++;
  }

  let countQuery: string;
  let dataQuery: string;

  if (hasMedicineSearch) {
    countQuery = `
      SELECT COUNT(*)::int as total
      FROM pharmacies p
      LEFT JOIN users u ON p.user_id = u.id
      JOIN pharmacy_inventory pi ON p.id = pi.pharmacy_id
      JOIN medicines m ON pi.medicine_id = m.id
      WHERE ${whereClauses}
    `;

    dataQuery = `
      SELECT
        p.id,
        p.user_id as "userId",
        p.name,
        u.email,
        p.phone,
        p.address,
        p.city,
        p.state,
        p.pincode,
        p.opening_hours as "openingHours",
        p.latitude,
        p.longitude,
        ROUND(
          (ST_Distance(
            ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000.0)::numeric,
          2
        )::float as "distanceKm",
        m.id as "medicineId",
        m.name as "medicineName",
        m.generic_name as "genericName",
        m.category as "medicineCategory",
        pi.price as "medicinePrice",
        pi.in_stock as "inStock",
        pi.quantity as "medicineQuantity"
      FROM pharmacies p
      LEFT JOIN users u ON p.user_id = u.id
      JOIN pharmacy_inventory pi ON p.id = pi.pharmacy_id
      JOIN medicines m ON pi.medicine_id = m.id
      WHERE ${whereClauses}
      ORDER BY "distanceKm" ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
  } else {
    countQuery = `
      SELECT COUNT(*)::int as total
      FROM pharmacies p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE ${whereClauses}
    `;

    dataQuery = `
      SELECT
        p.id,
        p.user_id as "userId",
        p.name,
        u.email,
        p.phone,
        p.address,
        p.city,
        p.state,
        p.pincode,
        p.opening_hours as "openingHours",
        p.latitude,
        p.longitude,
        ROUND(
          (ST_Distance(
            ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) / 1000.0)::numeric,
          2
        )::float as "distanceKm",
        NULL as "medicineId",
        NULL as "medicineName",
        NULL as "genericName",
        NULL as "medicineCategory",
        NULL as "medicinePrice",
        NULL as "inStock",
        NULL as "medicineQuantity"
      FROM pharmacies p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE ${whereClauses}
      ORDER BY "distanceKm" ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
  }

  params.push(limit, offset);

  const [countRes, dataRes] = await Promise.all([
    pool.query(countQuery, params.slice(0, paramIdx - 1)),
    pool.query(dataQuery, params),
  ]);

  const total = countRes.rows[0]?.total ?? 0;
  const results: NearbyPharmacyResult[] = dataRes.rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    type: "pharmacy",
    name: r.name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    openingHours: r.openingHours,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distanceKm,
    distanceType: "straight_line_geographic",
    matchedMedicine: hasMedicineSearch
      ? {
          medicineId: r.medicineId,
          medicineName: r.medicineName,
          genericName: r.genericName,
          category: r.medicineCategory,
          price: r.medicinePrice,
          inStock: Boolean(r.inStock),
          quantity: r.medicineQuantity,
        }
      : null,
  }));

  return { results, total };
}

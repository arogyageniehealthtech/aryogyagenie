import { pool } from "@workspace/db";

// ─── Constants ────────────────────────────────────────────────────────────────
export const MIN_RADIUS_KM = 0;
export const MAX_RADIUS_KM = 18;
export const DEFAULT_RADIUS_KM = 10;

// ─── Local Locality Dictionary (Instant Offline Geocoding) ───────────────────
export const LOCALITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "477, swamiji sarani": { lat: 22.6100, lng: 88.4050 },
  "swamiji sarani": { lat: 22.6100, lng: 88.4050 },
  "700048": { lat: 22.6100, lng: 88.4050 },
  "bangur avenue": { lat: 22.6050, lng: 88.4080 },
  "bangur": { lat: 22.6050, lng: 88.4080 },
  "700055": { lat: 22.6050, lng: 88.4080 },
  "dum dum park": { lat: 22.6120, lng: 88.4110 },
  "700074": { lat: 22.6120, lng: 88.4110 },
  "nagerbazar": { lat: 22.6300, lng: 88.4180 },
  "700028": { lat: 22.6521, lng: 88.4360 },
  "700079": { lat: 22.6450, lng: 88.4250 },
  "700052": { lat: 22.6500, lng: 88.4450 },
  "airport": { lat: 22.6500, lng: 88.4450 },
  "patipukur": { lat: 22.6000, lng: 88.3900 },
  "dakshindari": { lat: 22.6020, lng: 88.3980 },
  "700089": { lat: 22.6057, lng: 88.4030 },
  "700059": { lat: 22.6185, lng: 88.4285 },
  "700091": { lat: 22.5794, lng: 88.4345 },
  "700064": { lat: 22.5912, lng: 88.4089 },
  "700106": { lat: 22.5712, lng: 88.4150 },
  "700156": { lat: 22.5898, lng: 88.4744 },
  "700016": { lat: 22.5532, lng: 88.3512 },
  "salt lake sector v": { lat: 22.5794, lng: 88.4345 },
  "salt lake sector 5": { lat: 22.5794, lng: 88.4345 },
  "salt lake sector 1": { lat: 22.5912, lng: 88.4089 },
  "salt lake sector i": { lat: 22.5912, lng: 88.4089 },
  "salt lake sector 2": { lat: 22.5834, lng: 88.4123 },
  "salt lake sector ii": { lat: 22.5834, lng: 88.4123 },
  "salt lake sector 3": { lat: 22.5712, lng: 88.4150 },
  "salt lake sector iii": { lat: 22.5712, lng: 88.4150 },
  "lake town": { lat: 22.6057, lng: 88.4030 },
  "laketown": { lat: 22.6057, lng: 88.4030 },
  "south dumdum": { lat: 22.6100, lng: 88.4050 },
  "south dum dum": { lat: 22.6100, lng: 88.4050 },
  "dum dum": { lat: 22.6521, lng: 88.4360 },
  "dumdum": { lat: 22.6521, lng: 88.4360 },
  "baguiati": { lat: 22.6185, lng: 88.4285 },
  "baguihati": { lat: 22.6185, lng: 88.4285 },
  "kestopur": { lat: 22.5932, lng: 88.4290 },
  "krishnapur": { lat: 22.5932, lng: 88.4290 },
  "sector v": { lat: 22.5794, lng: 88.4345 },
  "sector 5": { lat: 22.5794, lng: 88.4345 },
  "sector 1": { lat: 22.5912, lng: 88.4089 },
  "sector i": { lat: 22.5912, lng: 88.4089 },
  "sector 2": { lat: 22.5834, lng: 88.4123 },
  "sector ii": { lat: 22.5834, lng: 88.4123 },
  "sector 3": { lat: 22.5712, lng: 88.4150 },
  "sector iii": { lat: 22.5712, lng: 88.4150 },
  "salt lake": { lat: 22.5834, lng: 88.4123 },
  "saltlake": { lat: 22.5834, lng: 88.4123 },
  "bidhannagar": { lat: 22.5834, lng: 88.4123 },
  "new town": { lat: 22.5898, lng: 88.4744 },
  "newtown": { lat: 22.5898, lng: 88.4744 },
  "rajarhat": { lat: 22.6120, lng: 88.4890 },
  "park street": { lat: 22.5532, lng: 88.3512 },
  "park circus": { lat: 22.5441, lng: 88.3689 },
  "shyambazar": { lat: 22.5998, lng: 88.3712 },
  "bhowanipore": { lat: 22.5354, lng: 88.3472 },
  "bhawanipur": { lat: 22.5354, lng: 88.3472 },
  "garia": { lat: 22.4678, lng: 88.3956 },
  "gariahat": { lat: 22.5189, lng: 88.3654 },
  "jadavpur": { lat: 22.4988, lng: 88.3718 },
  "behala": { lat: 22.4988, lng: 88.3188 },
  "baranagar": { lat: 22.6417, lng: 88.3742 },
  "belgharia": { lat: 22.6625, lng: 88.3840 },
  "howrah": { lat: 22.5958, lng: 88.2636 },
  "alipore": { lat: 22.5323, lng: 88.3289 },
  "ballygunge": { lat: 22.5280, lng: 88.3650 },
  "ruby": { lat: 22.5123, lng: 88.3912 },
  "mukundapur": { lat: 22.4995, lng: 88.3980 },
  "tollygunge": { lat: 22.4967, lng: 88.3456 },
  "sealdah": { lat: 22.5697, lng: 88.3702 },
  "esplanade": { lat: 22.5645, lng: 88.3524 },
  "barasat": { lat: 22.7230, lng: 88.4800 },
  "madhyamgram": { lat: 22.7000, lng: 88.4500 },
  "serampore": { lat: 22.7500, lng: 88.3400 },
  "barrackpore": { lat: 22.7600, lng: 88.3700 },
  "dankuni": { lat: 22.6800, lng: 88.2900 },
  "uttarpara": { lat: 22.6700, lng: 88.3400 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
  "calcutta": { lat: 22.5726, lng: 88.3639 },
  "durgapur": { lat: 23.5204, lng: 87.3119 },
  "siliguri": { lat: 26.7271, lng: 88.3953 },
  "asansol": { lat: 23.6739, lng: 86.9524 },
  "new delhi": { lat: 28.6139, lng: 77.2090 },
  "delhi": { lat: 28.6139, lng: 77.2090 },
  "connaught place": { lat: 28.6289, lng: 77.2189 },
  "noida": { lat: 28.5355, lng: 77.3910 },
  "gurugram": { lat: 28.4595, lng: 77.0266 },
  "gurgaon": { lat: 28.4595, lng: 77.0266 },
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "koramangala": { lat: 12.9352, lng: 77.6245 },
  "indiranagar": { lat: 12.9784, lng: 77.6408 },
  "whitefield": { lat: 12.9698, lng: 77.7499 },
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "bandra": { lat: 19.0596, lng: 72.8295 },
  "andheri": { lat: 19.1136, lng: 72.8697 },
  "hyderabad": { lat: 17.3850, lng: 78.4867 },
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "pune": { lat: 18.5204, lng: 73.8567 },
};

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
  if (lat === 0 && lng === 0) return null;

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
 * Attempts to forward geocode an address string using Nominatim with timeout.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address || !address.trim()) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ArogyaGenie/1.0",
      },
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
      }
    }
  } catch {
    // Non-fatal geocoding error
  }
  return null;
}

// Specific sub-localities that should be matched before generic municipality/city names
const SPECIFIC_LOCALITY_PRIORITY = [
  "477, swamiji sarani",
  "swamiji sarani",
  "nagerbazar",
  "dum dum park",
  "bangur avenue",
  "bangur",
  "lake town",
  "laketown",
  "salt lake sector v",
  "salt lake sector 5",
  "salt lake sector 1",
  "salt lake sector 2",
  "salt lake sector 3",
  "salt lake sector i",
  "salt lake sector ii",
  "salt lake sector iii",
  "salt lake",
  "saltlake",
  "bidhannagar",
  "new town",
  "newtown",
  "rajarhat",
  "kestopur",
  "krishnapur",
  "baguiati",
  "baguihati",
  "patipukur",
  "dakshindari",
  "park street",
  "park circus",
  "gariahat",
  "jadavpur",
  "ballygunge",
  "alipore",
  "behala",
  "baranagar",
  "belgharia",
  "ruby",
  "mukundapur",
  "tollygunge",
  "sealdah",
  "esplanade",
  "shyambazar",
  "bhowanipore",
  "bhawanipur",
  "barasat",
  "madhyamgram",
  "barrackpore",
  "howrah",
  "airport",
  "700048",
  "700055",
  "700074",
  "700028",
  "700079",
  "700052",
  "700089",
  "700059",
  "700091",
  "700064",
  "700106",
  "700156",
  "700016",
];

/**
 * Comprehensive coordinate resolver:
 * 1. Checks if existing coords are valid non-zero numbers.
 * 2. Matches address / city keywords against high-priority specific sub-localities first,
 *    then the remaining LOCALITY_COORDINATES dictionary.
 * 3. Tries OpenStreetMap / Nominatim geocoding.
 * 4. Falls back to default city/regional anchor (guarantees non-null coordinates).
 */
export async function resolveProviderCoordinates(options: {
  lat?: any;
  lng?: any;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}): Promise<{ lat: number; lng: number }> {
  // 1. Existing valid coordinates check
  const parsed = parseCoordinates(options.lat, options.lng);
  if (parsed) return parsed;

  const combinedText = [
    options.address || "",
    options.city || "",
    options.state || "",
    options.pincode || "",
  ]
    .join(" ")
    .toLowerCase()
    .trim();

  // 2. High-precision offline dictionary matching:
  // First check specific sub-localities
  if (combinedText) {
    for (const key of SPECIFIC_LOCALITY_PRIORITY) {
      if (combinedText.includes(key) && LOCALITY_COORDINATES[key]) {
        return LOCALITY_COORDINATES[key];
      }
    }

    // Then check all other keys sorted by length desc
    const sortedKeys = Object.keys(LOCALITY_COORDINATES).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (combinedText.includes(key)) {
        return LOCALITY_COORDINATES[key];
      }
    }
  }

  // 3. Online geocoding attempt
  if (options.address || options.city) {
    const query = [options.address, options.city, options.state || "India"].filter(Boolean).join(", ");
    const geocoded = await geocodeAddress(query);
    if (geocoded) return geocoded;
  }

  // 4. City/regional fallback
  if (combinedText.includes("delhi") || combinedText.includes("noida") || combinedText.includes("gurgaon")) {
    return LOCALITY_COORDINATES["new delhi"];
  }
  if (combinedText.includes("bangalore") || combinedText.includes("bengaluru")) {
    return LOCALITY_COORDINATES["bengaluru"];
  }
  if (combinedText.includes("mumbai") || combinedText.includes("bombay")) {
    return LOCALITY_COORDINATES["mumbai"];
  }

  // Default Kolkata anchor
  return LOCALITY_COORDINATES["kolkata"];
}

/**
 * Synchronizes and repairs coordinates for all users, doctors, diagnostic centers,
 * pharmacies, and provider applications.
 */
export async function syncAllProviderCoordinates(options?: { forceAll?: boolean }): Promise<{
  usersUpdated: number;
  doctorsUpdated: number;
  diagsUpdated: number;
  pharmsUpdated: number;
  appsUpdated: number;
}> {
  const forceAll = options?.forceAll ?? false;
  let usersUpdated = 0;
  let doctorsUpdated = 0;
  let diagsUpdated = 0;
  let pharmsUpdated = 0;
  let appsUpdated = 0;

  try {
    // 0. Repair Users (Patients, Doctors, Diagnostic Centers, Pharmacies, Admins)
    const userWhere = forceAll ? "" : "WHERE u.latitude IS NULL OR u.longitude IS NULL OR u.latitude = 0 OR u.longitude = 0";
    const userRows = await pool.query(`
      SELECT u.id, u.role, u.first_name, u.last_name, u.address, u.city, u.state, u.latitude, u.longitude,
             d.clinic_address,
             dc.address as diag_address, dc.name as diag_name,
             p.address as pharm_address, p.name as pharm_name
      FROM users u
      LEFT JOIN doctors d ON d.user_id = u.id
      LEFT JOIN diagnostic_centers dc ON dc.user_id = u.id
      LEFT JOIN pharmacies p ON p.user_id = u.id
      ${userWhere}
    `);

    for (const u of userRows.rows) {
      const candidateAddress =
        u.address ||
        u.clinic_address ||
        u.diag_address ||
        u.pharm_address ||
        (u.city ? `${u.city}` : "Lake Town, Kolkata");

      const coords = await resolveProviderCoordinates({
        lat: forceAll ? undefined : u.latitude,
        lng: forceAll ? undefined : u.longitude,
        address: candidateAddress,
        city: u.city || "Kolkata",
        state: u.state || "West Bengal",
      });

      await pool.query(
        `UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3`,
        [coords.lat, coords.lng, u.id],
      );
      usersUpdated++;
    }

    // 1. Repair Doctors
    const docWhere = forceAll ? "" : "WHERE d.latitude IS NULL OR d.longitude IS NULL OR d.latitude = 0 OR d.longitude = 0";
    const docRows = await pool.query(`
      SELECT d.id, d.clinic_address, d.state, d.pincode, d.latitude, d.longitude, u.address as user_address, u.city as user_city
      FROM doctors d
      LEFT JOIN users u ON d.user_id = u.id
      ${docWhere}
    `);

    for (const doc of docRows.rows) {
      const coords = await resolveProviderCoordinates({
        lat: forceAll ? undefined : doc.latitude,
        lng: forceAll ? undefined : doc.longitude,
        address: doc.clinic_address || doc.user_address || "Lake Town, Kolkata",
        city: doc.user_city || "Kolkata",
        state: doc.state || "West Bengal",
        pincode: doc.pincode,
      });

      await pool.query(
        `UPDATE doctors SET latitude = $1, longitude = $2, clinic_address = COALESCE(clinic_address, $3), status = 'active' WHERE id = $4`,
        [coords.lat, coords.lng, doc.clinic_address || doc.user_address || "Lake Town, Kolkata", doc.id],
      );
      doctorsUpdated++;
    }

    // 2. Repair Diagnostic Centers
    const diagWhere = forceAll ? "" : "WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0";
    const diagRows = await pool.query(`
      SELECT id, name, address, city, state, pincode, latitude, longitude
      FROM diagnostic_centers
      ${diagWhere}
    `);

    for (const diag of diagRows.rows) {
      const coords = await resolveProviderCoordinates({
        lat: forceAll ? undefined : diag.latitude,
        lng: forceAll ? undefined : diag.longitude,
        address: diag.address || diag.name,
        city: diag.city || "Kolkata",
        state: diag.state || "West Bengal",
        pincode: diag.pincode,
      });

      await pool.query(
        `UPDATE diagnostic_centers SET latitude = $1, longitude = $2, status = 'active', services = COALESCE(services, 'Blood Test, Pathology, MRI, Digital X-Ray, Ultrasound, CT Scan') WHERE id = $3`,
        [coords.lat, coords.lng, diag.id],
      );
      diagsUpdated++;
    }

    // 3. Repair Pharmacies
    const pharmWhere = forceAll ? "" : "WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0";
    const pharmRows = await pool.query(`
      SELECT id, name, address, city, state, pincode, latitude, longitude
      FROM pharmacies
      ${pharmWhere}
    `);

    for (const pharm of pharmRows.rows) {
      const coords = await resolveProviderCoordinates({
        lat: forceAll ? undefined : pharm.latitude,
        lng: forceAll ? undefined : pharm.longitude,
        address: pharm.address || pharm.name,
        city: pharm.city || "Kolkata",
        state: pharm.state || "West Bengal",
        pincode: pharm.pincode,
      });

      await pool.query(
        `UPDATE pharmacies SET latitude = $1, longitude = $2, status = 'active' WHERE id = $3`,
        [coords.lat, coords.lng, pharm.id],
      );
      pharmsUpdated++;
    }

    // 4. Repair Provider Applications
    const appWhere = forceAll ? "" : "WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0";
    const appRows = await pool.query(`
      SELECT id, type, name, first_name, last_name, address, city, latitude, longitude
      FROM provider_applications
      ${appWhere}
    `);

    for (const app of appRows.rows) {
      const coords = await resolveProviderCoordinates({
        lat: forceAll ? undefined : app.latitude,
        lng: forceAll ? undefined : app.longitude,
        address: app.address || `${app.first_name || ""} ${app.last_name || ""}`.trim(),
        city: app.city || "Kolkata",
      });

      await pool.query(
        `UPDATE provider_applications SET latitude = $1, longitude = $2 WHERE id = $3`,
        [coords.lat, coords.lng, app.id],
      );
      appsUpdated++;
    }
  } catch (err: any) {
    console.warn("syncAllProviderCoordinates warning:", err?.message);
  }

  return { usersUpdated, doctorsUpdated, diagsUpdated, pharmsUpdated, appsUpdated };
}

// ─── Specialty Root Word Matching ─────────────────────────────────────────────
function buildSpecialtyConditions(specialty: string, params: any[]): string {
  const specLower = specialty.toLowerCase().trim();
  const roots: Record<string, string[]> = {
    general: ["general", "physician", "medicine", "practice", "family"],
    physician: ["general", "physician", "medicine", "practice"],
    "general physician": ["general", "physician", "medicine", "practice"],
    "internal medicine": ["internal", "medicine", "physician", "general"],
    cardio: ["cardio"],
    cardiologist: ["cardio"],
    ent: ["ent", "otolaryng", "ear", "nose", "throat"],
    pediatr: ["pediatr", "paediatr", "child"],
    pediatrician: ["pediatr", "paediatr", "child"],
    ortho: ["ortho", "bone", "joint"],
    orthopedist: ["ortho", "bone", "joint"],
    dermat: ["dermat", "skin"],
    dermatologist: ["dermat", "skin"],
    neuro: ["neuro", "brain"],
    neurologist: ["neuro", "brain"],
    pulmon: ["pulmon", "chest", "respir", "lung"],
    pulmonologist: ["pulmon", "chest", "respir", "lung"],
    gastro: ["gastro", "stomach", "digestive"],
    gastroenterologist: ["gastro", "stomach", "digestive"],
    gynec: ["gynec", "gynaec", "obgyn", "women"],
    gynecologist: ["gynec", "gynaec", "obgyn", "women"],
    oncol: ["oncol", "cancer"],
    oncologist: ["oncol", "cancer"],
    nephr: ["nephr", "kidney", "renal"],
    nephrologist: ["nephr", "kidney", "renal"],
    urol: ["urol", "urinary"],
    urologist: ["urol", "urinary"],
    dent: ["dent", "dental", "teeth"],
    dentist: ["dent", "dental", "teeth"],
    surg: ["surg", "surgery"],
    surgeon: ["surg", "surgery"],
    endocrin: ["endocrin", "diabet", "hormone", "thyroid"],
    endocrinologist: ["endocrin", "diabet", "hormone", "thyroid"],
  };

  const matchedKeywords = roots[specLower] || [specLower];
  const conditions: string[] = [];
  for (const kw of matchedKeywords) {
    params.push(`%${kw}%`);
    conditions.push(`d.specialty ILIKE $${params.length}`);
  }
  return `(${conditions.join(" OR ")})`;
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
  address?: string | null;
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

export interface NearbyHospitalResult {
  id: number;
  type: "hospital";
  name: string;
  phone?: string | null;
  emergencyHelpline?: string | null;
  address?: string | null;
  city?: string | null;
  openingHours?: string | null;
  rating?: number | null;
  availableBeds?: number;
  totalBeds?: number;
  departments?: string[];
  specialties?: Array<{
    name: string;
    availableBeds: number;
    totalBeds?: number;
  }>;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceType: "straight_line_geographic";
}

// ─── PostGIS Query Implementations ────────────────────────────────────────────

/**
 * Searches active doctors within radiusKm using PostGIS ST_DWithin and ST_Distance.
 * If no doctors are found within the strict radius circle, automatically falls back
 * to all active matching doctors sorted by distance so the patient is never left with an empty view.
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

  let whereClauses = `
    (LOWER(COALESCE(d.status, 'active')) IN ('active', 'approved') OR (u.role = 'doctor' AND LOWER(COALESCE(u.status, 'active')) = 'active'))
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
      $3::float8
    )
  `;

  if (specialty && specialty !== "all") {
    const specSql = buildSpecialtyConditions(specialty, params);
    whereClauses += ` AND ${specSql}`;
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    const searchIdx = params.length;
    whereClauses += ` AND (
      u.first_name ILIKE $${searchIdx}
      OR u.last_name ILIKE $${searchIdx}
      OR d.specialty ILIKE $${searchIdx}
      OR d.clinic_name ILIKE $${searchIdx}
      OR d.clinic_address ILIKE $${searchIdx}
      OR u.city ILIKE $${searchIdx}
      OR d.state ILIKE $${searchIdx}
      OR d.pincode ILIKE $${searchIdx}
    )`;
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
      COALESCE(d.clinic_address, u.address, 'Medical Center') as "clinicAddress",
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
          ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
        ) / 1000.0)::numeric,
        2
      )::float as "distanceKm"
    FROM doctors d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE ${whereClauses}
    ORDER BY "distanceKm" ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const queryParams = [...params, limit, offset];

  const [countRes, dataRes] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, queryParams),
  ]);

  let total = countRes.rows[0]?.total ?? 0;
  let rows = dataRes.rows;

  // Fallback: If 0 doctors found within strict radius, fetch active doctors sorted by distance
  if (rows.length === 0) {
    const fbParams: any[] = [lng, lat];
    let fbWhere = `
      (LOWER(COALESCE(d.status, 'active')) IN ('active', 'approved') OR (u.role = 'doctor' AND LOWER(COALESCE(u.status, 'active')) = 'active'))
      AND d.latitude IS NOT NULL
      AND d.longitude IS NOT NULL
    `;
    if (specialty && specialty !== "all") {
      const fbSpecSql = buildSpecialtyConditions(specialty, fbParams);
      fbWhere += ` AND ${fbSpecSql}`;
    }
    if (search && search.trim()) {
      fbParams.push(`%${search.trim()}%`);
      const fbSearchIdx = fbParams.length;
      fbWhere += ` AND (
        u.first_name ILIKE $${fbSearchIdx}
        OR u.last_name ILIKE $${fbSearchIdx}
        OR d.specialty ILIKE $${fbSearchIdx}
        OR d.clinic_name ILIKE $${fbSearchIdx}
        OR d.clinic_address ILIKE $${fbSearchIdx}
        OR u.city ILIKE $${fbSearchIdx}
        OR d.state ILIKE $${fbSearchIdx}
        OR d.pincode ILIKE $${fbSearchIdx}
      )`;
    }

    const fbDataQuery = `
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
        COALESCE(d.clinic_address, u.address, 'Medical Center') as "clinicAddress",
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
            ST_SetSRID(ST_MakePoint(d.longitude::float8, d.latitude::float8), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
          ) / 1000.0)::numeric,
          2
        )::float as "distanceKm"
      FROM doctors d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE ${fbWhere}
      ORDER BY "distanceKm" ASC
      LIMIT $${fbParams.length + 1} OFFSET $${fbParams.length + 2}
    `;

    const fbRes = await pool.query(fbDataQuery, [...fbParams, limit, offset]);
    rows = fbRes.rows;
    total = rows.length;
  }

  const results: NearbyDoctorResult[] = rows.map((r: any) => ({
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
    address: r.clinicAddress,
    state: r.state,
    pincode: r.pincode,
    consultationFee: r.consultationFee,
    experience: r.experience,
    bio: r.bio,
    rating: r.rating,
    reviewCount: r.reviewCount ?? 0,
    availableDays: r.availableDays
      ? Array.isArray(r.availableDays)
        ? r.availableDays
        : typeof r.availableDays === "string"
        ? r.availableDays.trim().startsWith("[")
          ? (() => { try { return JSON.parse(r.availableDays); } catch { return [r.availableDays]; } })()
          : r.availableDays.split(",").map((s: string) => s.trim())
        : null
      : null,
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
      ST_SetSRID(ST_MakePoint(dc.longitude::float8, dc.latitude::float8), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
      $3::float8
    )
  `;

  if (service && service.trim() && service !== "all") {
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
          ST_SetSRID(ST_MakePoint(dc.longitude::float8, dc.latitude::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
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
      ST_SetSRID(ST_MakePoint(p.longitude::float8, p.latitude::float8), 4326)::geography,
      ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography,
      $3::float8
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
            ST_SetSRID(ST_MakePoint(p.longitude::float8, p.latitude::float8), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
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
            ST_SetSRID(ST_MakePoint(p.longitude::float8, p.latitude::float8), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
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

export const DEMO_HOSPITALS_LIST = [
  {
    id: 101,
    name: "Arogyagenie Super Specialty Hospital (Demo 1)",
    phone: "+91 98300 11001",
    emergencyHelpline: "108 / +91 98300 11001",
    address: "VIP Road, Block A, Lake Town, Kolkata - 700089",
    city: "Kolkata",
    latitude: 22.5980,
    longitude: 88.4020,
    availableBeds: 48,
    totalBeds: 120,
    rating: 4.8,
    openingHours: "24x7 Emergency & Inpatient Care",
    departments: ["Emergency & Trauma", "Cardiology", "General Medicine", "Obstetrics & Gynecology", "Orthopedics"],
    specialties: [
      { name: "General Medicine", availableBeds: 18, totalBeds: 40 },
      { name: "Cardiology & ICU", availableBeds: 12, totalBeds: 30 },
      { name: "Gynecology & Maternity", availableBeds: 10, totalBeds: 25 },
      { name: "Orthopedics", availableBeds: 8, totalBeds: 25 },
    ],
  },
  {
    id: 102,
    name: "Arogyagenie City Care Hospital (Demo 2)",
    phone: "+91 98300 11002",
    emergencyHelpline: "108 / +91 98300 11002",
    address: "Sector V, Salt Lake Electronics Complex, Kolkata - 700091",
    city: "Kolkata",
    latitude: 22.5830,
    longitude: 88.4310,
    availableBeds: 35,
    totalBeds: 90,
    rating: 4.7,
    openingHours: "24x7 Emergency & Critical Care",
    departments: ["Cardiology", "General Physician", "Pediatrics", "Critical Care ICU"],
    specialties: [
      { name: "General Physician", availableBeds: 14, totalBeds: 35 },
      { name: "Cardiology", availableBeds: 9, totalBeds: 25 },
      { name: "Pediatrics & Neonatal", availableBeds: 12, totalBeds: 30 },
    ],
  },
  {
    id: 103,
    name: "Arogyagenie Metro Health Institute (Demo 3)",
    phone: "+91 98300 11003",
    emergencyHelpline: "108 / +91 98300 11003",
    address: "Park Street Extension, Central Kolkata - 700016",
    city: "Kolkata",
    latitude: 22.5540,
    longitude: 88.3520,
    availableBeds: 62,
    totalBeds: 160,
    rating: 4.9,
    openingHours: "24x7 Level-1 Trauma & Multispecialty",
    departments: ["General Medicine", "Cardiology & CCU", "Neurology", "Obstetrics & Gynecology"],
    specialties: [
      { name: "General Physician", availableBeds: 25, totalBeds: 60 },
      { name: "Cardiology & CCU", availableBeds: 15, totalBeds: 40 },
      { name: "Neurology & Stroke Unit", availableBeds: 10, totalBeds: 30 },
      { name: "Gynecology", availableBeds: 12, totalBeds: 30 },
    ],
  },
  {
    id: 104,
    name: "Arogyagenie Riverside Medical Center (Demo 4)",
    phone: "+91 98300 11004",
    emergencyHelpline: "108 / +91 98300 11004",
    address: "Grand Trunk Road South, Howrah - 711101",
    city: "Howrah",
    latitude: 22.5920,
    longitude: 88.3240,
    availableBeds: 28,
    totalBeds: 75,
    rating: 4.6,
    openingHours: "24x7 Emergency & General Healthcare",
    departments: ["General Medicine", "Emergency & Trauma", "Pulmonology"],
    specialties: [
      { name: "General Medicine", availableBeds: 12, totalBeds: 30 },
      { name: "Emergency & Trauma", availableBeds: 8, totalBeds: 20 },
      { name: "Pulmonology & Respiratory", availableBeds: 8, totalBeds: 25 },
    ],
  },
  {
    id: 105,
    name: "Arogyagenie Apex Multispecialty Hospital (Demo 5)",
    phone: "+91 98300 11005",
    emergencyHelpline: "108 / +91 98300 11005",
    address: "Jessore Road, Near Cantonment, Dum Dum - 700028",
    city: "Kolkata",
    latitude: 22.6450,
    longitude: 88.4190,
    availableBeds: 54,
    totalBeds: 140,
    rating: 4.8,
    openingHours: "24x7 Comprehensive Multispecialty Hospital",
    departments: ["General Physician", "Cardiology", "Nephrology & Dialysis", "Gynecology"],
    specialties: [
      { name: "General Physician", availableBeds: 20, totalBeds: 50 },
      { name: "Cardiology", availableBeds: 14, totalBeds: 40 },
      { name: "Nephrology & Dialysis", availableBeds: 10, totalBeds: 25 },
      { name: "Gynecology", availableBeds: 10, totalBeds: 25 },
    ],
  },
];

export async function searchNearbyHospitals(options: {
  lat: number;
  lng: number;
  radiusKm: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: NearbyHospitalResult[]; total: number }> {
  const { lat, lng, radiusKm, search, limit = 50, offset = 0 } = options;

  function calcHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  let mapped: NearbyHospitalResult[] = DEMO_HOSPITALS_LIST.map((h) => {
    const dist = calcHaversine(lat, lng, h.latitude, h.longitude);
    return {
      id: h.id,
      type: "hospital",
      name: h.name,
      phone: h.phone,
      emergencyHelpline: h.emergencyHelpline,
      address: h.address,
      city: h.city,
      openingHours: h.openingHours,
      rating: h.rating,
      availableBeds: h.availableBeds,
      totalBeds: h.totalBeds,
      departments: h.departments,
      specialties: h.specialties,
      latitude: h.latitude,
      longitude: h.longitude,
      distanceKm: dist,
      distanceType: "straight_line_geographic",
    };
  });

  if (search && search.trim()) {
    const s = search.toLowerCase().trim();
    mapped = mapped.filter(
      (h) =>
        h.name.toLowerCase().includes(s) ||
        (h.address && h.address.toLowerCase().includes(s)) ||
        (h.city && h.city.toLowerCase().includes(s)) ||
        (h.departments && h.departments.some((d) => d.toLowerCase().includes(s))) ||
        (h.specialties && h.specialties.some((sp) => sp.name.toLowerCase().includes(s))),
    );
  }

  // Filter within radiusKm (if none inside radius, fallback to all matching sorted by distance)
  let filtered = mapped.filter((h) => h.distanceKm <= radiusKm);
  if (filtered.length === 0 && mapped.length > 0) {
    filtered = mapped;
  }

  filtered.sort((a, b) => a.distanceKm - b.distanceKm);

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return { results: paginated, total };
}


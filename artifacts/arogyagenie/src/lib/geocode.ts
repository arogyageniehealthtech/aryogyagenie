/**
 * Unified Geocoding Engine for ArogyaGenie Frontend
 *
 * Tier 1: Instant Offline High-Precision Locality & Pincode Dictionary
 * Tier 2: Google Maps Geocoder API (if loaded)
 * Tier 3: Backend /api/geocode endpoint (which uses multi-tiered backend location service)
 * Tier 4: OpenStreetMap / Nominatim fallback
 */

export const LOCALITY_COORDINATES: Record<string, { lat: number; lng: number; displayName: string }> = {
  // Lake Town & Dum Dum & Baguiati & Bangur
  "477, swamiji sarani": { lat: 22.6100, lng: 88.4050, displayName: "Swamiji Sarani, South Dum Dum, Kolkata" },
  "swamiji sarani": { lat: 22.6100, lng: 88.4050, displayName: "Swamiji Sarani, South Dum Dum, Kolkata" },
  "700048": { lat: 22.6100, lng: 88.4050, displayName: "South Dum Dum / Lake Town (700048), Kolkata" },
  "bangur avenue": { lat: 22.6050, lng: 88.4080, displayName: "Bangur Avenue, Kolkata" },
  "bangur": { lat: 22.6050, lng: 88.4080, displayName: "Bangur, Kolkata" },
  "700055": { lat: 22.6050, lng: 88.4080, displayName: "Bangur Avenue (700055), Kolkata" },
  "dum dum park": { lat: 22.6120, lng: 88.4110, displayName: "Dum Dum Park, Kolkata" },
  "700074": { lat: 22.6120, lng: 88.4110, displayName: "Dum Dum Park (700074), Kolkata" },
  "nagerbazar": { lat: 22.6300, lng: 88.4180, displayName: "Nagerbazar, Kolkata" },
  "700028": { lat: 22.6521, lng: 88.4360, displayName: "Dum Dum Cantonment (700028), Kolkata" },
  "700079": { lat: 22.6450, lng: 88.4250, displayName: "Motijheel / Dum Dum (700079), Kolkata" },
  "700052": { lat: 22.6500, lng: 88.4450, displayName: "Kolkata Airport / Dum Dum (700052)" },
  "airport": { lat: 22.6500, lng: 88.4450, displayName: "Netaji Subhash Chandra Bose Airport, Kolkata" },
  "patipukur": { lat: 22.6000, lng: 88.3900, displayName: "Patipukur, Kolkata" },
  "dakshindari": { lat: 22.6020, lng: 88.3980, displayName: "Dakshindari, Lake Town, Kolkata" },
  "lake town": { lat: 22.6057, lng: 88.4030, displayName: "Lake Town, Kolkata" },
  "laketown": { lat: 22.6057, lng: 88.4030, displayName: "Lake Town, Kolkata" },
  "700089": { lat: 22.6057, lng: 88.4030, displayName: "Lake Town (700089), Kolkata" },
  "south dumdum": { lat: 22.6100, lng: 88.4050, displayName: "South Dumdum, Kolkata" },
  "south dum dum": { lat: 22.6100, lng: 88.4050, displayName: "South Dumdum, Kolkata" },
  "dum dum": { lat: 22.6521, lng: 88.4360, displayName: "Dum Dum, Kolkata" },
  "dumdum": { lat: 22.6521, lng: 88.4360, displayName: "Dum Dum, Kolkata" },
  "baguiati": { lat: 22.6185, lng: 88.4285, displayName: "Baguiati, Kolkata" },
  "baguihati": { lat: 22.6185, lng: 88.4285, displayName: "Baguiati, Kolkata" },
  "700059": { lat: 22.6185, lng: 88.4285, displayName: "Baguiati (700059), Kolkata" },
  "kestopur": { lat: 22.5932, lng: 88.4290, displayName: "Kestopur, Kolkata" },
  "krishnapur": { lat: 22.5932, lng: 88.4290, displayName: "Kestopur, Kolkata" },
  "700101": { lat: 22.5932, lng: 88.4290, displayName: "Kestopur (700101), Kolkata" },

  // Salt Lake (Bidhannagar) & New Town
  "salt lake sector v": { lat: 22.5794, lng: 88.4345, displayName: "Salt Lake Sector V, Kolkata" },
  "salt lake sector 5": { lat: 22.5794, lng: 88.4345, displayName: "Salt Lake Sector 5, Kolkata" },
  "sector v": { lat: 22.5794, lng: 88.4345, displayName: "Sector V, Salt Lake, Kolkata" },
  "sector 5": { lat: 22.5794, lng: 88.4345, displayName: "Sector 5, Salt Lake, Kolkata" },
  "700091": { lat: 22.5794, lng: 88.4345, displayName: "Salt Lake Sector V (700091), Kolkata" },
  "salt lake sector 1": { lat: 22.5912, lng: 88.4089, displayName: "Salt Lake Sector 1, Kolkata" },
  "salt lake sector i": { lat: 22.5912, lng: 88.4089, displayName: "Salt Lake Sector 1, Kolkata" },
  "700064": { lat: 22.5912, lng: 88.4089, displayName: "Salt Lake Sector 1 (700064), Kolkata" },
  "salt lake sector 2": { lat: 22.5834, lng: 88.4123, displayName: "Salt Lake Sector 2, Kolkata" },
  "salt lake sector ii": { lat: 22.5834, lng: 88.4123, displayName: "Salt Lake Sector 2, Kolkata" },
  "salt lake sector 3": { lat: 22.5712, lng: 88.4150, displayName: "Salt Lake Sector 3, Kolkata" },
  "salt lake sector iii": { lat: 22.5712, lng: 88.4150, displayName: "Salt Lake Sector 3, Kolkata" },
  "700106": { lat: 22.5712, lng: 88.4150, displayName: "Salt Lake Sector 3 (700106), Kolkata" },
  "salt lake": { lat: 22.5834, lng: 88.4123, displayName: "Salt Lake, Kolkata" },
  "saltlake": { lat: 22.5834, lng: 88.4123, displayName: "Salt Lake, Kolkata" },
  "bidhannagar": { lat: 22.5834, lng: 88.4123, displayName: "Bidhannagar, Kolkata" },
  "new town": { lat: 22.5898, lng: 88.4744, displayName: "New Town, Kolkata" },
  "newtown": { lat: 22.5898, lng: 88.4744, displayName: "New Town, Kolkata" },
  "700156": { lat: 22.5898, lng: 88.4744, displayName: "New Town Action Area 1 (700156)" },
  "700160": { lat: 22.5950, lng: 88.4820, displayName: "New Town Action Area 2 (700160)" },
  "rajarhat": { lat: 22.6120, lng: 88.4890, displayName: "Rajarhat, Kolkata" },
  "700135": { lat: 22.6120, lng: 88.4890, displayName: "Rajarhat (700135), Kolkata" },

  // Central, North & South Kolkata
  "park street": { lat: 22.5532, lng: 88.3512, displayName: "Park Street, Kolkata" },
  "700016": { lat: 22.5532, lng: 88.3512, displayName: "Park Street (700016), Kolkata" },
  "park circus": { lat: 22.5441, lng: 88.3689, displayName: "Park Circus, Kolkata" },
  "700017": { lat: 22.5441, lng: 88.3689, displayName: "Park Circus (700017), Kolkata" },
  "shyambazar": { lat: 22.5998, lng: 88.3712, displayName: "Shyambazar, Kolkata" },
  "700004": { lat: 22.5998, lng: 88.3712, displayName: "Shyambazar (700004), Kolkata" },
  "bhowanipore": { lat: 22.5354, lng: 88.3472, displayName: "Bhowanipore, Kolkata" },
  "bhawanipur": { lat: 22.5354, lng: 88.3472, displayName: "Bhowanipore, Kolkata" },
  "700020": { lat: 22.5354, lng: 88.3472, displayName: "Bhowanipore (700020), Kolkata" },
  "garia": { lat: 22.4678, lng: 88.3956, displayName: "Garia, Kolkata" },
  "700084": { lat: 22.4678, lng: 88.3956, displayName: "Garia (700084), Kolkata" },
  "gariahat": { lat: 22.5189, lng: 88.3654, displayName: "Gariahat, Kolkata" },
  "700019": { lat: 22.5189, lng: 88.3654, displayName: "Gariahat (700019), Kolkata" },
  "jadavpur": { lat: 22.4988, lng: 88.3718, displayName: "Jadavpur, Kolkata" },
  "700032": { lat: 22.4988, lng: 88.3718, displayName: "Jadavpur (700032), Kolkata" },
  "behala": { lat: 22.4988, lng: 88.3188, displayName: "Behala, Kolkata" },
  "700034": { lat: 22.4988, lng: 88.3188, displayName: "Behala (700034), Kolkata" },
  "baranagar": { lat: 22.6417, lng: 88.3742, displayName: "Baranagar, Kolkata" },
  "700036": { lat: 22.6417, lng: 88.3742, displayName: "Baranagar (700036), Kolkata" },
  "belgharia": { lat: 22.6625, lng: 88.3840, displayName: "Belgharia, Kolkata" },
  "700056": { lat: 22.6625, lng: 88.3840, displayName: "Belgharia (700056), Kolkata" },
  "howrah": { lat: 22.5958, lng: 88.2636, displayName: "Howrah" },
  "711101": { lat: 22.5958, lng: 88.2636, displayName: "Howrah (711101)" },
  "alipore": { lat: 22.5323, lng: 88.3289, displayName: "Alipore, Kolkata" },
  "700027": { lat: 22.5323, lng: 88.3289, displayName: "Alipore (700027), Kolkata" },
  "ballygunge": { lat: 22.5280, lng: 88.3650, displayName: "Ballygunge, Kolkata" },
  "ruby": { lat: 22.5123, lng: 88.3912, displayName: "Ruby Hospital Area, Kolkata" },
  "700107": { lat: 22.5123, lng: 88.3912, displayName: "Ruby / Kasba (700107), Kolkata" },
  "tollygunge": { lat: 22.4967, lng: 88.3456, displayName: "Tollygunge, Kolkata" },
  "700033": { lat: 22.4967, lng: 88.3456, displayName: "Tollygunge (700033), Kolkata" },
  "sealdah": { lat: 22.5697, lng: 88.3702, displayName: "Sealdah, Kolkata" },
  "700014": { lat: 22.5697, lng: 88.3702, displayName: "Sealdah (700014), Kolkata" },
  "esplanade": { lat: 22.5645, lng: 88.3524, displayName: "Esplanade, Kolkata" },
  "700069": { lat: 22.5645, lng: 88.3524, displayName: "Esplanade (700069), Kolkata" },
  "barasat": { lat: 22.7230, lng: 88.4800, displayName: "Barasat" },
  "700124": { lat: 22.7230, lng: 88.4800, displayName: "Barasat (700124)" },
  "kolkata": { lat: 22.5726, lng: 88.3639, displayName: "Kolkata, West Bengal" },
  "calcutta": { lat: 22.5726, lng: 88.3639, displayName: "Kolkata, West Bengal" },

  // Metros
  "new delhi": { lat: 28.6139, lng: 77.2090, displayName: "New Delhi, Delhi" },
  "delhi": { lat: 28.6139, lng: 77.2090, displayName: "Delhi" },
  "bengaluru": { lat: 12.9716, lng: 77.5946, displayName: "Bengaluru, Karnataka" },
  "bangalore": { lat: 12.9716, lng: 77.5946, displayName: "Bengaluru, Karnataka" },
  "mumbai": { lat: 19.0760, lng: 72.8777, displayName: "Mumbai, Maharashtra" },
  "hyderabad": { lat: 17.3850, lng: 78.4867, displayName: "Hyderabad, Telangana" },
  "chennai": { lat: 13.0827, lng: 80.2707, displayName: "Chennai, Tamil Nadu" },
};

export interface GeocodeOutput {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * High-reliability multi-tiered forward geocoding
 */
export async function detectAddressCoordinates(addressText: string): Promise<GeocodeOutput | null> {
  const query = addressText.trim();
  if (!query) return null;

  const lower = query.toLowerCase();

  // Tier 1: High-precision offline dictionary matching (sorted by key length descending)
  const sortedKeys = Object.keys(LOCALITY_COORDINATES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      const match = LOCALITY_COORDINATES[key];
      return {
        lat: match.lat,
        lng: match.lng,
        displayName: match.displayName,
      };
    }
  }

  // Tier 2: Backend /api/geocode endpoint
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.lat === "number" && typeof data.lng === "number" && (data.lat !== 0 || data.lng !== 0)) {
        return {
          lat: data.lat,
          lng: data.lng,
          displayName: data.displayName || query,
        };
      }
    }
  } catch {
    // Continue to next tier
  }

  // Tier 3: OpenStreetMap / Nominatim fallback
  try {
    const nominatimQueries = [
      query,
      `${query}, Kolkata, West Bengal`,
      `${query}, India`,
    ];

    for (const nq of nominatimQueries) {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nq)}&format=json&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "ArogyaGenie/1.0" },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
          return {
            lat,
            lng,
            displayName: data[0].display_name.split(",").slice(0, 3).join(", "),
          };
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // Default fallback: Kolkata regional anchor
  return {
    lat: 22.5726,
    lng: 88.3639,
    displayName: `${query} (Kolkata Region)`,
  };
}

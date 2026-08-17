import { HospitalItem } from "../types/hospital";

export const HOSPITAL_SEARCH_RADIUS_KM = 18;

/**
 * Computes geodesic distance in kilometers between two latitude/longitude points.
 */
export function calculateHaversineDistanceKm(
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
  return Math.round(R * c * 10) / 10;
}

/**
 * 5 Clearly Marked DEMO / Mock Hospitals with realistic coordinates around Kolkata
 * and specialty-level available bed capacity data.
 */
export const DEMO_HOSPITALS: HospitalItem[] = [
  {
    id: 101,
    name: "Arogyagenie Super Specialty Hospital (Demo 1)",
    phone: "+91 98300 11001",
    emergencyHelpline: "108 / +91 98300 11001",
    address: "VIP Road, Block A, Lake Town, Kolkata - 700089",
    city: "Kolkata",
    latitude: 22.5980,
    longitude: 88.4020,
    isOnboarded: true,
    availableBeds: 48,
    totalBeds: 120,
    rating: 4.8,
    openingHours: "24x7 Emergency & Inpatient Care",
    organizationId: "org-hosp-demo-001",
    departments: ["Emergency & Trauma", "Cardiology", "General Medicine", "Obstetrics & Gynecology", "Orthopedics"],
    specialties: [
      { name: "General Medicine", availableBeds: 18, totalBeds: 40 },
      { name: "Cardiology & ICU", availableBeds: 12, totalBeds: 30 },
      { name: "Gynecology & Maternity", availableBeds: 10, totalBeds: 25 },
      { name: "Orthopedics", availableBeds: 8, totalBeds: 25 },
    ],
    adminStaff: [
      { id: "staff-01", name: "Dr. A. Sengupta (Chief Medical Officer)", role: "hospital_admin" },
      { id: "staff-02", name: "Sister R. Mukherjee (Head Nurse)", role: "nurse" },
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
    isOnboarded: true,
    availableBeds: 35,
    totalBeds: 90,
    rating: 4.7,
    openingHours: "24x7 Emergency & Critical Care",
    organizationId: "org-hosp-demo-002",
    departments: ["Cardiology", "General Physician", "Pediatrics", "Critical Care ICU"],
    specialties: [
      { name: "General Physician", availableBeds: 14, totalBeds: 35 },
      { name: "Cardiology", availableBeds: 9, totalBeds: 25 },
      { name: "Pediatrics & Neonatal", availableBeds: 12, totalBeds: 30 },
    ],
    adminStaff: [
      { id: "staff-03", name: "Dr. P. Roy (Medical Director)", role: "hospital_admin" },
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
    isOnboarded: true,
    availableBeds: 62,
    totalBeds: 160,
    rating: 4.9,
    openingHours: "24x7 Level-1 Trauma & Multispecialty",
    organizationId: "org-hosp-demo-003",
    departments: ["General Medicine", "Cardiology & CCU", "Neurology", "Obstetrics & Gynecology"],
    specialties: [
      { name: "General Physician", availableBeds: 25, totalBeds: 60 },
      { name: "Cardiology & CCU", availableBeds: 15, totalBeds: 40 },
      { name: "Neurology & Stroke Unit", availableBeds: 10, totalBeds: 30 },
      { name: "Gynecology", availableBeds: 12, totalBeds: 30 },
    ],
    adminStaff: [
      { id: "staff-04", name: "Dr. S. Chatterjee (Operations Head)", role: "hospital_admin" },
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
    isOnboarded: true,
    availableBeds: 28,
    totalBeds: 75,
    rating: 4.6,
    openingHours: "24x7 Emergency & General Healthcare",
    organizationId: "org-hosp-demo-004",
    departments: ["General Medicine", "Emergency & Trauma", "Pulmonology"],
    specialties: [
      { name: "General Medicine", availableBeds: 12, totalBeds: 30 },
      { name: "Emergency & Trauma", availableBeds: 8, totalBeds: 20 },
      { name: "Pulmonology & Respiratory", availableBeds: 8, totalBeds: 25 },
    ],
    adminStaff: [
      { id: "staff-05", name: "Dr. M. Banerjee (Superintendent)", role: "hospital_admin" },
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
    isOnboarded: true,
    availableBeds: 54,
    totalBeds: 140,
    rating: 4.8,
    openingHours: "24x7 Comprehensive Multispecialty Hospital",
    organizationId: "org-hosp-demo-005",
    departments: ["General Physician", "Cardiology", "Nephrology & Dialysis", "Gynecology"],
    specialties: [
      { name: "General Physician", availableBeds: 20, totalBeds: 50 },
      { name: "Cardiology", availableBeds: 14, totalBeds: 40 },
      { name: "Nephrology & Dialysis", availableBeds: 10, totalBeds: 25 },
      { name: "Gynecology", availableBeds: 10, totalBeds: 25 },
    ],
    adminStaff: [
      { id: "staff-06", name: "Dr. K. Dutta (Director)", role: "hospital_admin" },
    ],
  },
];

/**
 * Returns demo hospitals with calculated distance from the patient's coordinates,
 * filtered to within the specified radius (default 18 km).
 */
export function getDemoHospitalsWithinRadius(
  userLat: number,
  userLng: number,
  radiusKm = HOSPITAL_SEARCH_RADIUS_KM,
): HospitalItem[] {
  return DEMO_HOSPITALS.map((h) => {
    const dist = calculateHaversineDistanceKm(userLat, userLng, h.latitude, h.longitude);
    return {
      ...h,
      distanceKm: dist,
    };
  })
    .filter((h) => (h.distanceKm ?? 0) <= radiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

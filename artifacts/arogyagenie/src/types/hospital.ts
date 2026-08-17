export interface HospitalSpecialtyBedInfo {
  name: string;
  availableBeds: number;
  totalBeds?: number;
}

export interface HospitalItem {
  id: number;
  name: string;
  phone: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  isOnboarded: boolean;
  availableBeds: number;
  totalBeds?: number;
  departments: string[];
  specialties: HospitalSpecialtyBedInfo[];
  emergencyHelpline?: string;
  rating?: number;
  openingHours?: string;
  // Staff & organization association metadata (Admin Portal compatibility)
  organizationId?: string;
  adminStaff?: Array<{
    id: string;
    name: string;
    role: "hospital_admin" | "doctor" | "nurse" | "receptionist";
  }>;
}

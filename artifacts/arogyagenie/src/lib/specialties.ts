export const DOCTOR_SPECIALTIES = [
  "General Physician",
  "Internal Medicine",
  "Cardiologist",
  "ENT",
  "Neurologist",
  "Orthopedist",
  "Pediatrician",
  "Gynecologist",
  "Dermatologist",
  "Pulmonologist",
  "Gastroenterologist",
  "Endocrinologist",
  "Nephrologist",
  "Oncologist",
  "Urologist",
  "Dentist",
  "Surgeon",
  "Other"
] as const;

export type DoctorSpecialty = typeof DOCTOR_SPECIALTIES[number];

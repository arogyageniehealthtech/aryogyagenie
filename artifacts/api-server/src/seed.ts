import { db, doctorsTable, pharmaciesTable, diagnosticCentersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function seedCoordinates() {
  console.log("Seeding coordinates for database providers...");

  const doctorCoords = [
    { lat: 22.5726, lng: 88.3639, clinicAddress: "Park Street Medical Hub, Kolkata", city: "Kolkata" },
    { lat: 22.5851, lng: 88.3476, clinicAddress: "Shyambazar Health Clinic, Kolkata", city: "Kolkata" },
    { lat: 22.5354, lng: 88.3472, clinicAddress: "Bhowanipore General Clinic, Kolkata", city: "Kolkata" },
    { lat: 22.5794, lng: 88.4345, clinicAddress: "Salt Lake Sector V Care, Kolkata", city: "Kolkata" },
    { lat: 22.5123, lng: 88.3912, clinicAddress: "Ruby General Hospital Area, Kolkata", city: "Kolkata" },
    { lat: 28.6139, lng: 77.2090, clinicAddress: "Connaught Place Health Hub, New Delhi", city: "New Delhi" },
    { lat: 12.9716, lng: 77.5946, clinicAddress: "MG Road Medical Center, Bengaluru", city: "Bengaluru" },
  ];

  const pharmacyCoords = [
    { name: "MedPlus Pharmacy Park Street", address: "12 Park Street, Kolkata", city: "Kolkata", lat: 22.5532, lng: 88.3512, phone: "+91 9830112233" },
    { name: "Apollo Pharmacy Salt Lake", address: "Block CL, Sector II, Salt Lake, Kolkata", city: "Kolkata", lat: 22.5834, lng: 88.4123, phone: "+91 9830223344" },
    { name: "Frank Ross Pharmacy Gariahat", address: "45 Gariahat Road, Kolkata", city: "Kolkata", lat: 22.5189, lng: 88.3654, phone: "+91 9830334455" },
    { name: "Sanjivani Pharmacy New Delhi", address: "18 Connaught Circle, New Delhi", city: "New Delhi", lat: 28.6289, lng: 77.2189, phone: "+91 9811122334" },
  ];

  const diagnosticCoords = [
    { name: "Suraksha Diagnostics Salt Lake", address: "DD 18/1 Sector 1, Salt Lake, Kolkata", city: "Kolkata", lat: 22.5912, lng: 88.4089, phone: "+91 33 6619 1000", rating: 4.7 },
    { name: "Dr. Lal PathLabs Park Circus", address: "4 Park Circus Connector, Kolkata", city: "Kolkata", lat: 22.5441, lng: 88.3689, phone: "+91 33 3988 5050", rating: 4.8 },
    { name: "Thyrocare Diagnostics Garia", address: "Garia Main Road, Kolkata", city: "Kolkata", lat: 22.4678, lng: 88.3956, phone: "+91 33 4000 8000", rating: 4.6 },
  ];

  // 1. Update Doctors
  const doctors = await db.select().from(doctorsTable);
  for (let i = 0; i < doctors.length; i++) {
    const doc = doctors[i];
    const coord = doctorCoords[i % doctorCoords.length];
    await db.update(doctorsTable).set({
      latitude: doc.latitude || coord.lat,
      longitude: doc.longitude || coord.lng,
      clinicAddress: doc.clinicAddress || coord.clinicAddress,
      status: "active",
    }).where(eq(doctorsTable.id, doc.id));
  }

  // 2. Ensure Pharmacies
  const existingPharms = await db.select().from(pharmaciesTable);
  if (existingPharms.length === 0) {
    let user = await db.query.usersTable.findFirst({ where: eq(usersTable.role, "pharmacy") });
    if (!user) {
      [user] = await db.insert(usersTable).values({
        clerkId: `demo_pharmacy_${Date.now()}`,
        email: "pharmacy.demo@arogyagenie.com",
        firstName: "MedPlus",
        lastName: "Pharmacy",
        role: "pharmacy",
        status: "active",
      }).returning();
    }
    for (const p of pharmacyCoords) {
      await db.insert(pharmaciesTable).values({
        userId: user.id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        city: p.city,
        latitude: p.lat,
        longitude: p.lng,
        openingHours: "08:00 AM - 10:00 PM",
        status: "active",
      });
    }
  } else {
    for (let i = 0; i < existingPharms.length; i++) {
      const p = existingPharms[i];
      const coord = pharmacyCoords[i % pharmacyCoords.length];
      await db.update(pharmaciesTable).set({
        latitude: p.latitude || coord.lat,
        longitude: p.longitude || coord.lng,
        status: "active",
      }).where(eq(pharmaciesTable.id, p.id));
    }
  }

  // 3. Ensure Diagnostic Centers
  const existingDiags = await db.select().from(diagnosticCentersTable);
  if (existingDiags.length === 0) {
    let user = await db.query.usersTable.findFirst({ where: eq(usersTable.role, "diagnostic_center") });
    if (!user) {
      [user] = await db.insert(usersTable).values({
        clerkId: `demo_diag_${Date.now()}`,
        email: "diagnostic.demo@arogyagenie.com",
        firstName: "Suraksha",
        lastName: "Diagnostics",
        role: "diagnostic_center",
        status: "active",
      }).returning();
    }
    for (const d of diagnosticCoords) {
      await db.insert(diagnosticCentersTable).values({
        userId: user.id,
        name: d.name,
        phone: d.phone,
        address: d.address,
        city: d.city,
        latitude: d.lat,
        longitude: d.lng,
        openingHours: "07:00 AM - 09:00 PM",
        rating: d.rating,
        status: "active",
      });
    }
  } else {
    for (let i = 0; i < existingDiags.length; i++) {
      const d = existingDiags[i];
      const coord = diagnosticCoords[i % diagnosticCoords.length];
      await db.update(diagnosticCentersTable).set({
        latitude: d.latitude || coord.lat,
        longitude: d.longitude || coord.lng,
        status: "active",
      }).where(eq(diagnosticCentersTable.id, d.id));
    }
  }

  console.log("Database provider coordinates seeded successfully!");
}

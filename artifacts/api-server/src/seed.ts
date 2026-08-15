import {
  db,
  pool,
  doctorsTable,
  pharmaciesTable,
  diagnosticCentersTable,
  usersTable,
  medicinesTable,
  pharmacyInventoryTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

import { syncAllProviderCoordinates } from "./lib/locationService";

export async function seedCoordinates() {
  console.log("Seeding coordinates and spatial data for database providers...");

  // 0. Ensure PostGIS Extension & Spatial Indexes
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS postgis");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_geo ON doctors USING gist (
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
      ) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pharmacies_geo ON pharmacies USING gist (
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
      ) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_geo ON diagnostic_centers USING gist (
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
      ) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);
    console.log("✅ PostGIS spatial GiST indexes ensured on startup.");
  } catch (err: any) {
    console.warn("Spatial index startup warning:", err?.message);
  }

  const doctorCoords = [
    { lat: 22.5726, lng: 88.3639, clinicAddress: "Park Street Medical Hub, 14 Park Street", city: "Kolkata", state: "West Bengal", pincode: "700016" },
    { lat: 22.5851, lng: 88.3476, clinicAddress: "Shyambazar Health Clinic, 22 Bidhan Sarani", city: "Kolkata", state: "West Bengal", pincode: "700004" },
    { lat: 22.5354, lng: 88.3472, clinicAddress: "Bhowanipore General Clinic, 5 Ashutosh Mukherjee Rd", city: "Kolkata", state: "West Bengal", pincode: "700020" },
    { lat: 22.5794, lng: 88.4345, clinicAddress: "Salt Lake Sector V Care, Block EP & GP", city: "Kolkata", state: "West Bengal", pincode: "700091" },
    { lat: 22.5123, lng: 88.3912, clinicAddress: "Ruby General Hospital Area, EM Bypass", city: "Kolkata", state: "West Bengal", pincode: "700107" },
    { lat: 28.6139, lng: 77.2090, clinicAddress: "Connaught Place Health Hub, Inner Circle", city: "New Delhi", state: "Delhi", pincode: "110001" },
    { lat: 12.9716, lng: 77.5946, clinicAddress: "MG Road Medical Center, 44 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  ];

  const pharmacyCoords = [
    { name: "MedPlus Pharmacy Park Street", address: "12 Park Street, Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700016", lat: 22.5532, lng: 88.3512, phone: "+91 9830112233" },
    { name: "Apollo Pharmacy Salt Lake", address: "Block CL, Sector II, Salt Lake, Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700091", lat: 22.5834, lng: 88.4123, phone: "+91 9830223344" },
    { name: "Frank Ross Pharmacy Gariahat", address: "45 Gariahat Road, Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700019", lat: 22.5189, lng: 88.3654, phone: "+91 9830334455" },
    { name: "Sanjivani Pharmacy New Delhi", address: "18 Connaught Circle, New Delhi", city: "New Delhi", state: "Delhi", pincode: "110001", lat: 28.6289, lng: 77.2189, phone: "+91 9811122334" },
  ];

  const diagnosticCoords = [
    { name: "Suraksha Diagnostics Salt Lake", address: "DD 18/1 Sector 1, Salt Lake, Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700064", lat: 22.5912, lng: 88.4089, phone: "+91 33 6619 1000", rating: 4.7, services: "Complete Blood Count (CBC), Lipid Profile, Liver Function Test (LFT), Thyroid Profile, MRI, CT Scan" },
    { name: "Dr. Lal PathLabs Park Circus", address: "4 Park Circus Connector, Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700017", lat: 22.5441, lng: 88.3689, phone: "+91 33 3988 5050", rating: 4.8, services: "Blood Test, Urine Routine, HbA1c, Vitamin D, Dengue Serology, Fasting Blood Sugar" },
    { name: "Thyrocare Diagnostics Garia", address: "Garia Main Road, Kolkata", city: "Kolkata", state: "West Bengal", pincode: "700084", lat: 22.4678, lng: 88.3956, phone: "+91 33 4000 8000", rating: 4.6, services: "Aarogyam Full Body Checkup, Thyroid Panel, Kidney Function Test, Lipid Panel, Blood Sugar" },
  ];

  // 1. Update Doctors
  try {
    const doctors = await db.select().from(doctorsTable);
    for (let i = 0; i < doctors.length; i++) {
      const doc = doctors[i];
      const coord = doctorCoords[i % doctorCoords.length];
      await db.update(doctorsTable).set({
        latitude: doc.latitude || coord.lat,
        longitude: doc.longitude || coord.lng,
        clinicAddress: doc.clinicAddress || coord.clinicAddress,
        state: doc.state || coord.state,
        pincode: doc.pincode || coord.pincode,
        status: "active",
      }).where(eq(doctorsTable.id, doc.id));
    }
  } catch (e: any) {
    console.warn("Doctor coordinate update warning:", e?.message);
  }

  // 2. Ensure Pharmacies
  try {
    const existingPharms = await db.select().from(pharmaciesTable);
    if (existingPharms.length === 0) {
      for (let i = 0; i < pharmacyCoords.length; i++) {
        const p = pharmacyCoords[i];
        const email = `pharmacy.seed.${i + 1}@arogyagenie.com`;
        let user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
        if (!user) {
          [user] = await db.insert(usersTable).values({
            clerkId: `demo_pharmacy_${i + 1}_${Date.now()}`,
            email,
            firstName: p.name,
            lastName: "",
            role: "pharmacy",
            status: "active",
          }).returning();
        }
        const existingUserPharm = await db.query.pharmaciesTable.findFirst({ where: eq(pharmaciesTable.userId, user.id) });
        if (!existingUserPharm) {
          await db.insert(pharmaciesTable).values({
            userId: user.id,
            name: p.name,
            phone: p.phone,
            address: p.address,
            city: p.city,
            state: p.state,
            pincode: p.pincode,
            latitude: p.lat,
            longitude: p.lng,
            openingHours: "08:00 AM - 10:00 PM",
            status: "active",
          });
        }
      }
    } else {
      for (let i = 0; i < existingPharms.length; i++) {
        const p = existingPharms[i];
        const coord = pharmacyCoords[i % pharmacyCoords.length];
        await db.update(pharmaciesTable).set({
          latitude: p.latitude || coord.lat,
          longitude: p.longitude || coord.lng,
          state: p.state || coord.state,
          pincode: p.pincode || coord.pincode,
          status: "active",
        }).where(eq(pharmaciesTable.id, p.id));
      }
    }
  } catch (e: any) {
    console.warn("Pharmacy seed warning:", e?.message);
  }

  // 3. Ensure Diagnostic Centers
  try {
    const existingDiags = await db.select().from(diagnosticCentersTable);
    if (existingDiags.length === 0) {
      for (let i = 0; i < diagnosticCoords.length; i++) {
        const d = diagnosticCoords[i];
        const email = `diagnostic.seed.${i + 1}@arogyagenie.com`;
        let user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });
        if (!user) {
          [user] = await db.insert(usersTable).values({
            clerkId: `demo_diag_${i + 1}_${Date.now()}`,
            email,
            firstName: d.name,
            lastName: "",
            role: "diagnostic_center",
            status: "active",
          }).returning();
        }
        const existingUserDiag = await db.query.diagnosticCentersTable.findFirst({ where: eq(diagnosticCentersTable.userId, user.id) });
        if (!existingUserDiag) {
          await db.insert(diagnosticCentersTable).values({
            userId: user.id,
            name: d.name,
            phone: d.phone,
            address: d.address,
            city: d.city,
            state: d.state,
            pincode: d.pincode,
            latitude: d.lat,
            longitude: d.lng,
            services: d.services,
            openingHours: "07:00 AM - 09:00 PM",
            rating: d.rating,
            status: "active",
          });
        }
      }
    } else {
      for (let i = 0; i < existingDiags.length; i++) {
        const d = existingDiags[i];
        const coord = diagnosticCoords[i % diagnosticCoords.length];
        await db.update(diagnosticCentersTable).set({
          latitude: d.latitude || coord.lat,
          longitude: d.longitude || coord.lng,
          state: d.state || coord.state,
          pincode: d.pincode || coord.pincode,
          services: d.services || coord.services,
          status: "active",
        }).where(eq(diagnosticCentersTable.id, d.id));
      }
    }
  } catch (e: any) {
    console.warn("Diagnostic center seed warning:", e?.message);
  }

  // 4. Seed Medicines Catalog & Pharmacy Inventory
  try {
    const catalogMedicines = [
      { name: "Paracetamol 650", genericName: "Acetaminophen 650mg", category: "Analgesics & Antipyretics", manufacturer: "GSK Pharmaceuticals", description: "Relieves mild to moderate pain and fever reduction.", dosageForm: "Tablet", strength: "650mg" },
      { name: "Dolo 650", genericName: "Paracetamol 650mg", category: "Analgesics & Antipyretics", manufacturer: "Micro Labs Ltd", description: "Effective fast-relief antipyretic for high fever and body ache.", dosageForm: "Tablet", strength: "650mg" },
      { name: "Amoxicillin 500mg", genericName: "Amoxicillin Trihydrate", category: "Antibiotics", manufacturer: "Cipla Ltd", description: "Broad-spectrum penicillin antibiotic for bacterial infections.", dosageForm: "Capsule", strength: "500mg" },
      { name: "Azithromycin 500mg", genericName: "Azithromycin", category: "Antibiotics", manufacturer: "Sun Pharma", description: "Macrolide antibiotic for respiratory tract and throat infections.", dosageForm: "Tablet", strength: "500mg" },
      { name: "Pantoprazole 40mg", genericName: "Pantoprazole Sodium", category: "Gastrointestinal", manufacturer: "Alkem Laboratories", description: "Proton pump inhibitor for acidity, GERD, and gastric ulcers.", dosageForm: "Tablet", strength: "40mg" },
      { name: "Cetirizine 10mg", genericName: "Cetirizine Hydrochloride", category: "Antihistamines", manufacturer: "Dr. Reddy's", description: "Non-sedating antihistamine for allergic rhinitis, sneezing, and skin hives.", dosageForm: "Tablet", strength: "10mg" },
      { name: "Metformin 500mg", genericName: "Metformin Hydrochloride", category: "Antidiabetics", manufacturer: "USV Private Ltd", description: "First-line biguanide oral antihyperglycemic for Type 2 Diabetes.", dosageForm: "Tablet", strength: "500mg" },
      { name: "Atorvastatin 20mg", genericName: "Atorvastatin Calcium", category: "Cardiovascular / Lipid-Lowering", manufacturer: "Lupin Ltd", description: "HMG-CoA reductase inhibitor (statin) for cholesterol reduction.", dosageForm: "Tablet", strength: "20mg" },
    ];

    const insertedMeds: any[] = [];
    for (const medData of catalogMedicines) {
      let med = await db.query.medicinesTable.findFirst({
        where: eq(medicinesTable.name, medData.name),
      });
      if (!med) {
        [med] = await db.insert(medicinesTable).values(medData).returning();
      }
      insertedMeds.push(med);
    }

    // Link seeded pharmacies with inventory
    const pharmacies = await db.select().from(pharmaciesTable);
    for (const pharm of pharmacies) {
      for (const med of insertedMeds) {
        const existingInv = await db.query.pharmacyInventoryTable.findFirst({
          where: (t, { and: a, eq: e }) => a(e(t.pharmacyId, pharm.id), e(t.medicineId, med.id)),
        });

        if (!existingInv) {
          const priceMap: Record<string, number> = {
            "Paracetamol 650": 30.50,
            "Dolo 650": 32.00,
            "Amoxicillin 500mg": 75.00,
            "Azithromycin 500mg": 120.00,
            "Pantoprazole 40mg": 95.00,
            "Cetirizine 10mg": 25.00,
            "Metformin 500mg": 45.00,
            "Atorvastatin 20mg": 180.00,
          };
          const price = priceMap[med.name] || 50.00;

          await db.insert(pharmacyInventoryTable).values({
            pharmacyId: pharm.id,
            medicineId: med.id,
            price,
            inStock: true,
            quantity: 50,
          });
        }
      }
    }
    console.log("✅ Medicines catalog and pharmacy inventory seeded successfully!");
  } catch (e: any) {
    console.warn("Medicine/inventory seeding warning:", e?.message);
  }

  // 5. Automatic provider coordinate synchronization for all existing and onboarded providers
  try {
    const stats = await syncAllProviderCoordinates();
    console.log("✅ Provider coordinates synchronization check complete:", stats);
  } catch (e: any) {
    console.warn("Provider coordinates synchronization warning:", e?.message);
  }

  console.log("Database provider coordinates and location discovery system seeded successfully!");
}

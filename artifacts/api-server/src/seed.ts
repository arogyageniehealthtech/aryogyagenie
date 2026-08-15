import {
  db,
  pool,
  medicinesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { syncAllProviderCoordinates } from "./lib/locationService";

export async function seedCoordinates() {
  console.log("Seeding base metadata and spatial infrastructure...");

  // 0. Ensure PostGIS Extension & Spatial GiST Indexes
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

  // 1. Seed Medicines Catalog (Reference catalog for suggestions & search)
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

    for (const medData of catalogMedicines) {
      const existingMed = await db.query.medicinesTable.findFirst({
        where: eq(medicinesTable.name, medData.name),
      });
      if (!existingMed) {
        await db.insert(medicinesTable).values(medData);
      }
    }
    console.log("✅ Reference medicines catalog verified successfully!");
  } catch (e: any) {
    console.warn("Medicine catalog verification warning:", e?.message);
  }

  // 2. Provider coordinate synchronization for real onboarded providers
  try {
    const stats = await syncAllProviderCoordinates();
    console.log("✅ Provider coordinates synchronization check complete:", stats);
  } catch (e: any) {
    console.warn("Provider coordinates synchronization warning:", e?.message);
  }

  console.log("Database spatial infrastructure and catalog ready!");
}

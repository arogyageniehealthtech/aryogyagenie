import { pool } from "@workspace/db";

async function createSpatialIndexes() {
  try {
    console.log("Setting up PostGIS extension & spatial GiST indexes...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS postgis");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_geo ON users USING gist (
        (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
      ) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);

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

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_doctors_status_specialty ON doctors (status, specialty);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pharmacies_status ON pharmacies (status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_diagnostic_centers_status ON diagnostic_centers (status);
    `);

    console.log("✅ PostGIS spatial GiST and B-Tree indexes created successfully!");
  } catch (err: any) {
    console.error("Index creation error:", err.message);
  } finally {
    await pool.end();
  }
}

createSpatialIndexes();

import { pool } from "@workspace/db";

async function main() {
  try {
    const extRes = await pool.query("SELECT extname FROM pg_extension");
    console.log("Installed extensions:", extRes.rows.map((r: any) => r.extname));

    try {
      await pool.query("CREATE EXTENSION IF NOT EXISTS postgis");
      console.log("PostGIS extension enabled successfully!");
      const verRes = await pool.query("SELECT PostGIS_Version()");
      console.log("PostGIS Version:", verRes.rows[0]);
    } catch (e: any) {
      console.log("PostGIS enable error:", e.message);
    }
  } catch (err: any) {
    console.error("DB connection error:", err.message);
  } finally {
    await pool.end();
  }
}

main();

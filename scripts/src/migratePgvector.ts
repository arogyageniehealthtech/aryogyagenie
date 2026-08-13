import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Migration Script: Enables pgvector, creates vector column + HNSW index,
 * and populates vector column from existing JSON embeddings.
 */
export async function runPgvectorMigration() {
  console.log("=================================================");
  console.log("STARTING PGVECTOR DATABASE MIGRATION");
  console.log("=================================================");

  try {
    console.log("1. Enabling PostgreSQL vector extension...");
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("   ✓ Vector extension enabled.");

    console.log("2. Adding vector(768) column to knowledge_chunks and pharmacy_id to prescriptions if missing...");
    await db.execute(sql`
      ALTER TABLE knowledge_chunks 
      ADD COLUMN IF NOT EXISTS embedding_vector vector(768);
      
      ALTER TABLE prescriptions
      ADD COLUMN IF NOT EXISTS pharmacy_id integer;
    `);
    console.log("   ✓ Columns checked/added.");

    console.log("3. Creating HNSW cosine similarity index...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw 
      ON knowledge_chunks USING hnsw (embedding_vector vector_cosine_ops);
    `);
    console.log("   ✓ HNSW vector index created.");

    console.log("4. Migrating JSON embeddings into vector column...");
    const result = await db.execute(sql`
      UPDATE knowledge_chunks 
      SET embedding_vector = embedding::text::vector 
      WHERE embedding_vector IS NULL AND embedding IS NOT NULL;
    `);
    console.log(`   ✓ Data migration complete. Rows updated: ${result.rowCount ?? "N/A"}`);

    const countResult = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count FROM knowledge_chunks WHERE embedding_vector IS NOT NULL;
    `);
    const totalCount = countResult.rows?.[0]?.count ?? 0;
    console.log(`   ✓ Total chunks with valid pgvector embeddings: ${totalCount}`);

    console.log("=================================================");
    console.log("PGVECTOR MIGRATION SUCCESSFULLY FINISHED");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ pgvector migration failed:", err);
    throw err;
  }
}

if (process.argv[1]?.includes("migratePgvector")) {
  runPgvectorMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

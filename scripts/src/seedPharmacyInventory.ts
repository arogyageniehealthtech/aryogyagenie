import { pool, db, pharmacyInventoryTable, medicinesTable, pharmaciesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function main() {
  const pharms = await db.select().from(pharmaciesTable);
  const meds = await db.select().from(medicinesTable);

  console.log(`Found ${pharms.length} pharmacies and ${meds.length} medicines in catalog`);

  for (const p of pharms) {
    for (const m of meds) {
      const existing = await db.query.pharmacyInventoryTable.findFirst({
        where: and(
          eq(pharmacyInventoryTable.pharmacyId, p.id),
          eq(pharmacyInventoryTable.medicineId, m.id)
        ),
      });

      if (existing) {
        await db
          .update(pharmacyInventoryTable)
          .set({ inStock: true, quantity: 100, price: 40.0 })
          .where(eq(pharmacyInventoryTable.id, existing.id));
      } else {
        await db.insert(pharmacyInventoryTable).values({
          pharmacyId: p.id,
          medicineId: m.id,
          price: 40.0,
          inStock: true,
          quantity: 100,
        });
      }
    }
  }

  const allInv = await db.select().from(pharmacyInventoryTable);
  console.log(`Successfully seeded pharmacy inventory. Total rows: ${allInv.length}`);
  await pool.end();
}

main().catch(console.error);

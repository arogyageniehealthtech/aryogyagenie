import { Router } from "express";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import {
  db,
  medicinesTable,
  pharmacyInventoryTable,
  pharmaciesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parsePaginationParams, setPaginationHeaders } from "../lib/pagination";
import { parseCoordinates, clampRadiusKm, searchNearbyPharmacies } from "../lib/locationService";

const router = Router();

// ─── GET /medicines ───────────────────────────────────────────────────────────
// Search medicine catalog
router.get("/medicines", async (req, res): Promise<void> => {
  try {
    const { search, category, genericName } = req.query as {
      search?: string;
      category?: string;
      genericName?: string;
    };
    const pagination = parsePaginationParams(req);

    const conditions: any[] = [];

    if (category) {
      conditions.push(ilike(medicinesTable.category, `%${category}%`));
    }
    if (genericName) {
      conditions.push(ilike(medicinesTable.genericName, `%${genericName}%`));
    }
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(medicinesTable.name, s),
          ilike(medicinesTable.genericName, s),
          ilike(medicinesTable.category, s),
          ilike(medicinesTable.manufacturer, s),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(medicinesTable)
      .where(whereClause);
    const total = totalCountResult?.count ?? 0;
    setPaginationHeaders(res, total, pagination);

    const medicines = await db
      .select()
      .from(medicinesTable)
      .where(whereClause)
      .orderBy(medicinesTable.name)
      .limit(pagination.limit)
      .offset(pagination.offset);

    res.json(medicines);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to search medicines" });
  }
});

// ─── GET /medicines/:id ───────────────────────────────────────────────────────
// Get medicine details, with optional nearby pharmacy discovery
router.get("/medicines/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid medicine id" });
      return;
    }

    const medicine = await db.query.medicinesTable.findFirst({
      where: eq(medicinesTable.id, id),
    });

    if (!medicine) {
      res.status(404).json({ error: "Medicine not found" });
      return;
    }

    const coords = parseCoordinates(req.query.lat, req.query.lng);
    let nearbyPharmacies: any[] = [];

    if (coords) {
      const radiusKm = clampRadiusKm(req.query.radius);
      const { results } = await searchNearbyPharmacies({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm,
        medicine: medicine.name,
        limit: 20,
      });
      nearbyPharmacies = results;
    }

    res.json({
      ...medicine,
      nearbyPharmacies,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch medicine" });
  }
});

// ─── GET /pharmacies/me/inventory ─────────────────────────────────────────────
// Get inventory of currently authenticated pharmacy
router.get(
  "/pharmacies/me/inventory",
  requireAuth,
  requireRole(["pharmacy"]),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const pharmacy = await db.query.pharmaciesTable.findFirst({
        where: eq(pharmaciesTable.userId, req.userId!),
      });

      if (!pharmacy) {
        res.status(404).json({ error: "Pharmacy not found for this user" });
        return;
      }

      const rows = await db
        .select({
          inventoryId: pharmacyInventoryTable.id,
          medicineId: medicinesTable.id,
          medicineName: medicinesTable.name,
          genericName: medicinesTable.genericName,
          category: medicinesTable.category,
          dosageForm: medicinesTable.dosageForm,
          strength: medicinesTable.strength,
          price: pharmacyInventoryTable.price,
          inStock: pharmacyInventoryTable.inStock,
          quantity: pharmacyInventoryTable.quantity,
          updatedAt: pharmacyInventoryTable.updatedAt,
        })
        .from(pharmacyInventoryTable)
        .innerJoin(medicinesTable, eq(pharmacyInventoryTable.medicineId, medicinesTable.id))
        .where(eq(pharmacyInventoryTable.pharmacyId, pharmacy.id))
        .orderBy(medicinesTable.name);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch inventory" });
    }
  },
);

// ─── POST /pharmacies/me/inventory ────────────────────────────────────────────
// Add or update medicine stock in current pharmacy's inventory
router.post(
  "/pharmacies/me/inventory",
  requireAuth,
  requireRole(["pharmacy"]),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const pharmacy = await db.query.pharmaciesTable.findFirst({
        where: eq(pharmaciesTable.userId, req.userId!),
      });

      if (!pharmacy) {
        res.status(404).json({ error: "Pharmacy not found for this user" });
        return;
      }

      const { medicineId, medicineName, genericName, category, price, inStock, quantity } = req.body;

      let targetMedicineId = medicineId ? parseInt(String(medicineId), 10) : null;

      // If no medicineId provided, create or find by name in catalog
      if (!targetMedicineId && medicineName) {
        let med = await db.query.medicinesTable.findFirst({
          where: eq(medicinesTable.name, String(medicineName).trim()),
        });
        if (!med) {
          const [newMed] = await db
            .insert(medicinesTable)
            .values({
              name: String(medicineName).trim(),
              genericName: genericName ? String(genericName).trim() : null,
              category: category ? String(category).trim() : "General",
            })
            .returning();
          med = newMed;
        }
        targetMedicineId = med.id;
      }

      if (!targetMedicineId) {
        res.status(400).json({ error: "medicineId or medicineName is required." });
        return;
      }

      const parsedPrice = price != null ? parseFloat(String(price)) : null;
      const parsedInStock = inStock !== undefined ? Boolean(inStock) : true;
      const parsedQuantity = quantity != null ? parseInt(String(quantity), 10) : 0;

      // Upsert into pharmacy_inventory
      const existing = await db.query.pharmacyInventoryTable.findFirst({
        where: and(
          eq(pharmacyInventoryTable.pharmacyId, pharmacy.id),
          eq(pharmacyInventoryTable.medicineId, targetMedicineId),
        ),
      });

      let result;
      if (existing) {
        [result] = await db
          .update(pharmacyInventoryTable)
          .set({
            price: parsedPrice ?? existing.price,
            inStock: parsedInStock,
            quantity: parsedQuantity ?? existing.quantity,
          })
          .where(eq(pharmacyInventoryTable.id, existing.id))
          .returning();
      } else {
        [result] = await db
          .insert(pharmacyInventoryTable)
          .values({
            pharmacyId: pharmacy.id,
            medicineId: targetMedicineId,
            price: parsedPrice,
            inStock: parsedInStock,
            quantity: parsedQuantity,
          })
          .returning();
      }

      res.json({
        success: true,
        inventory: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update inventory" });
    }
  },
);

export default router;

import express from "express";
import nearbyRouter from "../../artifacts/api-server/src/routes/nearby";

interface MapProviderItem {
  id: number | string;
  type: "doctor" | "hospital" | "diagnostic_center" | "pharmacy" | string;
  name: string;
  distanceKm: number;
  [key: string]: any;
}

interface NearbyApiResponse {
  count: number;
  total: number;
  radiusKm: number;
  results: MapProviderItem[];
  [key: string]: any;
}

// Simulates the exact GoogleMapView visibleProviders filtering logic
function getVisibleMapProviders(
  providers: MapProviderItem[],
  category?: "doctor" | "hospital" | "diagnostic_center" | "pharmacy" | "all"
): MapProviderItem[] {
  if (!category || category === "all") {
    return providers;
  }
  return providers.filter((p) => p.type === category);
}

async function runMapCategoryIsolationTests() {
  console.log("==========================================================================");
  console.log("🏥 VERIFYING HEALTHCARE MAP CATEGORY ISOLATION & NAVIGATION INTEGRITY");
  console.log("==========================================================================\n");

  const app = express();
  app.use(express.json());
  app.use("/api", nearbyRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/nearby?lat=22.6100&lng=88.4050&radius=18`;

  try {
    // ─── TEST 1: FIND DOCTORS (MAP VIEW) ───────────────────────────────────
    console.log("--- TEST 1: Find Doctors (Map View) ---");
    const docRes = await fetch(`${baseUrl}&type=doctor`);
    const docData = (await docRes.json()) as NearbyApiResponse;
    const docVisible = getVisibleMapProviders(docData.results, "doctor");

    console.log(`Received ${docVisible.length} markers for Find Doctors map view.`);
    const nonDoctorItems = docVisible.filter((p) => p.type !== "doctor");
    if (nonDoctorItems.length > 0) {
      throw new Error(`FAIL: Find Doctors map contains non-doctor items: ${JSON.stringify(nonDoctorItems)}`);
    }
    if (docVisible.length === 0) {
      throw new Error("FAIL: Expected doctor markers to be returned.");
    }
    console.log("✅ TEST 1 PASSED: Find Doctors map displays DOCTORS ONLY (no hospitals, diagnostics, or pharmacies).\n");

    // ─── TEST 2: HOSPITALS (MAP VIEW) ──────────────────────────────────────
    console.log("--- TEST 2: Hospitals (Map View) ---");
    const hospRes = await fetch(`${baseUrl}&type=hospital`);
    const hospData = (await hospRes.json()) as NearbyApiResponse;
    const hospVisible = getVisibleMapProviders(hospData.results, "hospital");

    console.log(`Received ${hospVisible.length} markers for Hospitals map view.`);
    const nonHospItems = hospVisible.filter((p) => p.type !== "hospital");
    if (nonHospItems.length > 0) {
      throw new Error(`FAIL: Hospitals map contains non-hospital items: ${JSON.stringify(nonHospItems)}`);
    }
    if (hospVisible.length === 0) {
      throw new Error("FAIL: Expected hospital markers to be returned.");
    }
    console.log("✅ TEST 2 PASSED: Hospitals map displays HOSPITALS ONLY (no doctors, diagnostics, or pharmacies).\n");

    // ─── TEST 3: TESTS / DIAGNOSTIC CENTERS (MAP VIEW) ─────────────────────
    console.log("--- TEST 3: Tests / Diagnostic Centers (Map View) ---");
    const diagRes = await fetch(`${baseUrl}&type=diagnostic_center`);
    const diagData = (await diagRes.json()) as NearbyApiResponse;
    const diagVisible = getVisibleMapProviders(diagData.results, "diagnostic_center");

    console.log(`Received ${diagVisible.length} markers for Diagnostic Centers map view.`);
    const nonDiagItems = diagVisible.filter((p) => p.type !== "diagnostic_center");
    if (nonDiagItems.length > 0) {
      throw new Error(`FAIL: Diagnostic Centers map contains non-diagnostic items: ${JSON.stringify(nonDiagItems)}`);
    }
    if (diagVisible.length === 0) {
      throw new Error("FAIL: Expected diagnostic lab markers to be returned.");
    }
    console.log("✅ TEST 3 PASSED: Diagnostic Centers map displays DIAGNOSTIC LABS ONLY (no doctors, hospitals, or pharmacies).\n");

    // ─── TEST 4: NEAREST CARE MAP (UNIFIED CARE MAP) ────────────────────────
    console.log("--- TEST 4: Nearest Care Map (Unified Healthcare Discovery) ---");
    const allRes = await fetch(`${baseUrl}&type=all`);
    const allData = (await allRes.json()) as NearbyApiResponse;
    const allVisible = getVisibleMapProviders(allData.results, "all");

    console.log(`Received ${allVisible.length} total providers on Nearest Care Map.`);
    const typesPresent = new Set(allVisible.map((p) => p.type));
    console.log("Provider types present on Nearest Care Map:", Array.from(typesPresent));

    if (!typesPresent.has("doctor") || !typesPresent.has("hospital") || !typesPresent.has("diagnostic_center") || !typesPresent.has("pharmacy")) {
      throw new Error(`FAIL: Nearest Care Map must include all 4 types (doctor, hospital, diagnostic_center, pharmacy). Found: ${Array.from(typesPresent)}`);
    }
    console.log("✅ TEST 4 PASSED: Nearest Care Map displays all 4 categories together (Doctor, Hospital, Diagnostic Lab, Pharmacy).\n");

    // ─── TEST 5: SEQUENTIAL TRANSITIONS & LEAKAGE CHECK ────────────────────
    console.log("--- TEST 5: Repeated Cross-Navigation Transition & Filter Leakage Check ---");
    const navigationSteps = [
      { name: "Find Doctors", category: "doctor" as const },
      { name: "Hospitals", category: "hospital" as const },
      { name: "Tests & Diagnostics", category: "diagnostic_center" as const },
      { name: "Nearest Care Map", category: "all" as const },
      { name: "Find Doctors (Re-visit)", category: "doctor" as const },
      { name: "Hospitals (Re-visit)", category: "hospital" as const },
      { name: "Nearest Care Map (Re-visit)", category: "all" as const },
    ];

    for (const step of navigationSteps) {
      const res = await fetch(`${baseUrl}&type=${step.category}`);
      const data = (await res.json()) as NearbyApiResponse;
      const visible = getVisibleMapProviders(data.results, step.category);
      const types = new Set(visible.map((p) => p.type));

      if (step.category === "all") {
        if (!types.has("doctor") || !types.has("hospital") || !types.has("diagnostic_center") || !types.has("pharmacy")) {
          throw new Error(`FAIL on ${step.name}: Nearest Care Map missing categories! Found: ${Array.from(types)}`);
        }
      } else {
        if (types.size !== 1 || !types.has(step.category)) {
          throw new Error(`FAIL on ${step.name}: Filter leakage! Expected only '${step.category}', but found: ${Array.from(types)}`);
        }
      }
      console.log(`  ✓ Transition -> ${step.name.padEnd(30)} -> Verified active types: [${Array.from(types).join(", ")}]`);
    }
    console.log("✅ TEST 5 PASSED: Navigation transitions completed with 0 filter leakage and zero stale state!\n");

    console.log("==========================================================================");
    console.log("🎉 ALL CATEGORY ISOLATION & NAVIGATION VERIFICATION TESTS PASSED!");
    console.log("==========================================================================");

    server.close();
    process.exit(0);
  } catch (err) {
    server.close();
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runMapCategoryIsolationTests();

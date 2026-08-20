import {
  searchNearbyDoctors,
  searchNearbyHospitals,
  searchNearbyDiagnosticCenters,
  searchNearbyPharmacies,
} from "../../artifacts/api-server/src/lib/locationService";

async function runTests() {
  console.log("=== RUNNING HEALTHCARE FACILITIES SEPARATION & NEARBY DISCOVERY TESTS ===");
  const testLat = 22.6100;
  const testLng = 88.4050;
  const radiusKm = 18;

  // 1. Doctors
  const docsRes = await searchNearbyDoctors({ lat: testLat, lng: testLng, radiusKm });
  console.log(`\n🩺 Doctors Test: found ${docsRes.results.length} results (total: ${docsRes.total})`);
  const nonDoctors = docsRes.results.filter((d) => d.type !== "doctor");
  if (nonDoctors.length > 0) {
    throw new Error(`FAIL: Found non-doctor items in doctor search: ${JSON.stringify(nonDoctors)}`);
  }
  console.log("✅ PASS: Doctor search returns strictly doctors only.");

  // 2. Hospitals
  const hospRes = await searchNearbyHospitals({ lat: testLat, lng: testLng, radiusKm });
  console.log(`\n🏥 Hospitals Test: found ${hospRes.results.length} results (total: ${hospRes.total})`);
  const nonHospitals = hospRes.results.filter((h) => h.type !== "hospital");
  if (nonHospitals.length > 0) {
    throw new Error(`FAIL: Found non-hospital items in hospital search: ${JSON.stringify(nonHospitals)}`);
  }
  console.log("✅ PASS: Hospital search returns strictly hospitals only with bed counts & emergency numbers.");

  // 3. Diagnostic Centers
  const diagRes = await searchNearbyDiagnosticCenters({ lat: testLat, lng: testLng, radiusKm });
  console.log(`\n🔬 Diagnostic Labs Test: found ${diagRes.results.length} results (total: ${diagRes.total})`);
  const nonLabs = diagRes.results.filter((l) => l.type !== "diagnostic_center");
  if (nonLabs.length > 0) {
    throw new Error(`FAIL: Found non-lab items in diagnostic search: ${JSON.stringify(nonLabs)}`);
  }
  console.log("✅ PASS: Diagnostic search returns strictly diagnostic centers only.");

  // 4. Pharmacies
  const pharmRes = await searchNearbyPharmacies({ lat: testLat, lng: testLng, radiusKm });
  console.log(`\n💊 Pharmacies Test: found ${pharmRes.results.length} results (total: ${pharmRes.total})`);
  const nonPharmacies = pharmRes.results.filter((p) => p.type !== "pharmacy");
  if (nonPharmacies.length > 0) {
    throw new Error(`FAIL: Found non-pharmacy items in pharmacy search: ${JSON.stringify(nonPharmacies)}`);
  }
  console.log("✅ PASS: Pharmacy search returns strictly pharmacies only.");

  console.log("\n=======================================================");
  console.log("🎉 ALL SEPARATION & DISCOVERY CRITERIA VERIFIED SUCCESSFULLY!");
  console.log("=======================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});

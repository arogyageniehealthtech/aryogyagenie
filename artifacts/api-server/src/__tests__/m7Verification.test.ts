import { analyzeSymptoms } from "../services/aiGateway";
import { searchMedicalKnowledge, retrieveMedicalContext } from "../services/ragService";
import { processOCR } from "../services/ocrService";

/**
 * Automated Verification Test Suite for Milestone 7 (Prototype Hardening & AI Safety)
 */
async function runVerificationTests() {
  console.log("🧪 Running Milestone 7 Automated Verification Test Suite...");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName}`);
      failed++;
    }
  }

  // Test 1: Emergency Safety Keyword Bypass
  try {
    const emergencyRes = await analyzeSymptoms({
      symptoms: "I have sudden severe chest pain radiating to my left arm",
    });
    assert(emergencyRes.urgencyLevel === "EMERGENCY", "Emergency Intercept: Chest pain triggers EMERGENCY urgency");
    assert(emergencyRes.providerUsed === "fallback-heuristic", "Emergency Intercept: Uses deterministic safety bypass");
  } catch (err) {
    console.error("Test 1 error:", err);
    failed++;
  }

  // Test 2: Medical RAG Retrieval Accuracy
  try {
    const ragResults = await searchMedicalKnowledge("hemoglobin blood test", 2);
    assert(ragResults.length > 0, "RAG Retrieval: Finds matching clinical documents");
    assert(ragResults[0].category === "hematology", "RAG Retrieval: Correctly retrieves Hematology guideline");

    const context = await retrieveMedicalContext("chest pain cardiology");
    assert(context.contextText.includes("Acute Chest Pain"), "RAG Context: Generates formatted clinical context");
  } catch (err) {
    console.error("Test 2 error:", err);
    failed++;
  }

  // Test 3: OCR Document Extraction
  try {
    const ocrResult = processOCR({
      rawText: "Rx: Amoxicillin 500mg - 1 capsule twice daily for 7 days\nLab: Hemoglobin: 14.2 g/dL (Normal)",
    });

    assert(ocrResult.extractedMedicines.length > 0, "OCR Extraction: Extracted prescription medicines");
    assert(ocrResult.extractedMedicines[0].name.toLowerCase().includes("amoxicillin"), "OCR Extraction: Correct medicine name parsed");
    assert(ocrResult.confidenceScore > 80, "OCR Extraction: High confidence score calculated");
  } catch (err) {
    console.error("Test 3 error:", err);
    failed++;
  }

  console.log(`\n📊 Test Suite Complete: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runVerificationTests();

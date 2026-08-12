/**
 * Comprehensive RAG Pipeline Integration & Failure Test Suite
 *
 * Verifies end-to-end embedding RAG pipeline using real local Ollama services:
 * 1. Document Ingestion & Chunking
 * 2. Vector Embedding Generation (nomic-embed-text)
 * 3. PostgreSQL Vector Storage & Retrieval (Cosine Similarity)
 * 4. AI Gateway Integration (llama3:8b)
 * 5. Source Metadata Attribution
 * 6. Emergency Safety Precedence
 * 7. Failure Case Handling
 */

import { generateEmbedding } from "../services/ollamaEmbeddingService";
import { ingestMedicalDocument, chunkMedicalText } from "../services/documentIngestionService";
import { searchMedicalKnowledge, retrieveMedicalContext, computeCosineSimilarity } from "../services/ragService";
import { analyzeSymptoms, analyzeLabReport } from "../services/aiGateway";

async function runRAGTests(): Promise<void> {
  console.log("=================================================");
  console.log("STARTING REAL EMBEDDING RAG PIPELINE TEST SUITE");
  console.log("=================================================");

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failedCount++;
    }
  }

  // --- Test 1: Chunking Strategy Verification ---
  try {
    const rawText = `## Emergency Triage\nPatient presenting with chest pain radiating to left arm requires immediate ECG.\n\n## Follow-up Care\nSchedule cardiac biomarker troponin panel within 4 hours.`;
    const chunks = chunkMedicalText(rawText, "Cardiology Protocol");
    assert(chunks.length >= 2, "Test 1: Text Chunking Strategy", `Generated ${chunks.length} chunks`);
    assert(chunks[0].section === "Emergency Triage", "Test 1b: Section Header Preservation", `Got section: ${chunks[0]?.section}`);
  } catch (err: any) {
    assert(false, "Test 1: Text Chunking Strategy", err.message);
  }

  // --- Test 2: Real Ollama Embedding Generation (nomic-embed-text) ---
  try {
    const embedding = await generateEmbedding("Acute coronary syndrome triage protocol");
    assert(Array.isArray(embedding) && embedding.length === 768, "Test 2: Real nomic-embed-text Embedding", `Vector dim: ${embedding?.length}`);
  } catch (err: any) {
    assert(false, "Test 2: Real nomic-embed-text Embedding", err.message);
  }

  // --- Test 3: Cosine Similarity Vector Math ---
  try {
    const vecA = [1, 0, 0, 1];
    const vecB = [1, 0, 0, 1];
    const vecC = [0, 1, 1, 0];
    const simExact = computeCosineSimilarity(vecA, vecB);
    const simOrthogonal = computeCosineSimilarity(vecA, vecC);
    assert(Math.abs(simExact - 1.0) < 0.001, "Test 3a: Cosine Similarity (Identical Vectors)");
    assert(Math.abs(simOrthogonal - 0.0) < 0.001, "Test 3b: Cosine Similarity (Orthogonal Vectors)");
  } catch (err: any) {
    assert(false, "Test 3: Cosine Similarity Math", err.message);
  }

  // --- Test 4: Document Ingestion & PostgreSQL Vector Storage ---
  try {
    const testDocResult = await ingestMedicalDocument({
      documentId: "TEST-CARD-999",
      title: "Test Ingest Cardiology Guideline",
      category: "cardiology",
      tags: ["chest pain", "troponin", "myocardial infarction"],
      source: "ArogyaGenie Test Registry",
      publisher: "ArogyaGenie Test Suite",
      rawText: "# Emergency Cardiology Guidelines\nPatients with persistent angina and elevated troponin must be evaluated for immediate cardiac catheterization.",
    });
    assert(testDocResult.totalChunks > 0 && testDocResult.chunks[0].vectorLength === 768, "Test 4: Ingest Document to PostgreSQL Vector Store");
  } catch (err: any) {
    assert(false, "Test 4: Ingest Document to PostgreSQL Vector Store", err.message);
  }

  // --- Test 5: Semantic Retrieval Query Search ---
  try {
    const searchResults = await searchMedicalKnowledge("elevated troponin cardiac catheterization", 3, 0.25);
    assert(searchResults.length > 0, "Test 5a: Semantic Search Retrieval");
    const topResult = searchResults[0];
    assert(topResult.score > 0.40, "Test 5b: Similarity Score Threshold", `Score: ${topResult.score.toFixed(4)}`);
    assert(!!topResult.metadata.documentId, "Test 5c: Metadata Source Attribution Attached");
  } catch (err: any) {
    assert(false, "Test 5: Semantic Retrieval Query Search", err.message);
  }

  // --- Test 6: Context Builder Output ---
  try {
    const contextPayload = await retrieveMedicalContext("fasting blood glucose 130 mg/dL");
    assert(contextPayload.sources.length > 0, "Test 6a: Context Builder Sources");
    assert(contextPayload.contextText.includes("Fasting Blood Glucose"), "Test 6b: Context Text Contents");
  } catch (err: any) {
    assert(false, "Test 6: Context Builder Output", err.message);
  }

  // --- Test 7: Symptom AI End-to-End Execution (Ollama llama3:8b) ---
  try {
    const symptomRes = await analyzeSymptoms({
      symptoms: "mild headache and low fever for 2 days",
      severity: "mild",
      duration: "2 days",
    });
    assert(!!symptomRes.aiResponse, "Test 7a: Symptom AI Response Output");
    assert(symptomRes.urgencyLevel === "LOW" || symptomRes.urgencyLevel === "MODERATE", "Test 7b: Symptom Triage Urgency Level", `Level: ${symptomRes.urgencyLevel}`);
    assert(Array.isArray(symptomRes.sources), "Test 7c: Source Metadata Returned in Symptom AI");
  } catch (err: any) {
    assert(false, "Test 7: Symptom AI End-to-End Execution", err.message);
  }

  // --- Test 8: Report Analysis End-to-End Execution (Ollama llama3:8b) ---
  try {
    const reportRes = await analyzeLabReport({
      testName: "Fasting Blood Sugar",
      results: "Fasting Glucose: 135 mg/dL (Reference: 70-99 mg/dL)",
    });
    assert(!!reportRes.summary, "Test 8a: Report Analysis Summary");
    assert(reportRes.abnormalValues.length > 0 || reportRes.keyFindings.length > 0, "Test 8b: Report Findings Extracted");
    assert(Array.isArray(reportRes.sources), "Test 8c: Source Metadata Returned in Report AI");
  } catch (err: any) {
    assert(false, "Test 8: Report Analysis End-to-End Execution", err.message);
  }

  // --- Test 9: Emergency Keyword Safety Filter Precedence ---
  try {
    const emergencyRes = await analyzeSymptoms({
      symptoms: "crushing chest pain radiating to left arm and difficulty breathing",
      severity: "severe",
    });
    assert(emergencyRes.urgencyLevel === "EMERGENCY", "Test 9a: Emergency Safety Bypass");
    assert(emergencyRes.providerUsed === "fallback-heuristic", "Test 9b: Emergency Rule Deterministic Execution");
  } catch (err: any) {
    assert(false, "Test 9: Emergency Keyword Safety Filter Precedence", err.message);
  }

  // --- Test 10: Failure Handling (Empty Text & Malformed Inputs) ---
  try {
    let emptyErrorCaught = false;
    try {
      await generateEmbedding("");
    } catch {
      emptyErrorCaught = true;
    }
    assert(emptyErrorCaught, "Test 10a: Safe Failure on Empty Text Embedding");

    const emptySearchResults = await searchMedicalKnowledge("", 3);
    assert(emptySearchResults.length === 0, "Test 10b: Safe Handling of Empty Query");
  } catch (err: any) {
    assert(false, "Test 10: Failure Handling", err.message);
  }

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRAGTests().catch((err) => {
  console.error("Test Suite Runtime Exception:", err);
  process.exit(1);
});

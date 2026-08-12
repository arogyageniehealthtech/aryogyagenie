/**
 * Integration Test Suite for Production AI Context + RAG System
 *
 * Verifies Prompt Section 5 Test Cases:
 * TEST A: Stomach pain follow-up abdominal context retention (no respiratory hallucinations)
 * TEST B: Gibberish input 'gyjfgjgjhgjh' rejection (no diagnosis)
 * TEST C: "Did I ever face any health issue?" (Uses patient DB history; NOT "no relevant information")
 * TEST D: "What does my low hemoglobin mean?" (Patient lab context + relevant medical RAG)
 * TEST E: "What are common causes of iron-deficiency anemia?" (Global medical RAG + grounded answer)
 * TEST F: "I have severe chest pain and difficulty breathing." (Emergency intercept before normal RAG/AI)
 */

import { analyzeSymptoms, validateSymptomInput, isEmergencySymptom } from "../services/aiGateway";
import { answerLongitudinalAssistant } from "../services/longitudinalAIService";

async function runProductionAiRagTestSuite(): Promise<void> {
  console.log("=================================================");
  console.log("STARTING PRODUCTION AI CONTEXT + RAG TEST SUITE");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  }

  // ─── TEST A: Stomach Pain + Upper Abdomen Follow-Up Retention ──────────────
  try {
    console.log("\n🧪 Executing TEST A — Stomach pain follow-up abdominal context retention...");
    const initialSymptoms = "I am having severe pain in my stomach.";
    const followUpQuestions = [
      "Where specifically is the abdominal discomfort located?",
      "Do you have a cough, sore throat, or breathing difficulty?",
    ];
    const followUpAnswers: Record<string, string> = {
      "Where specifically is the abdominal discomfort located?": "Pain is in the upper abdominal area around/above the belly button.",
      "Do you have a cough, sore throat, or breathing difficulty?": "No cough, no sore throat, no fever",
    };

    const res = await analyzeSymptoms({
      symptoms: initialSymptoms,
      severity: "severe",
      duration: "2 days",
      followUpQuestions,
      followUpAnswers,
      patientId: 1,
    });

    assert(res.assessmentStatus === "COMPLETED", "TEST A1: Assessment status is COMPLETED");
    
    const possibleConds = (res.possibleConditions || "").toLowerCase();
    const specialty = (res.recommendedSpecialty || "").toLowerCase();
    
    // Must NOT contain Viral Upper Respiratory Infection or Bronchitis
    const hasRespiratory = possibleConds.includes("upper respiratory") || possibleConds.includes("bronchitis");
    assert(!hasRespiratory, "TEST A2: No respiratory symptoms invented (no URI or Bronchitis)", `Conditions: ${res.possibleConditions}`);

    // Should recommend Gastroenterology or General Practice with abdominal focus
    const isAbdominalMatch = specialty.includes("gastro") || specialty.includes("general") || possibleConds.includes("gastri") || possibleConds.includes("dyspeps") || possibleConds.includes("abdominal");
    assert(isAbdominalMatch, "TEST A3: Retained abdominal focus and appropriate specialty", `Specialty: ${res.recommendedSpecialty}, Conditions: ${res.possibleConditions}`);

  } catch (err: any) {
    assert(false, "TEST A Execution Error", err.message);
  }

  // ─── TEST B: Gibberish Input Rejection ─────────────────────────────────────
  try {
    console.log("\n🧪 Executing TEST B — Gibberish Input 'gyjfgjgjhgjh'...");
    const input = "gyjfgjgjhgjh";

    const validation = validateSymptomInput(input);
    assert(!validation.valid, "TEST B1: validateSymptomInput marks gibberish as invalid");

    const res = await analyzeSymptoms({
      symptoms: input,
      patientId: 1,
    });

    assert(res.assessmentStatus === "INVALID_INPUT", "TEST B2: assessmentStatus is INVALID_INPUT");
    assert(!res.possibleConditions, "TEST B3: No medical conditions diagnosed for gibberish");

  } catch (err: any) {
    assert(false, "TEST B Execution Error", err.message);
  }

  // ─── TEST C: "Did I ever face any health issue?" (Patient History Query) ───
  try {
    console.log("\n🧪 Executing TEST C — Patient History Query...");
    const query = "Did I ever face any health issue?";

    const res = await answerLongitudinalAssistant(1, query);

    assert(typeof res.answer === "string" && res.answer.length > 10, "TEST C1: Non-empty answer returned");
    
    const lowerAnswer = res.answer.toLowerCase();
    const containsNoInfoRefusal = lowerAnswer.includes("couldn't find sufficiently relevant information in the available medical knowledge base");
    assert(!containsNoInfoRefusal, "TEST C2: DOES NOT return 'no relevant medical knowledge' refusal", `Answer snippet: ${res.answer.slice(0, 100)}...`);

  } catch (err: any) {
    assert(false, "TEST C Execution Error", err.message);
  }

  // ─── TEST D: "What does my low hemoglobin mean?" (Patient Lab + RAG) ───────
  try {
    console.log("\n🧪 Executing TEST D — Patient Lab + Medical RAG Query...");
    const query = "What does my low hemoglobin mean?";

    const res = await answerLongitudinalAssistant(1, query);
    console.log("  [TEST D Answer Output]:", res.answer);

    assert(typeof res.answer === "string" && res.answer.length > 20, "TEST D1: Comprehensive answer generated");
    const lowerD = res.answer.toLowerCase();
    assert(lowerD.includes("hemoglobin") || lowerD.includes("anemia") || lowerD.includes("blood") || lowerD.includes("red blood") || lowerD.includes("iron"), "TEST D2: Answer relates to hemoglobin / anemia", `Answer snippet: ${res.answer.slice(0, 150)}`);

  } catch (err: any) {
    assert(false, "TEST D Execution Error", err.message);
  }

  // ─── TEST E: "What are common causes of iron-deficiency anemia?" (RAG) ────
  try {
    console.log("\n🧪 Executing TEST E — Global Medical RAG Query...");
    const query = "What are common causes and warning signs of iron-deficiency anemia?";

    const res = await answerLongitudinalAssistant(1, query);
    console.log("  [TEST E Answer Output]:", res.answer);

    assert(typeof res.answer === "string" && res.answer.length > 20, "TEST E1: Detailed medical guidance returned");
    const lowerE = res.answer.toLowerCase();
    assert(lowerE.includes("iron") || lowerE.includes("anemia") || lowerE.includes("deficiency") || lowerE.includes("blood"), "TEST E2: Content directly addresses iron-deficiency anemia", `Answer snippet: ${res.answer.slice(0, 150)}`);

  } catch (err: any) {
    assert(false, "TEST E Execution Error", err.message);
  }

  // ─── TEST F: Severe Chest Pain & Breathing Emergency Intercept ─────────────
  try {
    console.log("\n🧪 Executing TEST F — Emergency Safety Intercept...");
    const emergencyText = "I have severe chest pain and difficulty breathing.";

    assert(isEmergencySymptom(emergencyText), "TEST F1: isEmergencySymptom returns true for chest pain + breathing difficulty");

    const res = await answerLongitudinalAssistant(1, emergencyText);

    assert(res.answer.includes("EMERGENCY ALERT") || res.answer.toLowerCase().includes("emergency"), "TEST F2: Emergency intercept alert returned immediately", `Answer: ${res.answer.slice(0, 100)}`);
    assert(res.disclaimer.toLowerCase().includes("emergency"), "TEST F3: Emergency disclaimer present");

  } catch (err: any) {
    assert(false, "TEST F Execution Error", err.message);
  }

  console.log("\n=================================================");
  console.log(`TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionAiRagTestSuite().catch((err) => {
  console.error("Test Suite Fatal Exception:", err);
  process.exit(1);
});

/**
 * Integration Test Suite for 2-Stage AI Symptom Assessment & Emergency Precedence
 *
 * Verifies:
 * TEST A — Simple fever (Follow-up generation -> Answer retention -> Structured assessment)
 * TEST B — Complex case (Multi-symptom context collection -> Follow-up Q&A -> Final assessment)
 * TEST C — Emergency case (Immediate emergency intercept without follow-up delays or RAG override)
 */

import { generateFollowUpQuestions, analyzeSymptoms, isEmergencySymptom } from "../services/aiGateway";

async function runSymptomWorkflowTests(): Promise<void> {
  console.log("=================================================");
  console.log("STARTING 2-STAGE AI SYMPTOM ASSESSMENT TEST SUITE");
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

  // ─── TEST A: Simple Fever Assessment Workflow ───────────────────────────────
  try {
    console.log("\n🧪 Executing TEST A — Simple Fever...");
    const initialSymptoms = "I've had a fever and cough for two days.";

    // Step 1: Follow-up question generation
    const followUpRes = await generateFollowUpQuestions({
      symptoms: initialSymptoms,
      severity: "mild",
      duration: "2 days",
    });

    assert(!followUpRes.isEmergency, "TEST A1: Non-emergency initial check");
    assert(Array.isArray(followUpRes.questions) && followUpRes.questions.length > 0, "TEST A2: Follow-up questions generated", `Count: ${followUpRes.questions.length}`);

    // Step 2: Patient answers follow-up questions
    const answers: Record<string, string> = {};
    followUpRes.questions.forEach((q, idx) => {
      answers[q] = idx === 0 ? "101 F" : "Dry cough with mild sore throat";
    });

    // Step 3: Final structured assessment
    const finalRes = await analyzeSymptoms({
      symptoms: initialSymptoms,
      severity: "mild",
      duration: "2 days",
      followUpQuestions: followUpRes.questions,
      followUpAnswers: answers,
    });

    assert(!!finalRes.urgencyLevel, "TEST A3: Urgency level present", `Urgency: ${finalRes.urgencyLevel}`);
    assert(!!finalRes.possibleConditions, "TEST A4: Possible conditions present");
    assert(!!finalRes.recommendedSpecialty, "TEST A5: Specialty present", `Specialty: ${finalRes.recommendedSpecialty}`);
    assert(Array.isArray(finalRes.riskFactors), "TEST A6: Risk factors present");
    assert(!!finalRes.recommendedAction, "TEST A7: Recommended action present");
  } catch (err: any) {
    assert(false, "TEST A: Simple Fever Workflow", err.message);
  }

  // ─── TEST B: Complex Multi-Symptom Case ─────────────────────────────────────
  try {
    console.log("\n🧪 Executing TEST B — Complex Case...");
    const complexSymptoms = "I've had fever for three days, body pain, and difficulty swallowing.";

    const followUpRes = await generateFollowUpQuestions({
      symptoms: complexSymptoms,
      severity: "moderate",
      duration: "3 days",
    });

    assert(!followUpRes.isEmergency, "TEST B1: Complex non-emergency safety check");
    assert(followUpRes.questions.length > 0, "TEST B2: Context-aware follow-up questions generated");

    const answers: Record<string, string> = {};
    followUpRes.questions.forEach((q) => {
      answers[q] = "Severe throat discomfort when swallowing food";
    });

    const finalRes = await analyzeSymptoms({
      symptoms: complexSymptoms,
      severity: "moderate",
      duration: "3 days",
      followUpQuestions: followUpRes.questions,
      followUpAnswers: answers,
    });

    assert(finalRes.urgencyLevel === "MODERATE" || finalRes.urgencyLevel === "HIGH", "TEST B3: Appropriate urgency level calculated");
    assert(!!finalRes.recommendedSpecialty && (finalRes.recommendedSpecialty.includes("ENT") || finalRes.recommendedSpecialty.includes("General Practice")), "TEST B4: Clinical specialty recommended", `Got: ${finalRes.recommendedSpecialty}`);
    assert(!!finalRes.structuredAssessment, "TEST B5: Complete structured assessment returned");
  } catch (err: any) {
    assert(false, "TEST B: Complex Case Workflow", err.message);
  }

  // ─── TEST C: Emergency Precedence (Test 2 Guarantee) ───────────────────────
  try {
    console.log("\n🧪 Executing TEST C — Emergency Safety Intercept...");
    const emergencySymptoms = "I suddenly have severe chest pain and difficulty breathing. I feel very weak and dizzy.";

    // 1. Keyword detector test
    assert(isEmergencySymptom(emergencySymptoms), "TEST C1: Direct emergency keyword detector triggers");

    // 2. Follow-up stage emergency check (MUST RETURN IMMEDIATELY WITHOUT QUESTIONS)
    const followUpRes = await generateFollowUpQuestions({
      symptoms: emergencySymptoms,
      severity: "severe",
    });

    assert(followUpRes.isEmergency === true, "TEST C2: Emergency follow-up intercept triggered immediately");
    assert(followUpRes.questions.length === 0, "TEST C3: NO follow-up questions generated for emergency");
    assert(followUpRes.urgencyLevel === "EMERGENCY", "TEST C4: Urgency set to EMERGENCY immediately");

    // 3. Final assessment emergency bypass (MUST BYPASS RAG & LLM DELAYS)
    const finalRes = await analyzeSymptoms({
      symptoms: emergencySymptoms,
      severity: "severe",
    });

    assert(finalRes.urgencyLevel === "EMERGENCY", "TEST C5: Final assessment urgency is EMERGENCY");
    assert(finalRes.providerUsed === "fallback-heuristic", "TEST C6: Uses immediate deterministic fallback");
    assert(finalRes.recommendedAction.toLowerCase().includes("emergency room") || finalRes.recommendedAction.toLowerCase().includes("call local emergency"), "TEST C7: Immediate emergency action guidance");
  } catch (err: any) {
    assert(false, "TEST C: Emergency Safety Intercept", err.message);
  }

  console.log(`\n=================================================`);
  console.log(`WORKFLOW TEST SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSymptomWorkflowTests();

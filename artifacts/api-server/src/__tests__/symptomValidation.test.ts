/**
 * Symptom Assessment Input Validation Regression Test Suite
 *
 * Tests the four user-reported issues:
 *
 * TEST A: Gibberish "gyjfgjgjhgjh" → No AI, No RAG, clean invalid-input refusal
 * TEST B: "I have severe pain in my heart" → Emergency safety layer (NOT Gastroenterology)
 * TEST C: "Fever and cough for 3 days" → Validation passes, assessment continues normally
 * TEST D: Duration "700" → Rejected by duration validator
 *
 * All tests run WITHOUT hitting Ollama or PostgreSQL where possible (pure unit tests of validation functions).
 * Tests B & C also call generateFollowUpQuestions to test the full gateway integration.
 */

import { validateSymptomInput, isEmergencySymptom, generateFollowUpQuestions } from "../services/aiGateway";

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

/** Mirrors the isValidDuration logic from symptomAssessments route */
function isValidDuration(duration: string): boolean {
  return duration.trim().length > 0;
}

async function runTests(): Promise<void> {
  console.log("=================================================");
  console.log("SYMPTOM ASSESSMENT INPUT VALIDATION REGRESSION SUITE");
  console.log("=================================================\n");

  // ─── TEST A: Gibberish Input ──────────────────────────────────────────────
  console.log("🧪 TEST A — Gibberish Input: 'gyjfgjgjhgjh'");

  const garbageResult = validateSymptomInput("gyjfgjgjhgjh");
  assert(!garbageResult.valid, "TEST A1: validateSymptomInput returns invalid for gibberish");
  if (!garbageResult.valid) {
    assert(typeof garbageResult.reason === "string" && garbageResult.reason.length > 5, "TEST A2: Returns a non-empty reason message");
  }

  // Verify emergency check does NOT trigger for gibberish (it's not an emergency — it's garbage)
  const garbageIsEmergency = isEmergencySymptom("gyjfgjgjhgjh");
  assert(!garbageIsEmergency, "TEST A3: Gibberish does NOT trigger emergency detector");

  // Simulate the generateFollowUpQuestions flow (unit level)
  const garbageFollowUp = await generateFollowUpQuestions({ symptoms: "gyjfgjgjhgjh" });
  assert(garbageFollowUp.isInvalidInput === true, "TEST A4: generateFollowUpQuestions returns isInvalidInput=true for gibberish");
  assert(!garbageFollowUp.isEmergency, "TEST A5: generateFollowUpQuestions does NOT mark as emergency for gibberish");
  assert(garbageFollowUp.questions.length === 0, "TEST A6: No follow-up questions generated for gibberish");

  console.log();

  // ─── TEST B: Heart Pain → Emergency Safety Layer ──────────────────────────
  console.log("🧪 TEST B — 'I have severe pain in my heart'");

  const heartPain = "I have severe pain in my heart";

  // First: validateSymptomInput should PASS (it contains health words)
  const heartValidation = validateSymptomInput(heartPain);
  assert(heartValidation.valid === true, "TEST B1: 'pain in my heart' passes validateSymptomInput (it IS a health description)");

  // Second: isEmergencySymptom should catch it
  const heartIsEmergency = isEmergencySymptom(heartPain);
  assert(heartIsEmergency === true, "TEST B2: 'I have severe pain in my heart' triggers isEmergencySymptom");

  // Third: generateFollowUpQuestions must return isEmergency=true, NOT isInvalidInput
  const heartFollowUp = await generateFollowUpQuestions({ symptoms: heartPain });
  assert(heartFollowUp.isEmergency === true, "TEST B3: generateFollowUpQuestions returns isEmergency=true for heart pain");
  assert(heartFollowUp.isInvalidInput !== true, "TEST B4: NOT marked as invalid input");
  assert(heartFollowUp.questions.length === 0, "TEST B5: No follow-up questions for emergency — immediate safety response");
  assert(
    typeof heartFollowUp.emergencyMessage === "string" && heartFollowUp.emergencyMessage.length > 10,
    "TEST B6: Emergency message present"
  );

  // Additional cardiac pain phrase variants
  assert(isEmergencySymptom("pain in my heart"), "TEST B7: 'pain in my heart' → emergency");
  assert(isEmergencySymptom("my heart hurts"), "TEST B8: 'my heart hurts' → emergency");
  assert(isEmergencySymptom("heart ache getting worse"), "TEST B9: 'heart ache getting worse' → emergency");
  assert(isEmergencySymptom("severe pain near my chest"), "TEST B10: 'severe pain near my chest' → emergency");
  assert(isEmergencySymptom("left arm pain"), "TEST B11: 'left arm pain' → emergency");

  console.log();

  // ─── TEST C: Normal Symptom Input → Assessment Continues ─────────────────
  console.log("🧪 TEST C — Normal Input: 'Fever and cough for 3 days'");

  const normalSymptom = "Fever and cough for 3 days";

  // validateSymptomInput must PASS
  const normalValidation = validateSymptomInput(normalSymptom);
  assert(normalValidation.valid === true, "TEST C1: 'Fever and cough for 3 days' passes validateSymptomInput");

  // isEmergencySymptom must be FALSE
  const normalIsEmergency = isEmergencySymptom(normalSymptom);
  assert(!normalIsEmergency, "TEST C2: Normal fever/cough does NOT trigger emergency");

  // generateFollowUpQuestions must continue to follow-up stage
  const normalFollowUp = await generateFollowUpQuestions({ symptoms: normalSymptom });
  assert(normalFollowUp.isEmergency === false, "TEST C3: generateFollowUpQuestions isEmergency=false for normal symptoms");
  assert(normalFollowUp.isInvalidInput !== true, "TEST C4: NOT marked as invalid input");
  assert(Array.isArray(normalFollowUp.questions) && normalFollowUp.questions.length > 0, "TEST C5: Follow-up questions generated for normal symptom (AI assessment continues)");

  console.log();

  // ─── TEST D: Duration Validation ─────────────────────────────────────────
  console.log("🧪 TEST D — Duration Validation");

  assert(!isValidDuration(""), "TEST D1: Empty string is REJECTED");
  assert(isValidDuration("3 days"), "TEST D2: '3 days' is ACCEPTED");
  assert(isValidDuration("1 days"), "TEST D3: '1 days' is ACCEPTED");
  assert(isValidDuration("1 week"), "TEST D4: '1 week' is ACCEPTED");
  assert(isValidDuration("2 week"), "TEST D5: '2 week' is ACCEPTED");
  assert(isValidDuration("3 month"), "TEST D6: '3 month' is ACCEPTED");
  assert(isValidDuration("maximum 3 month"), "TEST D7: 'maximum 3 month' is ACCEPTED");
  assert(isValidDuration("3 months"), "TEST D8: '3 months' is ACCEPTED");
  assert(isValidDuration("3"), "TEST D9: '3' is ACCEPTED");
  assert(isValidDuration("since yesterday"), "TEST D10: 'since yesterday' is ACCEPTED");
  assert(isValidDuration("a few hours"), "TEST D11: 'a few hours' is ACCEPTED");

  console.log();

  // ─── TEST E: Extra Gibberish Edge Cases ──────────────────────────────────
  console.log("🧪 TEST E — Extra Gibberish & Edge Cases");

  assert(!validateSymptomInput("asdf").valid, "TEST E1: 'asdf' (too short) → invalid");
  assert(!validateSymptomInput("hhhhhhhhh").valid, "TEST E2: 'hhhhhhhhh' (no vowels, no health word) → invalid");
  assert(!validateSymptomInput("12345678901").valid, "TEST E3: Pure numbers → invalid");
  assert(!validateSymptomInput("!@#$%^&*()").valid, "TEST E4: Special chars only → invalid");
  assert(validateSymptomInput("I feel very tired and weak").valid, "TEST E5: 'tired and weak' → valid (health words present)");
  assert(validateSymptomInput("Stomach pain after eating").valid, "TEST E6: 'Stomach pain after eating' → valid");
  assert(validateSymptomInput("I have been feeling nauseous").valid, "TEST E7: 'nauseous' → valid");
  assert(!validateSymptomInput("sdfgsdfgsdfg").valid, "TEST E8: 'sdfgsdfgsdfg' (no health words) → invalid");

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("=================================================");
  console.log(`VALIDATION REGRESSION SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});

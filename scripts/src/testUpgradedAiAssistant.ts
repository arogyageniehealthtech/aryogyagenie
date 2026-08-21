import fs from "fs";
import path from "path";

// Load .env if present
try {
  const envPath = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...v] = trimmed.split("=");
        const key = k.trim();
        const val = v.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (_e) {}

import { pool, db, usersTable, appointmentsTable, prescriptionsTable, labReportsTable, medicineOrdersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { classifyDomainAndIntent } from "../../artifacts/api-server/src/services/aiDomainClassifier";
import { buildPatientHealthContext, formatContextSummaryText } from "../../artifacts/api-server/src/services/patientContextBuilder";
import { answerLongitudinalAssistant } from "../../artifacts/api-server/src/services/longitudinalAIService";

async function runTests() {
  console.log("====================================================================");
  console.log("🔬 RUNNING COMPREHENSIVE AI ASSISTANT CONTEXT & INTENT TEST SUITE");
  console.log("====================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || ""}`);
    }
  }

  // ── TEST SUITE 1: Domain, Subject & Intent Classifier ──────────────────────
  console.log("─── TEST SUITE 1: Domain, Subject & Intent Classifier ───");

  // 1.1 Non-Medical Queries
  const mathQuery = classifyDomainAndIntent("What is 2 + 2?");
  assert(mathQuery.category === "NON_MEDICAL" && mathQuery.isNonMedical, "Math query rejected as NON_MEDICAL");

  const pythonQuery = classifyDomainAndIntent("Write Python code for a binary search tree.");
  assert(pythonQuery.category === "NON_MEDICAL" && pythonQuery.isNonMedical, "Coding query rejected as NON_MEDICAL");

  const sportsQuery = classifyDomainAndIntent("Who won yesterday's cricket match?");
  assert(sportsQuery.category === "NON_MEDICAL" && sportsQuery.isNonMedical, "Sports query rejected as NON_MEDICAL");

  // 1.2 Emergency Query
  const emergencyQuery = classifyDomainAndIntent("I have severe crushing chest pain radiating to my left arm and shortness of breath.");
  assert(emergencyQuery.category === "EMERGENCY" && emergencyQuery.isEmergency, "Emergency red flags identified with emergency triage precedence");

  // 1.3 Generic Medical Queries (Subject = GENERIC, zero target modules)
  const dengueQuery = classifyDomainAndIntent("What are the symptoms of dengue fever?");
  assert(
    dengueQuery.category === "GENERAL_MEDICAL" &&
    dengueQuery.subject === "GENERIC" &&
    dengueQuery.intent === "GENERIC_MEDICAL" &&
    dengueQuery.targetModules.length === 0,
    "Dengue query classified as GENERIC subject with 0 patient modules"
  );

  const pcosGenericQuery = classifyDomainAndIntent("What is PCOS?");
  assert(
    pcosGenericQuery.category === "GENERAL_MEDICAL" &&
    pcosGenericQuery.subject === "GENERIC" &&
    pcosGenericQuery.intent === "GENERIC_MEDICAL" &&
    pcosGenericQuery.targetModules.length === 0,
    "'What is PCOS?' classified as GENERIC subject with 0 patient modules"
  );

  // 1.4 Other Person Queries (Subject = OTHER_PERSON, zero target modules)
  const sisterPcosQuery = classifyDomainAndIntent("What precautions is my sister supposed to do as she is having PCOD/PCOS?");
  assert(
    sisterPcosQuery.subject === "OTHER_PERSON" &&
    sisterPcosQuery.relationship === "sister" &&
    sisterPcosQuery.intent === "OTHER_PERSON_MEDICAL" &&
    !sisterPcosQuery.isPatientSpecific &&
    sisterPcosQuery.targetModules.length === 0,
    "Sister PCOS query classified as OTHER_PERSON (sister) with 0 patient modules"
  );

  const fatherDiabetesQuery = classifyDomainAndIntent("My father has diabetes. What should he eat?");
  assert(
    fatherDiabetesQuery.subject === "OTHER_PERSON" &&
    fatherDiabetesQuery.relationship === "father" &&
    fatherDiabetesQuery.intent === "OTHER_PERSON_MEDICAL" &&
    !fatherDiabetesQuery.isPatientSpecific &&
    fatherDiabetesQuery.targetModules.length === 0,
    "Father diabetes query classified as OTHER_PERSON (father) with 0 patient modules"
  );

  // 1.5 Self-Referential Patient Queries (Subject = SELF, selective target modules)
  const selfFeverQuery = classifyDomainAndIntent("I am having fever.");
  assert(
    selfFeverQuery.subject === "SELF" &&
    selfFeverQuery.intent === "SYMPTOM" &&
    selfFeverQuery.isPatientSpecific,
    "Self fever query classified as SELF subject with SYMPTOM intent"
  );

  const medOrderQuery = classifyDomainAndIntent("What medicines have I ordered recently?");
  assert(
    medOrderQuery.subject === "SELF" &&
    medOrderQuery.isPatientSpecific &&
    medOrderQuery.targetModules.includes("medicines"),
    "Medicine orders query classified as SELF with medicines module"
  );

  const apptQuery = classifyDomainAndIntent("When was my last doctor appointment?");
  assert(
    apptQuery.subject === "SELF" &&
    apptQuery.isPatientSpecific &&
    apptQuery.targetModules.includes("appointments"),
    "Doctor appointment query classified as SELF with appointments module"
  );

  const labQuery = classifyDomainAndIntent("What were my latest blood test and lab results?");
  assert(
    labQuery.subject === "SELF" &&
    labQuery.isPatientSpecific &&
    labQuery.targetModules.includes("lab_reports"),
    "Lab reports query classified as SELF with lab_reports module"
  );

  const rxQuery = classifyDomainAndIntent("What medicines did my doctor prescribe?");
  assert(
    rxQuery.subject === "SELF" &&
    rxQuery.intent === "PRESCRIPTION" &&
    rxQuery.isPatientSpecific &&
    rxQuery.targetModules.includes("prescriptions"),
    "Prescription query classified as SELF with prescriptions module"
  );

  // 1.6 Platform Service Query
  const platformBookQuery = classifyDomainAndIntent("How can I book a doctor?");
  assert(
    platformBookQuery.isPlatformService &&
    platformBookQuery.intent === "APPOINTMENT" &&
    platformBookQuery.targetModules.length === 0,
    "Book doctor query classified as PLATFORM_SERVICE (APPOINTMENT) with 0 patient modules"
  );

  // 1.7 Subject Switching Detection
  const historyWithSelf = [
    { sender: "patient", text: "I have fever and headache." },
    { sender: "assistant", text: "How long have you had it?" },
  ];
  const switchQuery = classifyDomainAndIntent("What should my sister do for PCOS?", historyWithSelf);
  assert(
    switchQuery.subject === "OTHER_PERSON" &&
    switchQuery.subjectSwitched === true &&
    switchQuery.targetModules.length === 0,
    "Subject switch from SELF to OTHER_PERSON correctly detected with 0 patient modules"
  );

  console.log("\n─── TEST SUITE 2: Patient Context Builder & Selective Retrieval ───");

  // Find or create test patient in database
  let testPatient = await db.query.usersTable.findFirst({
    where: eq(usersTable.role, "patient"),
  });

  if (!testPatient) {
    const [newP] = await db.insert(usersTable).values({
      clerkId: `test_patient_rag_${Date.now()}`,
      email: "test.patient.rag@arogyagenie.com",
      firstName: "Rahul",
      lastName: "Verma",
      role: "patient",
      bloodGroup: "O+",
      allergies: "Penicillin",
      existingConditions: "Mild Hypertension",
    }).returning();
    testPatient = newP;
  }

  const patientId = testPatient.id;
  console.log(`Using Test Patient: ID #${patientId} (${[testPatient.firstName, testPatient.lastName].filter(Boolean).join(" ") || "Patient"})`);

  // Ensure test data for test patient
  const existingRx = await db.query.prescriptionsTable.findFirst({ where: eq(prescriptionsTable.patientId, patientId) });
  if (!existingRx) {
    await db.insert(prescriptionsTable).values({
      patientId,
      doctorId: 1,
      diagnosis: "Essential Hypertension",
      medicines: "Telmisartan 40mg (Once Daily)",
      instructions: "Take morning after breakfast",
      prescribedDate: "2026-08-10",
      status: "active",
    });
  }

  const existingOrder = await db.query.medicineOrdersTable.findFirst({ where: eq(medicineOrdersTable.patientId, patientId) });
  if (!existingOrder) {
    await db.insert(medicineOrdersTable).values({
      patientId,
      medicines: "Telmisartan 40mg, Paracetamol 650",
      pharmacyName: "MedPlus Pharmacy Kolkata",
      status: "delivered",
      totalPrice: 240,
    });
  }

  const existingLab = await db.query.labReportsTable.findFirst({ where: eq(labReportsTable.patientId, patientId) });
  if (!existingLab) {
    await db.insert(labReportsTable).values({
      patientId,
      testName: "Complete Blood Count (CBC)",
      testDate: "2026-08-12",
      results: "Hemoglobin: 13.8 g/dL (Normal), WBC: 7200 /mcL, Platelets: 220,000 /mcL",
      status: "completed",
      aiSummary: "All vital hematological parameters within standard reference ranges.",
    });
  }

  const existingAppt = await db.query.appointmentsTable.findFirst({ where: eq(appointmentsTable.patientId, patientId) });
  if (!existingAppt) {
    await db.insert(appointmentsTable).values({
      patientId,
      doctorId: 1,
      appointmentDate: "2026-08-10",
      appointmentTime: "10:30 AM",
      type: "in_person",
      status: "completed",
      symptoms: "Routine BP follow-up checkup",
      notes: "Blood pressure stabilized at 122/80 mmHg.",
    });
  }

  // Test Selective Module Querying
  const selectiveMedsContext = await buildPatientHealthContext(patientId, ["medicines", "prescriptions"]);
  assert(selectiveMedsContext.recentPrescriptions.length > 0, "Selective retrieval fetched Prescriptions");
  assert(selectiveMedsContext.recentMedicineOrders.length > 0, "Selective retrieval fetched Medicine Orders");
  assert(selectiveMedsContext.recentDiagnosticBookings.length === 0, "Selective retrieval omitted unrelated Diagnostic Bookings");

  const emptyTargetContext = await buildPatientHealthContext(patientId, []);
  assert(emptyTargetContext.recentPrescriptions.length === 0, "Empty target modules returns 0 prescriptions");
  assert(emptyTargetContext.recentLabReports.length === 0, "Empty target modules returns 0 lab reports");

  const fullContext = await buildPatientHealthContext(patientId);
  const contextSummary = formatContextSummaryText(fullContext);
  assert(contextSummary.includes("[SOURCE: Doctor Prescriptions"), "Formatted context includes Prescriptions source annotation");
  assert(contextSummary.includes("[SOURCE: Medicine Orders"), "Formatted context includes Medicine Orders source annotation");
  assert(contextSummary.includes("[SOURCE: Lab Reports"), "Formatted context includes Lab Reports source annotation");

  console.log("\n─── TEST SUITE 3: Prompt Section 15 Required End-to-End Scenarios ───");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — SELF
  // User: "I have fever."
  // ──────────────────────────────────────────────────────────────────────────
  console.log("Executing TEST 1 — SELF ('I have fever.')...");
  const test1Res = await answerLongitudinalAssistant(patientId, "I have fever.");
  assert(test1Res.subject === "SELF", "TEST 1a: Subject correctly identified as SELF");
  assert(test1Res.answer.length > 30, "TEST 1b: Valid clinical guidance returned for self fever");
  console.log(`[TEST 1 Preview]: ${test1Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — FOLLOW-UP
  // User: "I have fever." -> Then: "Since yesterday."
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 2 — FOLLOW-UP ('Since yesterday.')...");
  const test2History = [
    { sender: "patient" as const, text: "I have fever." },
    { sender: "assistant" as const, text: "How long have you had the fever and what is your temperature?" },
  ];
  const test2Res = await answerLongitudinalAssistant(patientId, "Since yesterday.", test2History);
  assert(test2Res.subject === "SELF", "TEST 2a: Follow-up maintained subject as SELF");
  assert(test2Res.answer.length > 20, "TEST 2b: Follow-up answered in context of fever duration");
  console.log(`[TEST 2 Preview]: ${test2Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 — OTHER PERSON (Sister PCOS)
  // User: "What precautions should my sister take because she has PCOS?"
  // Must NOT mention logged-in user's health profile, Telmisartan, prescriptions, or fever.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 3 — OTHER PERSON (Sister PCOS)...");
  const test3Res = await answerLongitudinalAssistant(patientId, "What precautions should my sister take because she has PCOS?");
  assert(test3Res.subject === "OTHER_PERSON", "TEST 3a: Subject identified as OTHER_PERSON");
  
  const test3Lower = test3Res.answer.toLowerCase();
  const test3HasPcos = test3Lower.includes("pcos") || test3Lower.includes("pcod") || test3Lower.includes("diet") || test3Lower.includes("ovary") || test3Lower.includes("hormon");
  assert(test3HasPcos, "TEST 3b: Response contains PCOS guidance");

  // Zero-Leakage Assertions:
  const leaksPatientDataIn3 = test3Lower.includes("telmisartan") || test3Lower.includes("hypertension") || test3Lower.includes("based on your aarogyagenie health profile") || test3Lower.includes("your recorded lab");
  assert(!leaksPatientDataIn3, "TEST 3c: ZERO patient data leakage into sister PCOS question (No Telmisartan, No user records)");
  console.log(`[TEST 3 Preview]: ${test3Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4 — GENERIC
  // User: "What is PCOS?"
  // No patient records, no "Based on your AarogyaGenie health profile".
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 4 — GENERIC ('What is PCOS?')...");
  const test4Res = await answerLongitudinalAssistant(patientId, "What is PCOS?");
  assert(test4Res.subject === "GENERIC", "TEST 4a: Subject identified as GENERIC");
  
  const test4Lower = test4Res.answer.toLowerCase();
  assert(test4Lower.includes("pcos") || test4Lower.includes("polycystic"), "TEST 4b: Contains generic PCOS explanation");
  assert(!test4Lower.includes("telmisartan") && !test4Lower.includes("based on your aarogyagenie"), "TEST 4c: Zero patient context in generic question");
  console.log(`[TEST 4 Preview]: ${test4Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5 — FATHER (Father Diabetes)
  // User: "My father has diabetes. What precautions should he take?"
  // General diabetes guidance, no logged-in patient records.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 5 — FATHER ('My father has diabetes. What precautions should he take?')...");
  const test5Res = await answerLongitudinalAssistant(patientId, "My father has diabetes. What precautions should he take?");
  assert(test5Res.subject === "OTHER_PERSON", "TEST 5a: Subject identified as OTHER_PERSON (father)");
  
  const test5Lower = test5Res.answer.toLowerCase();
  assert(test5Lower.includes("diabetes") || test5Lower.includes("glucose") || test5Lower.includes("sugar") || test5Lower.includes("diet"), "TEST 5b: Contains diabetes guidance for father");
  assert(!test5Lower.includes("telmisartan") && !test5Lower.includes("based on your aarogyagenie health profile"), "TEST 5c: Zero user records in father question");
  console.log(`[TEST 5 Preview]: ${test5Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6 — PATIENT RECORD
  // User: "What did my latest blood report say?"
  // Uses patient's relevant lab report.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 6 — PATIENT RECORD ('What did my latest blood report say?')...");
  const test6Res = await answerLongitudinalAssistant(patientId, "What did my latest blood report say?");
  assert(test6Res.subject === "SELF", "TEST 6a: Subject is SELF for patient lab inquiry");
  assert(test6Res.answer.length > 20, "TEST 6b: Lab report answer returned");
  console.log(`[TEST 6 Preview]: ${test6Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7 — PRESCRIPTION
  // User: "What medicines did my doctor prescribe?"
  // Uses patient's prescription data.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 7 — PRESCRIPTION ('What medicines did my doctor prescribe?')...");
  const test7Res = await answerLongitudinalAssistant(patientId, "What medicines did my doctor prescribe?");
  assert(test7Res.subject === "SELF", "TEST 7a: Subject is SELF for prescription inquiry");
  assert(test7Res.answer.length > 20, "TEST 7b: Prescription answer returned");
  console.log(`[TEST 7 Preview]: ${test7Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8 — PLATFORM
  // User: "How can I book a doctor?"
  // Uses Aarogya Jani appointment/service functionality.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 8 — PLATFORM ('How can I book a doctor?')...");
  const test8Res = await answerLongitudinalAssistant(patientId, "How can I book a doctor?");
  assert(test8Res.category === "PLATFORM_SERVICE" || test8Res.intent === "APPOINTMENT", "TEST 8a: Categorized as platform appointment service");
  
  const test8Lower = test8Res.answer.toLowerCase();
  assert(test8Lower.includes("doctor") || test8Lower.includes("appointment") || test8Lower.includes("book"), "TEST 8b: Guidance explains how to book a doctor");
  assert(!test8Lower.includes("telmisartan"), "TEST 8c: Zero medical history in platform navigation question");
  console.log(`[TEST 8 Preview]: ${test8Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9 — GENERIC MEDICAL + PLATFORM ISOLATION
  // User: "What are the symptoms of dengue?"
  // Generic medical answer. Must NOT randomly mention "free consultation", "free lab report", "free medical order".
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 9 — GENERIC MEDICAL + PLATFORM ISOLATION ('Symptoms of dengue')...");
  const test9Res = await answerLongitudinalAssistant(patientId, "What are the symptoms of dengue?");
  assert(test9Res.subject === "GENERIC", "TEST 9a: Subject is GENERIC");
  
  const test9Lower = test9Res.answer.toLowerCase();
  assert(test9Lower.includes("fever") || test9Lower.includes("dengue") || test9Lower.includes("headache") || test9Lower.includes("joint"), "TEST 9b: Contains dengue symptom clinical guidance");

  // Anti-Hallucination Pricing Check:
  const mentionsFreeServices = test9Lower.includes("free consultation") || test9Lower.includes("free lab") || test9Lower.includes("free doctor") || test9Lower.includes("free medical order") || test9Lower.includes("free medicine");
  assert(!mentionsFreeServices, "TEST 9c: ZERO fake claims of 'free consultation' or 'free orders' in medical guidance");
  console.log(`[TEST 9 Preview]: ${test9Res.answer.slice(0, 140)}...`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10 — SUBJECT CHANGE
  // User: "I have fever." -> Then: "What should my sister do for PCOS?"
  // Expected: Second response is about sister only, no user fever or prescriptions leaked.
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\nExecuting TEST 10 — SUBJECT CHANGE ('I have fever.' -> 'What should my sister do for PCOS?')...");
  const test10History = [
    { sender: "patient" as const, text: "I have fever and high body temperature since morning." },
    { sender: "assistant" as const, text: "Make sure to stay hydrated and get adequate rest." },
  ];
  const test10Res = await answerLongitudinalAssistant(patientId, "What should my sister do for PCOS?", test10History);
  assert(test10Res.subject === "OTHER_PERSON", "TEST 10a: Subject switch isolated to OTHER_PERSON");
  
  const test10Lower = test10Res.answer.toLowerCase();
  assert(test10Lower.includes("pcos") || test10Lower.includes("diet") || test10Lower.includes("lifestyle") || test10Lower.includes("gynecologist"), "TEST 10b: Response provides PCOS guidance for sister");

  const leaksFeverOrRx = test10Lower.includes("telmisartan") || test10Lower.includes("your fever") || test10Lower.includes("your high body temperature") || test10Lower.includes("based on your aarogyagenie health profile");
  assert(!leaksFeverOrRx, "TEST 10c: ZERO leakage of previous turn's fever or user records into sister's question");
  console.log(`[TEST 10 Preview]: ${test10Res.answer.slice(0, 140)}...`);

  console.log("\n====================================================================");
  console.log(`📊 FINAL TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("====================================================================");

  if (passedTests === totalTests) {
    console.log("🎉 ALL 10 CORE TEST SCENARIOS & CONTEXT ISOLATION TESTS PASSED!");
  } else {
    console.error("⚠️ SOME TESTS FAILED. Please inspect above output.");
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Fatal error during test execution:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

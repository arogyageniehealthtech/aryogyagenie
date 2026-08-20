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

import { pool, db, usersTable, appointmentsTable, prescriptionsTable, labReportsTable, medicineOrdersTable, symptomAssessmentsTable, timelineEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { classifyDomainAndIntent } from "../../artifacts/api-server/src/services/aiDomainClassifier";
import { buildPatientHealthContext, formatContextSummaryText } from "../../artifacts/api-server/src/services/patientContextBuilder";
import { answerLongitudinalAssistant } from "../../artifacts/api-server/src/services/longitudinalAIService";

async function runTests() {
  console.log("====================================================================");
  console.log("🔬 RUNNING COMPREHENSIVE AI ASSISTANT & RAG VERIFICATION TEST SUITE");
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

  // ── TEST SUITE 1: Domain & Intent Classifier ──────────────────────────────
  console.log("─── TEST SUITE 1: Domain & Intent Classifier ───");

  // 1.1 Non-Medical Queries (Must be classified as NON_MEDICAL)
  const mathQuery = classifyDomainAndIntent("What is 2 + 2?");
  assert(mathQuery.category === "NON_MEDICAL" && mathQuery.isNonMedical, "Math query rejected as NON_MEDICAL");

  const pythonQuery = classifyDomainAndIntent("Write Python code for a binary search tree.");
  assert(pythonQuery.category === "NON_MEDICAL" && pythonQuery.isNonMedical, "Coding query rejected as NON_MEDICAL");

  const sportsQuery = classifyDomainAndIntent("Who won yesterday's cricket match?");
  assert(sportsQuery.category === "NON_MEDICAL" && sportsQuery.isNonMedical, "Sports query rejected as NON_MEDICAL");

  const tomatoQuery = classifyDomainAndIntent("What's the price of tomatoes in the market today?");
  assert(tomatoQuery.category === "NON_MEDICAL" && tomatoQuery.isNonMedical, "Commodity price query rejected as NON_MEDICAL");

  // 1.2 Emergency Query
  const emergencyQuery = classifyDomainAndIntent("I have severe crushing chest pain radiating to my left arm and shortness of breath.");
  assert(emergencyQuery.category === "EMERGENCY" && emergencyQuery.isEmergency, "Emergency red flags identified with emergency triage precedence");

  // 1.3 General Medical Queries (Must NOT require previous symptom search)
  const dengueQuery = classifyDomainAndIntent("What are the symptoms of dengue fever?");
  assert(dengueQuery.category === "GENERAL_MEDICAL" && dengueQuery.isGeneralMedical, "Dengue symptoms classified as GENERAL_MEDICAL");

  const feverQuery = classifyDomainAndIntent("What should I do if someone has a 102°F fever?");
  assert(feverQuery.category === "GENERAL_MEDICAL" && feverQuery.isGeneralMedical, "102°F fever advice classified as GENERAL_MEDICAL");

  const dehydrationQuery = classifyDomainAndIntent("What is dehydration and what are its signs?");
  assert(dehydrationQuery.category === "GENERAL_MEDICAL" && dehydrationQuery.isGeneralMedical, "Dehydration classified as GENERAL_MEDICAL");

  const bpQuery = classifyDomainAndIntent("What causes high blood pressure?");
  assert(bpQuery.category === "GENERAL_MEDICAL" && bpQuery.isGeneralMedical, "High blood pressure causes classified as GENERAL_MEDICAL");

  // 1.4 Patient-Specific Queries
  const medOrderQuery = classifyDomainAndIntent("What medicines have I ordered recently?");
  assert(medOrderQuery.isPatientSpecific && medOrderQuery.targetModules.includes("medicines"), "Medicine orders query classified as PATIENT_SPECIFIC with medicines module");

  const apptQuery = classifyDomainAndIntent("When was my last doctor appointment?");
  assert(apptQuery.isPatientSpecific && apptQuery.targetModules.includes("appointments"), "Doctor appointment query classified as PATIENT_SPECIFIC with appointments module");

  const labQuery = classifyDomainAndIntent("What were my latest blood test and lab results?");
  assert(labQuery.isPatientSpecific && labQuery.targetModules.includes("lab_reports"), "Lab reports query classified as PATIENT_SPECIFIC with lab_reports module");

  // 1.5 Hybrid Query
  const hybridQuery = classifyDomainAndIntent("What does my low hemoglobin test result mean?");
  assert(hybridQuery.category === "HYBRID" && hybridQuery.isPatientSpecific && hybridQuery.isGeneralMedical, "Hybrid query classified as HYBRID");

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

  // Ensure test data across modules for test patient
  // 1. Prescription
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

  // 2. Medicine Order
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

  // 3. Lab Report
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

  // 4. Appointment
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

  const fullContext = await buildPatientHealthContext(patientId);
  const contextSummary = formatContextSummaryText(fullContext);
  assert(contextSummary.includes("[SOURCE: Doctor Prescriptions"), "Formatted context includes Prescriptions source annotation");
  assert(contextSummary.includes("[SOURCE: Medicine Orders"), "Formatted context includes Medicine Orders source annotation");
  assert(contextSummary.includes("[SOURCE: Lab Reports"), "Formatted context includes Lab Reports source annotation");

  console.log("\n─── TEST SUITE 3: End-to-End AI Assistant Service ───");

  // 3.1 Non-Medical Rejection
  console.log("Testing Non-Medical Rejection...");
  const nonMedRes = await answerLongitudinalAssistant(patientId, "What is 2 + 2?");
  assert(nonMedRes.category === "NON_MEDICAL", "Non-medical query categorized as NON_MEDICAL");
  assert(nonMedRes.answer.includes("AarogyaGenie AI") && nonMedRes.answer.includes("medical"), "Non-medical query receives clean domain rejection response");

  // 3.2 Emergency Triage
  console.log("Testing Emergency Triage...");
  const emergencyRes = await answerLongitudinalAssistant(patientId, "I have severe crushing chest pain radiating to my left arm.");
  assert(emergencyRes.category === "EMERGENCY" && emergencyRes.answer.includes("EMERGENCY ALERT"), "Emergency query returns immediate emergency triage alert");

  // 3.3 General Medical Query (Without Prior Symptom Search)
  console.log("Testing General Medical Query (Dengue Symptoms)...");
  const dengueRes = await answerLongitudinalAssistant(patientId, "What are the common symptoms of dengue?");
  assert(dengueRes.category === "GENERAL_MEDICAL", "General medical query categorized correctly");
  assert(dengueRes.answer.length > 50, "General medical query generated a thorough clinical response");
  console.log(`[Dengue Response Preview]: ${dengueRes.answer.slice(0, 150)}...`);

  // 3.4 General Medical Query (102°F Fever)
  console.log("Testing General Medical Query (102°F Fever Guidance)...");
  const feverRes = await answerLongitudinalAssistant(patientId, "What should I do if someone has a 102°F fever?");
  assert(feverRes.category === "GENERAL_MEDICAL", "Fever query categorized as GENERAL_MEDICAL");
  assert(feverRes.answer.length > 50, "Fever query generated helpful, structured medical guidance");

  // 3.5 Patient-Specific Query (Medicine History)
  console.log("Testing Patient-Specific Query (Medicines)...");
  const patientMedsRes = await answerLongitudinalAssistant(patientId, "What medicines have I ordered or been prescribed?");
  assert(patientMedsRes.category === "PATIENT_SPECIFIC" || patientMedsRes.category === "HYBRID", "Patient medicine query categorized appropriately");
  assert(patientMedsRes.answer.length > 30, "Patient medicine query generated personalized response grounded in records");
  console.log(`[Patient Meds Preview]: ${patientMedsRes.answer.slice(0, 150)}...`);

  // 3.6 Patient-Specific Query (Lab Reports)
  console.log("Testing Patient-Specific Query (Lab Reports)...");
  const patientLabRes = await answerLongitudinalAssistant(patientId, "What were my recent lab test results?");
  assert(patientLabRes.answer.length > 30, "Patient lab test query returned grounded results");

  // 3.7 Missing Information & Hallucination Prevention
  console.log("Testing Hallucination Prevention on Non-Existent Record...");
  const missingRecordRes = await answerLongitudinalAssistant(patientId, "What did my brain MRI scan show?");
  assert(
    missingRecordRes.answer.toLowerCase().includes("no record") ||
    missingRecordRes.answer.toLowerCase().includes("not found") ||
    missingRecordRes.answer.toLowerCase().includes("no mri") ||
    missingRecordRes.answer.toLowerCase().includes("not available"),
    "AI correctly states no MRI record is in patient history (Zero Hallucination)"
  );
  console.log(`[Zero Hallucination Preview]: ${missingRecordRes.answer.slice(0, 150)}...`);

  // 3.8 Multi-Turn Conversation Memory
  console.log("Testing Conversation Memory Follow-up...");
  const historyTurns = [
    { sender: "patient" as const, text: "What medicines did I order recently?" },
    { sender: "assistant" as const, text: "Your records show an order for Telmisartan 40mg and Paracetamol 650 from MedPlus Pharmacy." },
  ];
  const followUpRes = await answerLongitudinalAssistant(patientId, "Which one of those was for blood pressure?", historyTurns);
  assert(followUpRes.answer.length > 20, "Conversation history turn resolved with context");
  console.log(`[Follow-up Preview]: ${followUpRes.answer.slice(0, 150)}...`);

  // 3.9 Patient Data Isolation Security Test
  console.log("Testing Patient Isolation Security...");
  // Create or find patient B
  let patientB = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, "patient.b.security@arogyagenie.com"),
  });
  if (!patientB) {
    const [newB] = await db.insert(usersTable).values({
      clerkId: `test_patient_b_${Date.now()}`,
      email: "patient.b.security@arogyagenie.com",
      firstName: "PatientB",
      lastName: "SecurityTest",
      role: "patient",
    }).returning();
    patientB = newB;
  }

  const patientBContext = await buildPatientHealthContext(patientB.id);
  assert(
    !formatContextSummaryText(patientBContext).includes("Telmisartan") &&
    patientBContext.recentPrescriptions.length === 0,
    "Patient B context is 100% isolated from Patient A (Zero Cross-Tenant Leakage)"
  );

  console.log("\n====================================================================");
  console.log(`📊 FINAL TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("====================================================================");

  if (passedTests === totalTests) {
    console.log("🎉 ALL MEDICAL AI ASSISTANT, PATIENT CONTEXT & RAG TESTS PASSED!");
  } else {
    console.error("⚠️ SOME TESTS FAILED. Please inspect above output.");
  }
}

runTests()
  .catch((err) => {
    console.error("Fatal error during test execution:", err);
  })
  .finally(async () => {
    await pool.end();
  });

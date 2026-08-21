import { db, healthEpisodesTable, patientAiSummariesTable, labReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { buildPatientHealthContext, formatContextSummaryText, type PatientHealthContextData } from "./patientContextBuilder";
import { searchMedicalKnowledge } from "./ragService";
import { callLLM } from "./aiGateway";
import { classifyDomainAndIntent, type DomainCategory, type QuerySubject, type QueryIntent } from "./aiDomainClassifier";

export interface StructuredHealthSummary {
  recentHealthEvents: string[];
  activeConcerns: string[];
  recentPrescriptions: string[];
  currentMedicines: string[];
  followUpRequirements: string[];
  aiInterpretation: string;
  disclaimer: string;
}

export interface LabTrendItem {
  testName: string;
  readings: Array<{ date: string; value: string; isAbnormal?: boolean }>;
  trendDirection: "increasing" | "decreasing" | "stable" | "fluctuating" | "insufficient_data";
  summary: string;
}

export interface DoctorBriefingResponse {
  patientOverview: string;
  keyDiagnoses: string[];
  activeMedications: string[];
  recentLabHighlights: string[];
  suggestedFollowUpTopics: string[];
  disclaimer: string;
}

export interface ChatHistoryTurn {
  sender: "patient" | "assistant" | "user";
  text: string;
}

export interface AssistantAnswerResponse {
  answer: string;
  usedRag: boolean;
  category?: DomainCategory;
  subject?: QuerySubject;
  intent?: QueryIntent;
  sources: Array<{
    documentId?: string;
    title?: string;
    source?: string;
    publisher?: string;
    section?: string;
    page?: string;
  }>;
  retrieval: { topK: number; resultsUsed: number };
  disclaimer: string;
}

/** Generate or retrieve cached longitudinal patient health summary. */
export async function generatePatientHealthSummary(patientId: number): Promise<StructuredHealthSummary> {
  const context = await buildPatientHealthContext(patientId);
  const contextText = formatContextSummaryText(context);

  const prompt = `You are a longitudinal health intelligence assistant. Analyze this patient's medical history context:

${contextText}

Respond ONLY with a JSON object in this exact format (no markdown fences, no extra text):
{
  "recentHealthEvents": ["<recent timeline event 1>", "<recent event 2>"],
  "activeConcerns": ["<active symptom or health concern>"],
  "recentPrescriptions": ["<recent prescription & diagnosis>"],
  "currentMedicines": ["<current active medicine>"],
  "followUpRequirements": ["<cautious suggested follow-up topic or appointment requirement>"],
  "aiInterpretation": "<2-3 sentence clear summary of the patient's recent medical journey>"
}

Rules:
- Strictly base facts on the provided patient context.
- Use cautious clinical language ('may suggest', 'indicates', 'record shows').
- Never prescribe medicines or alter dosages.`;

  try {
    const rawText = await callLLM(prompt, 450);
    if (rawText) {
      const cleanText = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleanText);

      const summary: StructuredHealthSummary = {
        recentHealthEvents: parsed.recentHealthEvents ?? context.recentTimeline.map((t) => `${t.date}: ${t.title}`),
        activeConcerns: parsed.activeConcerns ?? context.recentSymptoms.map((s) => `${s.symptoms} (${s.severity})`),
        recentPrescriptions: parsed.recentPrescriptions ?? context.recentPrescriptions.map((p) => `${p.diagnosis} - ${p.medicines}`),
        currentMedicines: parsed.currentMedicines ?? context.activeReminders.map((m) => `${m.medicineName} ${m.dosage}`),
        followUpRequirements: parsed.followUpRequirements ?? ["Schedule routine follow-up with your primary care provider if symptoms persist."],
        aiInterpretation: parsed.aiInterpretation ?? "Your recent medical journey reflects ongoing healthcare consultations and active treatment tracking.",
        disclaimer: "⚠️ AI-assisted health summary based on recorded medical history. Informational only, not a medical diagnosis.",
      };

      // Cache in database
      await db.insert(patientAiSummariesTable).values({
        patientId,
        summaryType: "patient_overview",
        content: summary as unknown as Record<string, unknown>,
      });

      return summary;
    }
  } catch (_e) {
    // Deterministic Fallback Summary Engine
  }

  return {
    recentHealthEvents: context.recentTimeline.map((t) => `${t.date}: ${t.title}`),
    activeConcerns: context.recentSymptoms.map((s) => `${s.symptoms} (${s.severity ?? "Moderate"})`),
    recentPrescriptions: context.recentPrescriptions.map((p) => `${p.diagnosis} - ${p.medicines}`),
    currentMedicines: context.activeReminders.map((m) => `${m.medicineName} ${m.dosage}`),
    followUpRequirements: context.recentPrescriptions.length > 0 ? ["Review prescription completion date with your doctor."] : ["Maintain regular check-ups."],
    aiInterpretation: "Summary calculated from your verified database medical timeline records.",
    disclaimer: "⚠️ Offline summary based on recorded medical history.",
  };
}

/** Analyze multi-report quantitative lab result trends. */
export async function analyzeLabTrends(patientId: number): Promise<LabTrendItem[]> {
  const reports = await db.query.labReportsTable.findMany({
    where: eq(labReportsTable.patientId, patientId),
    orderBy: [desc(labReportsTable.testDate)],
  });

  const testMap = new Map<string, Array<{ date: string; value: string; numVal?: number; isAbnormal?: boolean }>>();

  for (const r of reports) {
    const dateStr = new Date(r.testDate).toLocaleDateString();
    const testName = r.testName.trim();
    if (!testMap.has(testName)) testMap.set(testName, []);

    const numMatch = r.results ? r.results.match(/([\d\.]+)\s*(g\/dL|mg\/dL|\/mcL|K\/uL|%)/i) : null;
    const numVal = numMatch ? parseFloat(numMatch[1]) : undefined;
    const isAbnormal = r.results ? /\b(high|low|abnormal|elevated)\b/i.test(r.results) : false;

    testMap.get(testName)!.push({
      date: dateStr,
      value: r.results ?? "Completed",
      numVal,
      isAbnormal,
    });
  }

  const trends: LabTrendItem[] = [];

  for (const [testName, readings] of testMap.entries()) {
    let trendDirection: LabTrendItem["trendDirection"] = "insufficient_data";
    let summary = `Recorded ${readings.length} test reading(s).`;

    if (readings.length >= 2) {
      const validNums = readings.filter((r) => r.numVal !== undefined).map((r) => r.numVal!);
      if (validNums.length >= 2) {
        const latest = validNums[0];
        const previous = validNums[1];
        if (latest > previous + 0.1) {
          trendDirection = "increasing";
          summary = `Values increased from ${previous} to ${latest} over recent tests.`;
        } else if (latest < previous - 0.1) {
          trendDirection = "decreasing";
          summary = `Values decreased from ${previous} to ${latest} over recent tests.`;
        } else {
          trendDirection = "stable";
          summary = `Readings remain stable around ${latest}.`;
        }
      }
    }

    trends.push({
      testName,
      readings,
      trendDirection,
      summary,
    });
  }

  return trends;
}

/** Detect or retrieve active health episodes. */
export async function detectHealthEpisodes(patientId: number) {
  const existingEpisodes = await db.query.healthEpisodesTable.findMany({
    where: eq(healthEpisodesTable.patientId, patientId),
    orderBy: [desc(healthEpisodesTable.startDate)],
  });

  if (existingEpisodes.length > 0) {
    return existingEpisodes;
  }

  const context = await buildPatientHealthContext(patientId);
  if (context.recentSymptoms.length > 0) {
    const latestSymptom = context.recentSymptoms[0];
    const [newEpisode] = await db
      .insert(healthEpisodesTable)
      .values({
        patientId,
        title: `Health Journey: ${latestSymptom.symptoms.slice(0, 30)}...`,
        status: "suggested",
        startDate: latestSymptom.date,
        summary: `Grouped health events starting with symptoms: ${latestSymptom.symptoms}`,
      })
      .returning();

    return [newEpisode];
  }

  return [];
}

/** Generate an authorized doctor executive briefing. */
export async function generateDoctorPatientBriefing(patientId: number, doctorId: number): Promise<DoctorBriefingResponse> {
  const context = await buildPatientHealthContext(patientId);

  return {
    patientOverview: `Patient #${patientId} has ${context.recentAppointments.length} recent consultation(s) and ${context.recentPrescriptions.length} active prescription record(s).`,
    keyDiagnoses: context.recentPrescriptions.map((p) => p.diagnosis),
    activeMedications: context.activeReminders.map((m) => `${m.medicineName} (${m.dosage})`),
    recentLabHighlights: context.recentLabReports.map((r) => `${r.testName}: ${r.results ?? "Pending"}`),
    suggestedFollowUpTopics: context.recentSymptoms.map((s) => `Follow up on reported symptoms: ${s.symptoms}`),
    disclaimer: "⚠️ AI Doctor Briefing for clinical workflow reference. Verify against original records.",
  };
}

/**
 * Main AI Assistant Entry Point:
 * Medical-domain conversational assistant with intentional personalization,
 * strict subject & context isolation, and grounded RAG retrieval.
 */
export async function answerLongitudinalAssistant(
  patientId: number,
  query: string,
  history?: ChatHistoryTurn[]
): Promise<AssistantAnswerResponse> {
  const queryTrimmed = query.trim();

  // ── Step 1: Intelligent Intent & Subject Classification ────────────────────
  const classification = classifyDomainAndIntent(queryTrimmed, history);

  // 1A. Emergency Triage Precedence
  if (classification.isEmergency) {
    return {
      answer: classification.emergencyMessage || "🚨 EMERGENCY ALERT: Please call local emergency services (112 / 911 / 108) immediately.",
      usedRag: false,
      category: "EMERGENCY",
      subject: classification.subject,
      intent: classification.intent,
      sources: [
        {
          title: "Emergency Medical Triage Protocol",
          source: "ArogyaGenie Safety Gateway",
          publisher: "ArogyaGenie Emergency System",
          section: "Immediate Emergency Triage",
          page: "1",
        },
      ],
      retrieval: { topK: 0, resultsUsed: 0 },
      disclaimer: "⚠️ Immediate emergency medical evaluation required.",
    };
  }

  // 1B. Explicit Non-Medical Domain Rejection
  if (classification.isNonMedical) {
    return {
      answer: classification.rejectionMessage || "I am AarogyaGenie AI, your dedicated medical assistant. Please ask medical or healthcare-related questions.",
      usedRag: false,
      category: "NON_MEDICAL",
      subject: classification.subject,
      intent: classification.intent,
      sources: [],
      retrieval: { topK: 0, resultsUsed: 0 },
      disclaimer: "ℹ️ AarogyaGenie AI is restricted to the medical and healthcare domain.",
    };
  }

  // ── Step 2: Conditional Context Retrieval ──────────────────────────────────
  // CRITICAL RULE: Patient records are ONLY retrieved if subject is SELF and intent requires records.
  // If the question is about an OTHER_PERSON (e.g. sister, father) or GENERIC or PLATFORM_SERVICE,
  // targetModules is empty and NO patient records are retrieved or injected!
  let patientContextText = "";
  let patientContext: PatientHealthContextData | null = null;

  if (classification.subject === "SELF" && classification.isPatientSpecific && classification.targetModules.length > 0) {
    // Selectively query only the relevant modules identified by query analyzer
    patientContext = await buildPatientHealthContext(patientId, classification.targetModules);
    patientContextText = formatContextSummaryText(patientContext);
  }

  // Medical RAG Knowledge Search (activated for general medical, other-person medical, or hybrid questions)
  const topK = process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : 5;
  const threshold = process.env.RAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) : 0.52;

  let matches: Awaited<ReturnType<typeof searchMedicalKnowledge>> = [];
  if (classification.isGeneralMedical && !classification.isPlatformService && classification.intent !== "GENERAL_CONVERSATION") {
    matches = await searchMedicalKnowledge(queryTrimmed, topK, threshold);
  }

  const usedRag = matches.length > 0;
  const sourcesMeta = matches.map((m) => ({
    documentId: m.documentId,
    title: m.title,
    source: m.metadata?.source || m.title,
    publisher: m.metadata?.publisher || "Clinical Reference Guideline",
    section: m.section,
    page: m.page,
  }));

  const formattedRagEvidence = matches
    .map(
      (m, idx) =>
        `GUIDELINE EVIDENCE #${idx + 1}:\n` +
        `Title: ${m.title} (${m.documentId})\n` +
        `Publisher: ${m.metadata?.publisher || "Clinical Reference"}\n` +
        `${m.section ? `Section: ${m.section}\n` : ""}` +
        `Page: ${m.page || "1"}\n` +
        `Content:\n${m.content}`
    )
    .join("\n\n");

  // Format Conversation History Context with Subject-Switch Awareness
  let formattedHistory = "";
  if (history && history.length > 0) {
    const recentTurns = history.slice(-6); // Last 3 user/assistant turns
    formattedHistory = `RECENT CONVERSATION HISTORY:\n${recentTurns
      .map((t) => `${t.sender === "patient" || t.sender === "user" ? "Patient" : "Assistant"}: ${t.text}`)
      .join("\n")}\n\n`;

    if (classification.subjectSwitched) {
      formattedHistory += `[SUBJECT-SWITCH NOTE: The user has switched the subject of inquiry to ${classification.subject}${
        classification.relationship ? ` (${classification.relationship})` : ""
      }. Do NOT carry over previous patient-specific medical records, prescriptions, or symptoms into this response.]\n\n`;
    }
  }

  // ── Step 3: Construct Grounded Clinical Prompt ─────────────────────────────
  let systemPrompt = "";

  const commonSafetyRules = `CRITICAL SAFETY & ZERO-HALLUCINATION RULES:
1. STRICT PRICING & BENEFIT RULES:
   - NEVER claim that doctor consultations, appointments, diagnostic tests, lab reports, medicine deliveries, or orders are "free" or offer free benefits.
   - Do NOT invent platform discounts, zero-cost promotions, or claims not verified in database context.
   - If asked about pricing or consultation fees, state that fees depend on the specific doctor, hospital, diagnostic center, or pharmacy selected, and can be viewed directly on the platform during booking.
2. DO NOT inject unsolicited AarogyaGenie service promotions or booking CTAs into purely clinical, medical education, or third-party questions.
3. PERSONALIZATION IS STRICTLY INTENTIONAL:
   - When the question is about an OTHER PERSON (e.g. sister, father, friend) or a GENERIC medical topic, do NOT refer to any logged-in patient records, prescriptions, or lab results.
   - Do NOT start generic responses with "Based on your AarogyaGenie health profile...".
4. MEDICAL CAUTION:
   - Do not claim definitive diagnosis ("You have X"). Use cautious, supportive phrasing ("may suggest", "common causes include").
   - Do not prescribe prescription-only medications or alter dosages. Encourage consulting a qualified healthcare professional.`;

  if (classification.isPlatformService) {
    systemPrompt = `You are AarogyaGenie AI, the navigation and healthcare service assistant for the AarogyaGenie platform.
Answer the user's question about booking appointments, ordering medicines, scheduling diagnostic tests, finding healthcare providers, or navigating platform features.

${formattedHistory}AAROGYAGENIE PLATFORM CAPABILITIES & NAVIGATION:
• Doctor Appointments: Users can search doctors by specialty, location, or clinic, view availability, and book in-person or video consultations.
• Doorstep Medicine Orders: Users can search prescription & OTC medicines from verified nearby partner pharmacies and order with quick doorstep delivery.
• Diagnostic & Lab Tests: Users can search test packages (CBC, Blood Sugar, Lipid Profile, Thyroid, Scans) across verified diagnostic centers and book appointments.
• Health Records & Timeline: Users can securely upload lab reports, view doctor prescriptions, and track longitudinal health metrics.

USER QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. Provide clear, step-by-step guidance on how to navigate the relevant feature within AarogyaGenie.
6. If asked about pricing or consultation fees, explain that prices are determined by the individual doctor, clinic, diagnostic lab, or pharmacy and are displayed on the booking/checkout screen.`;
  } else if (classification.subject === "OTHER_PERSON") {
    const relationName = classification.relationship ? classification.relationship : "another person";
    systemPrompt = `You are AarogyaGenie AI, a trusted, empathetic, and clinically grounded medical assistant.
The user is asking a medical or healthcare question about THEIR ${relationName.toUpperCase()} (NOT about the logged-in user).

${formattedHistory}${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : ""}SUBJECT OF INQUIRY: OTHER PERSON (${relationName.toUpperCase()})
INTENT: ${classification.intent}

USER QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. STRICT CONTEXT ISOLATION:
   - This question is about the user's ${relationName}, NOT the logged-in patient.
   - Do NOT reference any logged-in user health records, prescriptions, lab reports, or prior personal symptoms.
   - Do NOT start with "Based on your AarogyaGenie health profile...".
6. Provide comprehensive, accurate, and practical medical guidance, precautions, dietary/lifestyle measures, and warning signs for the condition discussed.
7. Maintain an empathetic, professional tone and advise that their ${relationName} consult a qualified healthcare provider or specialist for individualized clinical evaluation.`;
  } else if (classification.subject === "SELF" && classification.intent === "PRESCRIPTION" && patientContext) {
    systemPrompt = `You are AarogyaGenie AI, the patient's personal healthcare companion.
The patient is asking specifically about their doctor prescriptions recorded on the AarogyaGenie platform.

${formattedHistory}AUTHORIZED PATIENT PRESCRIPTION RECORDS FROM DATABASE:
${patientContextText}

PATIENT QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. ONLY reference prescription information explicitly stated in the database records above.
6. Provide prescribing doctor names, dates, diagnoses, medicines, dosages, and instructions clearly using bullet points.
7. If the requested prescription or medicine does not exist in the records, state that clearly without guessing.`;
  } else if (classification.subject === "SELF" && classification.intent === "LAB_REPORT" && patientContext) {
    systemPrompt = `You are AarogyaGenie AI, the patient's personal healthcare companion.
The patient is asking specifically about their lab test reports or diagnostic results recorded on the AarogyaGenie platform.

${formattedHistory}AUTHORIZED PATIENT LAB RECORDS FROM DATABASE:
${patientContextText}

PATIENT QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. ONLY reference lab tests and results explicitly stated in the database records above.
6. Provide test names, dates, values, reference status (e.g. normal/abnormal), and findings clearly.
7. If the user asks about a specific test (e.g. MRI, CT scan, X-Ray) that is not in the records, state clearly: "According to your recorded AarogyaGenie health records, there is no record of [test] on file." Never fabricate results.`;
  } else if (classification.subject === "SELF" && classification.category === "PATIENT_SPECIFIC" && patientContext) {
    systemPrompt = `You are AarogyaGenie AI, the patient's personal healthcare companion.
You are answering a question specifically regarding the patient's personal recorded medical history, orders, prescriptions, doctors, visits, lab tests, or health timeline on AarogyaGenie.

${formattedHistory}AUTHORIZED PATIENT HEALTHCARE RECORDS FROM DATABASE:
${patientContextText}

PATIENT QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. ONLY reference information that is explicitly stated in the AUTHORIZED PATIENT HEALTHCARE RECORDS above.
6. If the user asks about a specific scan, test (such as MRI, CT scan, X-Ray), surgery, or appointment, first verify if it exists in the records above. If not found, explicitly state that no record exists on file.
7. Support temporal reasoning (latest, recent, previous) referencing actual dates in the records.`;
  } else if (classification.subject === "SELF" && classification.category === "HYBRID" && patientContext) {
    systemPrompt = `You are AarogyaGenie AI, an intelligent clinical health assistant.
The patient is asking a personal health question regarding their own symptoms, medications, or test results while also seeking medical guidance or clinical interpretation.

${formattedHistory}${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : ""}AUTHORIZED PATIENT HEALTHCARE RECORDS:
${patientContextText}

PATIENT QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. Address the patient's specific recorded results, prescriptions, or symptoms accurately.
6. Distinguish clearly between the patient's specific facts ("Your records show...") and general medical information ("Generally, clinical guidelines note...").
7. Highlight warning signs or red flags if applicable, and advise consulting their doctor for personalized medical evaluation.`;
  } else {
    // GENERIC_MEDICAL or GENERAL_CONVERSATION
    systemPrompt = `You are AarogyaGenie AI, a trusted, empathetic, and clinically grounded medical AI assistant.
Answer the user's general medical or health education question thoroughly, accurately, and compassionately.

${formattedHistory}${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : ""}PATIENT HEALTH QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. Provide a comprehensive, medically accurate, and easy-to-understand explanation.
6. Structure your response clearly:
   - Direct explanation / Overview of the condition, symptom, or topic
   - Common causes / mechanisms
   - Practical precautions, self-care, or relief measures (where appropriate)
   - Important warning signs (red flags) and when to see a healthcare professional
7. Do NOT refer to logged-in user health records or prescriptions (this is a generic inquiry).
8. Maintain an empathetic, professional, and supportive tone.`;
  }

  // ── Step 4: Call Gemini LLM (with retry & backoff) ─────────────────────────
  try {
    const rawAnswer = await callLLM(systemPrompt, 650);
    if (rawAnswer && rawAnswer.trim().length > 0) {
      let finalAnswer = rawAnswer.trim();

      // Post-processing safety filter: catch any accidental "free consultation" hallucinations
      finalAnswer = finalAnswer
        .replace(/\b(free doctor consultation|free consultation|free lab report|free lab test|free medicine delivery|free medicine order|free medical order)\b/gi, "doctor consultation / healthcare service");

      return {
        answer: finalAnswer,
        usedRag,
        category: classification.category,
        subject: classification.subject,
        intent: classification.intent,
        sources: sourcesMeta,
        retrieval: {
          topK,
          resultsUsed: matches.length,
        },
        disclaimer:
          classification.subject === "SELF" && classification.isPatientSpecific
            ? "⚠️ Answer grounded in your AarogyaGenie database records. Consult your doctor for medical decisions."
            : "⚠️ Informational medical guidance based on clinical reference standards. Not a substitute for professional medical diagnosis or treatment.",
      };
    }
  } catch (err) {
    console.error("Error in callLLM:", err);
  }

  // ── Step 5: Deterministic Fallback Engine ──────────────────────────────────
  let fallbackAnswer = "";

  if (classification.isPlatformService) {
    if (classification.intent === "APPOINTMENT" || classification.intent === "DOCTOR") {
      fallbackAnswer = "To book a doctor appointment on AarogyaGenie:\n1. Navigate to the 'Doctors' or 'Appointments' section in the sidebar.\n2. Search by specialty (e.g. Cardiologist, Dermatologist, General Physician) or doctor name.\n3. Choose your preferred doctor and select an available consultation time slot.\n4. Confirm your appointment details. Consultation fees vary by doctor and clinic.";
    } else if (classification.intent === "LAB") {
      fallbackAnswer = "To book a diagnostic lab test on AarogyaGenie:\n1. Go to the 'Diagnostics' or 'Lab Tests' tab.\n2. Select your required test or health checkup package (e.g., CBC, Lipid Profile, Thyroid, Blood Glucose).\n3. Choose a verified partner diagnostic center and schedule your preferred slot.";
    } else if (classification.intent === "PHARMACY") {
      fallbackAnswer = "To order medicines on AarogyaGenie:\n1. Open the 'Pharmacy' section.\n2. Search for prescribed or OTC medications, or upload your doctor's prescription.\n3. Add items to your cart and enter your delivery address for doorstep delivery from partner pharmacies.";
    } else {
      fallbackAnswer = "AarogyaGenie is an integrated healthcare platform providing AI health assistance, doctor appointment bookings, doorstep pharmacy deliveries, diagnostic lab test scheduling, and secure longitudinal medical records tracking.";
    }
  } else if (classification.subject === "OTHER_PERSON") {
    const relName = classification.relationship || "other person";
    const qLower = queryTrimmed.toLowerCase();

    if (/\b(pcod|pcos|polycystic)\b/i.test(qLower)) {
      fallbackAnswer = `For someone managing PCOS / PCOD (such as your ${relName}), here are key clinical precautions and management guidelines:

1. Dietary & Lifestyle Measures:
   • Focus on a balanced, low-glycemic index (GI) diet with complex carbohydrates, lean proteins, and fiber to help regulate insulin levels.
   • Engage in regular moderate physical activity (at least 150 minutes per week) such as brisk walking, swimming, or strength training.
   • Maintain a consistent sleep schedule and manage stress through relaxation techniques.

2. Medical Monitoring & Follow-up:
   • Consult a Gynecologist or Endocrinologist for comprehensive evaluation, hormonal profiling, and pelvic ultrasound if needed.
   • Track menstrual cycle frequency and regularity.
   • Monitor metabolic markers including fasting blood glucose, HbA1c, and lipid profile periodically.

3. When to See a Doctor:
   • Unusually heavy, painful, or absent menstrual bleeding.
   • Significant unexplained weight changes or difficulty managing blood sugar.
   • Always consult a healthcare professional before starting any supplements or medications.`;
    } else if (/\b(diabetes|sugar|glucose)\b/i.test(qLower)) {
      fallbackAnswer = `For someone managing diabetes (such as your ${relName}), standard precautions and lifestyle recommendations include:

1. Dietary Management:
   • Emphasize fiber-rich foods, non-starchy vegetables, whole grains, and lean proteins.
   • Limit refined carbohydrates, sugary beverages, and processed snacks.
   • Maintain regular meal timings to prevent blood sugar spikes and dips.

2. Blood Sugar Monitoring:
   • Regularly monitor blood glucose as recommended by their physician.
   • Track HbA1c levels every 3 to 6 months.

3. Daily Care & Physical Activity:
   • Engage in daily light-to-moderate physical activity (e.g. 30 minutes of walking).
   • Practice daily foot inspection and stay well-hydrated.
   • Follow their prescribing doctor's medication schedule strictly and consult their diabetologist for personalized care.`;
    } else if (/\b(fever|temp|temperature)\b/i.test(qLower)) {
      fallbackAnswer = `For managing fever in another person (such as your ${relName}):
• Ensure adequate rest and plenty of fluids (water, clear broths, oral rehydration solutions).
• Keep them in a cool, well-ventilated room with light clothing.
• Use a cool damp cloth on the forehead for comfort if body temperature is elevated.
• Seek immediate medical attention if fever exceeds 103°F (39.4°C), lasts more than 3 days, or is accompanied by difficulty breathing, confusion, severe headache, or rash.`;
    } else {
      fallbackAnswer = `Here is general healthcare guidance regarding your inquiry for your ${relName}:
• For specific symptoms or medical conditions, maintaining adequate hydration, rest, and a balanced diet is recommended.
• Consult a qualified doctor or relevant medical specialist for an individualized clinical diagnosis and tailored treatment plan.`;
    }
  } else if (classification.subject === "SELF" && classification.isPatientSpecific && patientContext) {
    const qLower = queryTrimmed.toLowerCase();
    
    // Check if query is looking for a specific procedure/test/scan not present in records
    const specificTerms = ["mri", "ct scan", "x-ray", "ultrasound", "biopsy", "endoscopy", "colonoscopy", "ecg", "eeg", "surgery", "dental", "vaccination", "vaccine"];
    const requestedTerm = specificTerms.find((term) => qLower.includes(term));

    if (requestedTerm) {
      const hasTermInRecords =
        patientContext.recentLabReports.some((l) => l.testName.toLowerCase().includes(requestedTerm) || (l.results && l.results.toLowerCase().includes(requestedTerm))) ||
        patientContext.recentDiagnosticBookings.some((d) => d.testName.toLowerCase().includes(requestedTerm)) ||
        patientContext.recentTimeline.some((t) => t.title.toLowerCase().includes(requestedTerm) || (t.description && t.description.toLowerCase().includes(requestedTerm)));

      if (!hasTermInRecords) {
        return {
          answer: `According to your recorded AarogyaGenie health profile, no records were found for ${requestedTerm.toUpperCase()}. You currently have no ${requestedTerm.toUpperCase()} reports or diagnostic bookings on file.`,
          usedRag: false,
          category: classification.category,
          subject: classification.subject,
          intent: classification.intent,
          sources: sourcesMeta,
          retrieval: { topK, resultsUsed: matches.length },
          disclaimer: "⚠️ Grounded in your AarogyaGenie database records.",
        };
      }
    }

    const sections: string[] = [];
    const isMedsQuery = classification.intent === "PRESCRIPTION" || classification.intent === "MEDICATION" || /\b(medicine|med|meds|order|ordered|pharmacy|prescription|prescribed|dose|tablet|pill)\b/i.test(qLower);
    const isApptQuery = classification.intent === "APPOINTMENT" || classification.intent === "DOCTOR" || /\b(doctor|dr|appointment|appointments|visit|consultation|clinic|hospital)\b/i.test(qLower);
    const isLabQuery = classification.intent === "LAB_REPORT" || /\b(lab|labs|test|tests|report|reports|result|results|blood|hemoglobin|glucose)\b/i.test(qLower);
    const isSymptomQuery = classification.intent === "SYMPTOM" || /\b(symptom|symptoms|fever|cough|pain|headache)\b/i.test(qLower);

    if (isMedsQuery && patientContext.recentPrescriptions.length > 0) {
      sections.push(`Doctor Prescriptions:\n${patientContext.recentPrescriptions.map((p) => `• ${p.date}: ${p.diagnosis} by ${p.doctorName} (Medicines: ${p.medicines})`).join("\n")}`);
    }
    if (isMedsQuery && patientContext.recentMedicineOrders.length > 0) {
      sections.push(`Medicine Orders:\n${patientContext.recentMedicineOrders.map((o) => `• Order #${o.id} on ${o.date} (${o.status.toUpperCase()}): ${o.medicines}${o.pharmacyName ? ` from ${o.pharmacyName}` : ""}`).join("\n")}`);
    }
    if (isLabQuery && patientContext.recentLabReports.length > 0) {
      sections.push(`Lab Reports & Test Results:\n${patientContext.recentLabReports.map((l) => `• ${l.date}: ${l.testName} (${l.results || "Completed"})${l.aiSummary ? ` - ${l.aiSummary}` : ""}`).join("\n")}`);
    }
    if (isApptQuery && patientContext.recentAppointments.length > 0) {
      sections.push(`Doctor Consultations:\n${patientContext.recentAppointments.map((a) => `• ${a.appointmentDate}: ${a.doctorName}${a.specialty ? ` (${a.specialty})` : ""} - Status: ${a.status.toUpperCase()}`).join("\n")}`);
    }
    if (isSymptomQuery && patientContext.recentSymptoms.length > 0) {
      sections.push(`Reported Symptoms:\n${patientContext.recentSymptoms.map((s) => `• ${s.date}: ${s.symptoms}${s.severity ? ` (Severity: ${s.severity})` : ""}`).join("\n")}`);
    }

    if (sections.length > 0) {
      fallbackAnswer = `Your recorded AarogyaGenie health records show:\n\n${sections.join("\n\n")}`;
    } else {
      fallbackAnswer = "According to your recorded AarogyaGenie health profile, no matching records were found for this inquiry.";
    }
  } else {
    // Generic Medical Question Fallback
    const qLower = queryTrimmed.toLowerCase();
    if (/\b(dengue)\b/i.test(qLower)) {
      fallbackAnswer = `Dengue fever is a mosquito-borne viral infection caused by the dengue virus and transmitted primarily by Aedes mosquitoes.

Common Symptoms:
• Sudden high fever (104°F / 40°C)
• Severe headache and intense pain behind the eyes
• Joint, muscle, and body aches ("breakbone fever")
• Nausea, vomiting, and fatigue
• Mild skin rash appearing 2–5 days after fever onset

Key Precautions & Home Care:
• Maintain strict hydration with water, oral rehydration solutions (ORS), coconut water, and clear soups.
• Get adequate bed rest.
• Avoid NSAIDs such as Ibuprofen or Aspirin as they can increase bleeding risk; Paracetamol may be used for fever reduction under medical guidance.

Warning Signs (Seek Urgent Care):
• Severe abdominal pain, persistent vomiting, mucosal bleeding (nose or gums), or rapid platelet drop. Consult a doctor immediately.`;
    } else if (/\b(pcod|pcos|polycystic)\b/i.test(qLower)) {
      fallbackAnswer = `PCOS (Polycystic Ovary Syndrome) / PCOD is a common hormonal condition that affects how the ovaries function.

Common Characteristics & Symptoms:
• Irregular, infrequent, or prolonged menstrual cycles
• Elevated androgen levels (leading to facial hair, acne, or male-pattern hair thinning)
• Polycystic ovaries (enlarged ovaries with multiple small follicles visible on ultrasound)
• Weight management challenges and insulin resistance

General Precautions & Management:
• Nutrition: Adopt a low-glycemic, balanced diet rich in vegetables, lean proteins, and fiber to support insulin sensitivity.
• Physical Activity: Regular exercise (at least 30 minutes of moderate activity daily) helps regulate hormones and metabolism.
• Medical Care: Consult a Gynecologist or Endocrinologist for individualized hormonal evaluation and regular health monitoring.`;
    } else if (/\b(anemia|hemoglobin|iron deficiency|ferritin|low hb)\b/i.test(qLower)) {
      fallbackAnswer = `Hemoglobin is an iron-rich protein in red blood cells that transports oxygen throughout your body.

Common Causes of Low Hemoglobin & Anemia:
• Iron deficiency (due to insufficient dietary iron intake or poor absorption)
• Vitamin B12 or folate deficiencies
• Blood loss (from heavy menstrual bleeding, gastrointestinal bleeding, or injury)
• Chronic conditions affecting red blood cell production

Warning Signs & Symptoms:
• Persistent fatigue, weakness, and reduced stamina
• Pale or yellowish skin, brittle nails
• Dizziness, lightheadedness, or shortness of breath on mild exertion
• Cold hands and feet

General Recommendations:
• Increase intake of iron-rich foods (leafy greens, beans, lentils, fortified cereals, lean meats) combined with Vitamin C for better absorption.
• Consult your doctor for a Complete Blood Count (CBC) and serum ferritin evaluation before taking iron supplements.`;
    } else if (/\b(hypertension|high blood pressure|high bp|blood pressure)\b/i.test(qLower)) {
      fallbackAnswer = `Hypertension (high blood pressure) occurs when the pressure of blood against arterial walls is consistently elevated (generally ≥ 130/80 mmHg).

Key Causes & Contributing Factors:
• High dietary sodium (salt) intake and low potassium
• Sedentary lifestyle, physical inactivity, and obesity
• Chronic emotional stress and inadequate sleep
• Genetic predisposition and family history

Lifestyle & Management Guidelines:
• Adopt the DASH diet (rich in fruits, vegetables, whole grains, and low-fat dairy with reduced sodium).
• Aim for at least 30 minutes of moderate aerobic exercise daily.
• Monitor blood pressure regularly and consult a physician for personalized cardiovascular risk evaluation.`;
    } else if (/\b(diabetes|blood sugar|glucose|hba1c)\b/i.test(qLower)) {
      fallbackAnswer = `Diabetes Mellitus is a metabolic condition characterized by elevated blood glucose levels due to insulin deficiency or insulin resistance.

Key Management Guidelines:
• Dietary Balance: Focus on fiber-rich, low-glycemic foods, lean proteins, and complex carbohydrates; limit refined sugars.
• Physical Activity: Regular moderate aerobic and resistance exercise helps improve insulin sensitivity.
• Monitoring: Track fasting and post-prandial blood glucose as directed, with HbA1c testing every 3 to 6 months.
• Consult an Endocrinologist or Diabetologist for personalized medication and lifestyle planning.`;
    } else {
      fallbackAnswer =
        "I am AarogyaGenie AI, your medical assistant. For specific health concerns or personalized diagnoses, please consult a verified doctor or healthcare professional.";
    }
  }

  return {
    answer: fallbackAnswer,
    usedRag,
    category: classification.category,
    subject: classification.subject,
    intent: classification.intent,
    sources: sourcesMeta,
    retrieval: {
      topK,
      resultsUsed: matches.length,
    },
    disclaimer:
      classification.subject === "SELF" && classification.isPatientSpecific
        ? "⚠️ Answer grounded in your AarogyaGenie database records. Consult your doctor for medical decisions."
        : "⚠️ Informational medical guidance based on clinical reference standards. Not a substitute for professional medical diagnosis or treatment.",
  };
}

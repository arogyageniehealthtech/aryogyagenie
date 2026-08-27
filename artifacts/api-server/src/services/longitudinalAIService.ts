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

  // 1B. Explicit Non-Medical Domain Rejection (REMOVED: Now handled as GENERIC_KNOWLEDGE)

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

  const explicitlyAskedForDocument = /\b(according to|document|knowledge base|uploaded|from the database)\b/i.test(queryTrimmed);
  let emptyRagMessage = "";
  if (explicitlyAskedForDocument && matches.length === 0) {
    emptyRagMessage = "CRITICAL: The user explicitly asked about information from a document, but NO relevant documents were found in the knowledge base. You MUST inform the user clearly that the knowledge base does not contain this information, and do not invent an answer.";
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
   - Do not prescribe prescription-only medications or alter dosages. Encourage consulting a qualified healthcare professional.
5. RAG / HYBRID HALLUCINATION PREVENTION:
   - Answer using the retrieved context when the question concerns the application's knowledge base. 
   - Do not fabricate facts, sources, document contents, or citations. 
   - If the retrieved context does not contain enough information to answer the question, clearly say that the available knowledge base does not provide sufficient information. 
   - You may use general reasoning to explain retrieved information, but do not present unsupported information as if it came from the knowledge base.`;

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
  } else if (classification.category === "GENERIC_KNOWLEDGE") {
    systemPrompt = `You are AarogyaGenie AI, a helpful and versatile AI assistant.
Your job is to answer general knowledge, coding, and casual conversation questions accurately and clearly.

${formattedHistory}USER QUESTION: "${queryTrimmed}"

${commonSafetyRules}
6. Provide a helpful, accurate, and easy-to-understand explanation or answer.
7. If the user asks a casual question (like a joke, coding question, or general fact), answer it naturally.
8. Do NOT pretend to retrieve medical documents for this generic query.
9. Respond in the same language the user used.`;
  } else {
    // GENERIC_MEDICAL or GENERAL_CONVERSATION
    systemPrompt = `You are AarogyaGenie AI, a trusted, empathetic, and clinically grounded medical AI assistant.
Your job is to answer ANY health, medical, wellness, nutrition, fitness, mental health, or symptom-related question thoroughly, accurately, and compassionately.

${formattedHistory}${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : ""}${emptyRagMessage ? `\n\n${emptyRagMessage}\n\n` : ""}PATIENT HEALTH QUESTION: "${queryTrimmed}"

${commonSafetyRules}
5. Provide a comprehensive, medically accurate, and easy-to-understand explanation. NEVER give a one-liner dismissal — always provide actionable, helpful information.
6. Always structure your response clearly using these sections where relevant:
   🔍 **Overview**: Direct explanation of the condition, symptom, medication, or health topic
   🧬 **Common Causes / Mechanism**: Why it happens or how it works
   🏡 **Home Care & Precautions**: Practical self-care measures, dietary tips, lifestyle adjustments
   ⚠️ **Warning Signs (Red Flags)**: Specific symptoms that require urgent medical attention
   👨‍⚕️ **Medical Guidance**: Which specialist to consult, what tests may be needed
7. For medication or supplement questions: explain the drug class, common uses, typical dosage ranges (general reference only, not a prescription), and important safety cautions.
8. For nutrition, fitness, or wellness questions: give evidence-based, practical, actionable advice with specific food examples or exercise recommendations.
9. For mental health topics (anxiety, depression, stress, sleep disorders): provide compassionate, evidence-based guidance including coping strategies and when to seek professional help.
10. For questions about lab test results or medical terms: explain what the test measures, normal reference ranges, and what abnormal values may suggest.
11. Do NOT refer to logged-in user health records or prescriptions (this is a generic inquiry).
12. Use simple, accessible language and explain medical terms in parentheses where needed.
13. Respond in the same language the user used (English or Hindi as appropriate).`;
  }

  // ── Step 4: Call Gemini LLM (with retry & backoff) ─────────────────────────
  try {
    const rawAnswer = await callLLM(systemPrompt, 900);
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
    // Generic Medical Question Fallback — comprehensive multi-condition engine
    const qLower = queryTrimmed.toLowerCase();

    if (/\b(dengue)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Dengue Fever Overview**
Dengue is a mosquito-borne viral infection transmitted primarily by Aedes aegypti mosquitoes, common in tropical and subtropical regions.

**Common Symptoms:**
• Sudden high fever (104°F / 40°C) lasting 2–7 days
• Severe headache and intense pain behind the eyes
• Joint, muscle, and body aches ("breakbone fever")
• Nausea, vomiting, and fatigue
• Mild skin rash appearing 2–5 days after fever onset

🏡 **Home Care & Precautions:**
• Maintain strict hydration with water, ORS, coconut water, and clear soups.
• Adequate bed rest is essential.
• Avoid NSAIDs (Ibuprofen, Aspirin) — they increase bleeding risk. Paracetamol may be used for fever under medical guidance.
• Use mosquito repellents and nets to prevent further spread.

⚠️ **Warning Signs (Seek Immediate Care):**
• Severe abdominal pain, persistent vomiting, mucosal bleeding (nose/gums), platelet drop below 100,000.
• Difficulty breathing or blood in urine/stool — visit an emergency room immediately.`;

    } else if (/\b(malaria)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Malaria Overview**
Malaria is a life-threatening parasitic infection transmitted through the bite of infected female Anopheles mosquitoes.

**Common Symptoms:**
• Cyclic high fever with chills and rigors (shaking)
• Profuse sweating after fever breaks
• Severe headache, body aches, fatigue
• Nausea, vomiting, and sometimes jaundice

🏡 **Prevention & Care:**
• Use mosquito nets (preferably insecticide-treated) and repellents.
• Eliminate stagnant water around your home.
• Stay hydrated and rest adequately.

⚠️ **Important:** Malaria requires prompt laboratory testing (blood smear or RDT) and prescription antimalarial medication. Seek medical care immediately if fever with chills develops in a malaria-prone area.`;

    } else if (/\b(typhoid)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Typhoid Fever Overview**
Typhoid is a bacterial infection caused by Salmonella typhi, spread through contaminated food and water.

**Common Symptoms:**
• Prolonged high fever (gradually rising over days)
• Severe abdominal pain, loss of appetite
• Headache, weakness, and muscle aches
• Diarrhea or constipation

🏡 **Home Care:**
• Strict oral hydration (boiled water, ORS)
• Bland, easily digestible foods (khichdi, curd, bananas)
• Complete rest until fever resolves

⚠️ **Medical Guidance:**
Typhoid requires a Widal test or blood culture for diagnosis and antibiotic treatment (typically Azithromycin or Ciprofloxacin under doctor prescription). Do not self-medicate antibiotics.`;

    } else if (/\b(pcod|pcos|polycystic)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **PCOS / PCOD Overview**
PCOS (Polycystic Ovary Syndrome) is a common hormonal condition affecting reproductive-aged women, causing hormonal imbalances and metabolic issues.

**Common Symptoms:**
• Irregular, infrequent, or prolonged menstrual cycles
• Elevated androgen levels (facial hair, acne, hair thinning)
• Enlarged ovaries with multiple small follicles (visible on ultrasound)
• Weight management challenges and insulin resistance

🏡 **Management & Precautions:**
• Nutrition: Low-glycemic diet rich in vegetables, lean proteins, and fiber.
• Physical Activity: 30+ minutes of moderate daily exercise helps regulate hormones.
• Stress Management: Chronic stress worsens hormonal imbalances; yoga and mindfulness help.

👨‍⚕️ **Medical Guidance:**
Consult a Gynecologist or Endocrinologist for hormonal evaluation, pelvic ultrasound, and personalized treatment.`;

    } else if (/\b(anemia|hemoglobin|iron deficiency|ferritin|low hb)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Anemia / Low Hemoglobin Overview**
Anemia occurs when your blood lacks enough healthy red blood cells or hemoglobin to carry adequate oxygen to body tissues.

**Common Causes:**
• Iron deficiency (most common — poor diet or poor absorption)
• Vitamin B12 or folate deficiency
• Blood loss (heavy periods, GI bleeding)
• Chronic diseases (kidney disease, cancer, inflammation)

**Symptoms:**
• Persistent fatigue, weakness, reduced stamina
• Pale or yellowish skin, brittle nails, hair loss
• Dizziness, lightheadedness, shortness of breath on mild exertion

🏡 **Dietary Recommendations:**
• Iron-rich foods: leafy greens (spinach, methi), lentils, beans, fortified cereals, lean red meat, tofu
• Vitamin C (citrus, amla, tomatoes) with iron-rich meals to enhance absorption
• Vitamin B12 sources: dairy, eggs, fish, or B12 supplements if vegetarian/vegan

👨‍⚕️ **Medical Guidance:**
Get a CBC (Complete Blood Count) and serum ferritin test before starting iron supplements.`;

    } else if (/\b(hypertension|high blood pressure|high bp|blood pressure)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Hypertension (High Blood Pressure) Overview**
Hypertension is consistently elevated blood pressure (≥ 130/80 mmHg), a major risk factor for heart disease, stroke, and kidney failure.

**Common Causes:**
• High dietary sodium (salt) intake
• Physical inactivity and obesity
• Chronic emotional stress and poor sleep
• Genetic predisposition and advancing age

🏡 **Lifestyle Management:**
• DASH Diet: Rich in fruits, vegetables, whole grains, low-fat dairy; reduce salt to < 5g/day
• Exercise: 30+ minutes of moderate aerobic activity most days
• Limit alcohol, avoid smoking, and manage stress through meditation or yoga
• Monitor BP regularly at home

⚠️ **Warning Signs (Hypertensive Crisis):**
Severe headache, blurred vision, chest pain, or BP > 180/120 mmHg — seek emergency care immediately.

👨‍⚕️ Consult a physician or cardiologist if lifestyle changes are insufficient.`;

    } else if (/\b(diabetes|blood sugar|glucose|hba1c|type 1|type 2)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Diabetes Mellitus Overview**
Diabetes is a chronic metabolic condition characterized by elevated blood glucose due to insulin deficiency (Type 1) or insulin resistance (Type 2).

**Key Symptoms:**
• Frequent urination, excessive thirst and hunger
• Unexplained weight loss (Type 1) or weight gain (Type 2)
• Blurred vision, fatigue, slow-healing wounds
• Tingling or numbness in hands/feet

🏡 **Management Guidelines:**
• Dietary Balance: Low-glycemic foods, fiber-rich vegetables, lean proteins; limit refined sugars and white rice
• Exercise: 30+ minutes daily of moderate aerobic + resistance training
• Monitoring: Fasting glucose (< 100 mg/dL), post-meal glucose (< 140 mg/dL), HbA1c (< 7% ideally)

⚠️ **Diabetic Emergency Signs:**
• Hypoglycemia: Shakiness, sweating, confusion — eat glucose immediately
• Hyperglycemia: Extreme thirst, fruity breath, vomiting — seek emergency care

👨‍⚕️ Consult an Endocrinologist or Diabetologist for personalized medication and complication screening.`;

    } else if (/\b(thyroid|tsh|hypothyroid|hyperthyroid|goiter)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Thyroid Disorders Overview**
The thyroid gland regulates metabolism, energy, and growth through thyroid hormones (T3, T4).

**Hypothyroidism (underactive thyroid):**
• Fatigue, weight gain, cold intolerance, constipation, depression, hair loss, dry skin
• TSH elevated (> 4.5 mIU/L), T3/T4 low
• Treatment: Levothyroxine (prescription hormone replacement)

**Hyperthyroidism (overactive thyroid):**
• Weight loss, rapid heartbeat, anxiety, heat intolerance, tremors, excessive sweating
• TSH suppressed (< 0.5 mIU/L), T3/T4 elevated
• Treatment: Antithyroid drugs, radioactive iodine, or surgery

🏡 **Dietary Tips:**
• Hypothyroidism: Ensure adequate iodine (iodized salt, seafood)
• Hyperthyroidism: Avoid iodine-rich foods; calcium-rich diet to protect bones

👨‍⚕️ Consult an Endocrinologist for TSH, T3, T4 testing and personalized treatment.`;

    } else if (/\b(asthma|inhaler|bronchial|wheez)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Asthma Overview**
Asthma is a chronic inflammatory airway disease causing recurrent episodes of wheezing, breathlessness, chest tightness, and cough.

**Common Triggers:**
• Allergens: dust mites, pollen, pet dander, mold
• Respiratory infections, cold air, exercise
• Smoke, air pollution, strong odors, emotional stress

🏡 **Management & Precautions:**
• Identify and avoid personal triggers
• Use prescribed inhalers as directed: reliever (Salbutamol) for acute symptoms, controller (Budesonide) for daily prevention
• Practice breathing exercises and keep windows closed during high pollen season

⚠️ **Asthma Attack Warning Signs:**
Rapid breathing, inability to speak full sentences, bluish lips — use reliever inhaler and seek emergency care immediately.

👨‍⚕️ Consult a Pulmonologist for an Asthma Action Plan and spirometry lung function testing.`;

    } else if (/\b(migraine|severe headache|cluster headache)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Migraine Overview**
Migraines are intense, recurring headaches often accompanied by nausea, vomiting, and sensitivity to light and sound. They can last 4–72 hours.

**Common Triggers:**
• Stress, irregular sleep, skipped meals
• Hormonal changes (menstrual cycle in women)
• Certain foods: caffeine, alcohol, aged cheese, processed meats
• Bright lights, loud noise, strong smells

🏡 **Home Care:**
• Rest in a dark, quiet room during an attack
• Apply cold or warm compress to the head/neck
• Stay well-hydrated and maintain a regular sleep schedule
• Track triggers using a headache diary

**Medications (consult a doctor):**
• Mild attacks: Paracetamol, Ibuprofen, Aspirin
• Moderate-severe attacks: Prescription triptans (e.g., Sumatriptan)

⚠️ **See a Doctor if:** Headache is the worst of your life, sudden onset (thunderclap), with fever/stiff neck, or after head injury.`;

    } else if (/\b(fever|temperature|pyrexia)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Fever Overview**
Fever is a temporary rise in body temperature (above 98.6°F / 37°C), typically a sign that your immune system is fighting an infection.

**Common Causes:**
• Viral infections (flu, cold, COVID-19, dengue)
• Bacterial infections (UTI, pneumonia, typhoid)
• Inflammatory conditions, medications, heat exhaustion

🏡 **Home Care:**
• Stay well-hydrated (water, ORS, clear soups, coconut water)
• Rest and light, easily digestible meals
• Dress lightly; cool sponging of forehead if temperature is high
• Paracetamol (as per package instructions) to reduce fever and discomfort

⚠️ **Seek Immediate Medical Care if:**
• Temperature > 104°F (40°C) or fever lasting > 3 days
• Infant under 3 months with any fever
• Fever with severe headache, stiff neck, rash, difficulty breathing, confusion, or seizures`;

    } else if (/\b(cough|cold|sore throat|runny nose|flu|influenza)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Common Cold, Flu & Respiratory Infections**
Viral upper respiratory infections are extremely common, especially during seasonal changes.

**Distinguishing Cold vs. Flu:**
• Cold: Gradual onset, mild fever, runny nose, sneezing, sore throat
• Flu: Sudden onset, high fever, severe body aches, fatigue, dry cough

🏡 **Home Care:**
• Rest and adequate fluid intake (warm water, herbal teas, soups, honey-ginger-lemon)
• Steam inhalation for nasal congestion
• Saltwater gargles for sore throat
• Paracetamol for fever and body aches

**OTC Relief:**
Antihistamines (Cetirizine) for runny nose, decongestants for blocked nose, throat lozenges for sore throat.

⚠️ **See a Doctor if:**
High persistent fever (> 3 days), difficulty breathing, chest pain, symptoms worsening, or yellow/green phlegm suggesting bacterial infection.`;

    } else if (/\b(stomach|gastric|acidity|gerd|acid reflux|heartburn|ulcer|ibs|bloating|indigestion|constipation|diarrhea|nausea|gastroenteritis)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Gastrointestinal (Stomach) Health Overview**
Gastric issues are among the most common health complaints, ranging from mild indigestion to chronic conditions.

**Common Conditions:**
• **Acidity/GERD**: Burning sensation in chest (heartburn) due to stomach acid reflux. Avoid spicy/fatty foods, eat smaller meals, don't lie down immediately after eating.
• **IBS (Irritable Bowel Syndrome)**: Alternating constipation/diarrhea with cramping. Managed through diet (low-FODMAP) and stress reduction.
• **Gastroenteritis (Stomach Flu)**: Nausea, vomiting, diarrhea — usually viral, resolves in 2–3 days with hydration.
• **Constipation**: < 3 bowel movements/week. Increase fiber (fruits, vegetables, whole grains) and water intake.

🏡 **General Digestive Health Tips:**
• Eat slowly, chew thoroughly, maintain regular meal times
• Stay well-hydrated (8–10 glasses of water daily)
• Regular physical activity improves gut motility
• Probiotics (curd, yogurt) support gut microbiome health

⚠️ **Red Flags (Seek Immediate Care):**
Blood in stool, black tarry stool, severe abdominal pain, persistent vomiting, unexplained significant weight loss.`;

    } else if (/\b(kidney|renal|creatinine|uti|urinary|kidney stone|nephro)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Kidney Health Overview**
The kidneys filter waste products, regulate blood pressure, and maintain electrolyte balance.

**Common Kidney Conditions:**
• **UTI (Urinary Tract Infection)**: Burning urination, frequent urge, cloudy urine, pelvic pain. Needs antibiotic treatment.
• **Kidney Stones**: Severe flank pain radiating to groin, blood in urine, nausea. Small stones may pass naturally with high fluid intake.
• **Chronic Kidney Disease (CKD)**: Elevated creatinine; managed through diet, blood pressure control, and specialist care.

🏡 **Kidney Health Precautions:**
• Drink 8–12 glasses of water daily
• Limit sodium, processed foods, and animal protein
• Control blood pressure and blood sugar
• Avoid overuse of NSAIDs (Ibuprofen) as they can damage kidneys

👨‍⚕️ Consult a Nephrologist if creatinine is elevated or symptoms are persistent.`;

    } else if (/\b(cholesterol|lipid|triglycerides|ldl|hdl|cardiovascular|heart disease|coronary)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Cholesterol & Cardiovascular Health**
Cholesterol is a fatty substance essential for body functions, but elevated LDL ("bad") cholesterol increases heart disease and stroke risk.

**Understanding Lipid Profile:**
• Total Cholesterol: < 200 mg/dL (desirable)
• LDL Cholesterol: < 100 mg/dL (optimal)
• HDL Cholesterol: > 40 mg/dL men, > 50 mg/dL women (higher is better)
• Triglycerides: < 150 mg/dL (normal)

🏡 **Lifestyle Modifications:**
• Diet: Reduce saturated fats (ghee, butter, red meat, fried foods), trans fats; increase omega-3 rich foods (fish, flaxseeds, walnuts)
• Exercise: 150 minutes/week of moderate aerobic activity raises HDL
• Quit smoking, limit alcohol; increase dietary fiber (oats, beans, fruits) to reduce LDL

👨‍⚕️ Consult a Cardiologist or physician if lifestyle changes are insufficient — statins (like Atorvastatin) may be prescribed.`;

    } else if (/\b(anxiety|panic|stress|mental health|depression|insomnia|sleep|burnout)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Mental Health & Wellness Overview**
Mental health conditions like anxiety, depression, stress, and insomnia are extremely common and completely treatable.

**Anxiety & Stress:**
• Symptoms: Excessive worry, restlessness, rapid heart rate, difficulty concentrating, sleep disturbances
• Management: Deep breathing exercises (4-7-8 technique), progressive muscle relaxation, mindfulness meditation, regular exercise

**Depression:**
• Symptoms: Persistent sadness, loss of interest, fatigue, changes in appetite/sleep, feelings of worthlessness
• Treatment: Cognitive Behavioral Therapy (CBT), medication (SSRIs/SNRIs), regular social connection, and exercise

**Insomnia / Sleep Disorders:**
• Maintain a consistent sleep schedule; avoid screens 1 hour before bed
• Keep bedroom dark, quiet, and cool (16–19°C)
• Avoid caffeine after 2 PM; limit alcohol

🏡 **Universal Mental Wellness Tips:**
• Regular aerobic exercise (proven antidepressant effect)
• Strong social support network and journaling

⚠️ If symptoms significantly impair daily functioning, or you have thoughts of self-harm, please consult a Psychiatrist or Psychologist immediately.`;

    } else if (/\b(vitamin|supplement|zinc|calcium|magnesium|omega|b12|d3|vitamin d|vitamin c|folate|folic acid)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Vitamins & Nutritional Supplements Overview**
Vitamins and minerals are essential micronutrients. Deficiencies are common and can cause significant health problems.

**Common Deficiencies in India:**
• **Vitamin D**: Deficiency causes bone weakness, muscle weakness, immune dysfunction. Sources: sunlight, fatty fish, fortified milk, eggs. Supplement: Vitamin D3 (1000–2000 IU/day, or as prescribed).
• **Vitamin B12**: Deficiency causes neurological symptoms, fatigue, anemia — common in vegetarians. Sources: dairy, eggs, fish, B12 supplements.
• **Iron**: See anemia section. Important especially for women and children.
• **Calcium**: Essential for bone, nerve, and muscle health. Sources: dairy, leafy greens, sesame seeds.
• **Omega-3 Fatty Acids**: Anti-inflammatory; support heart and brain health. Sources: fatty fish (salmon, mackerel), flaxseeds, walnuts.

⚠️ **Important:** Get blood tests to identify specific deficiencies before starting supplements. Excessive supplementation can be harmful.`;

    } else if (/\b(weight loss|obesity|overweight|bmi|diet|calorie|fat loss|weight management|keto|intermittent fasting)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Weight Management Overview**
Healthy weight management is about sustainable lifestyle changes, not crash diets.

**Understanding BMI:**
• Underweight: < 18.5 | Normal: 18.5–24.9 | Overweight: 25–29.9 | Obese: ≥ 30

**Evidence-Based Weight Loss Principles:**
• Caloric deficit of 500–750 kcal/day leads to ~0.5–0.75 kg/week weight loss (safe and sustainable)
• Focus on whole foods: vegetables, fruits, lean protein (chicken, fish, legumes), complex carbohydrates
• Reduce ultra-processed foods, refined sugars, and sugary beverages
• Protein intake (1.2–1.6 g/kg body weight) preserves muscle mass during weight loss

🏡 **Exercise:**
• Combination of cardio (150+ min/week) and resistance training is most effective
• Even walking 10,000 steps daily significantly improves metabolic health

👨‍⚕️ Consult a Nutritionist/Dietitian for a personalized meal plan. If obesity is severe, consult an Endocrinologist to rule out hormonal causes.`;

    } else if (/\b(pregnancy|prenatal|antenatal|trimester|morning sickness|maternal)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Pregnancy Health Overview**

**First Trimester (Weeks 1–12):**
• Start Folic Acid (400–800 mcg/day) before conception and through first trimester to prevent neural tube defects
• Common: morning sickness, fatigue, breast tenderness — typically improve by week 12
• Avoid alcohol, smoking, raw/undercooked foods, excess caffeine

**Important Supplements During Pregnancy:**
• Folic acid, Iron, Calcium, Vitamin D, Iodine (as prescribed by OB/GYN)

**Prenatal Care:**
• Regular antenatal check-ups are critical
• Ultrasound scans at 11–14 weeks (dating/NT scan), 18–20 weeks (anomaly scan)
• Safe exercise: walking, prenatal yoga, swimming

⚠️ **Red Flags (Seek Immediate Care):**
Heavy bleeding, severe abdominal pain, reduced fetal movements, severe headache/visual disturbances, sudden swelling of face/hands/feet (preeclampsia signs).`;

    } else if (/\b(skin|acne|eczema|psoriasis|rash|hives|dermatitis|pimple|fungal|ringworm|dandruff)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Skin Health Overview**

**Common Skin Conditions:**
• **Acne/Pimples**: Caused by clogged pores, bacteria, hormonal changes. Management: gentle cleansing, salicylic acid or benzoyl peroxide (topical). Severe cases: consult a Dermatologist for retinoids or antibiotics.
• **Eczema (Atopic Dermatitis)**: Itchy, inflamed skin. Triggers: soap, detergents, dry skin, stress. Management: fragrance-free moisturizers, mild steroid creams (short-term).
• **Psoriasis**: Scaly, red plaques. Chronic condition requiring ongoing medical management.
• **Fungal Infections (Ringworm/Athlete's Foot)**: Antifungal creams (Clotrimazole, Terbinafine) for 2–4 weeks; keep affected area clean and dry.
• **Dandruff**: Antifungal shampoos (Ketoconazole, Zinc Pyrithione).

🏡 **General Skin Care Tips:**
• Daily gentle cleansing with pH-balanced cleanser
• Broad-spectrum sunscreen (SPF 30+) every morning
• Adequate hydration and a diet rich in antioxidants

👨‍⚕️ Consult a Dermatologist for persistent, spreading, or undiagnosed skin conditions.`;

    } else if (/\b(back pain|spine|lumbar|neck pain|joint pain|arthritis|rheumatoid|osteoporosis|muscle pain|sprain|physiotherapy)\b/i.test(qLower)) {
      fallbackAnswer = `🔍 **Musculoskeletal Pain Overview (Back, Joints & Muscles)**

**Common Causes of Back/Joint Pain:**
• Muscle strain or poor posture (most common)
• Disc herniation (slipped disc) — radiating pain to legs (sciatica)
• Arthritis (Osteoarthritis in elderly; Rheumatoid Arthritis — autoimmune)
• Osteoporosis — reduced bone density, fracture risk

🏡 **Home Care for Mild-Moderate Pain:**
• RICE Method (Rest, Ice, Compression, Elevation) for acute injuries
• Warm compress or heating pad for chronic muscle stiffness
• Gentle stretching, yoga, or physiotherapy exercises
• OTC pain relief: Paracetamol, or topical Diclofenac gel
• Correct your sitting/standing posture; use ergonomic furniture

⚠️ **See a Doctor Urgently if:**
• Pain radiates down legs with numbness/weakness (possible nerve compression)
• Bowel or bladder control changes with back pain
• Pain unresponsive to medications after 2 weeks

👨‍⚕️ Consult an Orthopedist, Rheumatologist, or Physiotherapist as appropriate.`;

    } else {
      // Ultimate generic health question fallback
      fallbackAnswer = `Hello! I'm AarogyaGenie AI, your trusted health assistant. 👋

I'm here to help you with any health-related question — symptoms, medications, conditions, nutrition, mental wellness, preventive care, or healthcare guidance.

**What I can help you with:**
• 🩺 **Symptoms & Conditions**: Understand what symptoms mean, common causes, and when to seek care
• 💊 **Medications**: Drug information, usage, side effects, and safety guidance
• 🥗 **Nutrition & Lifestyle**: Diet advice, weight management, exercise recommendations
• 🧠 **Mental Health**: Anxiety, depression, stress, sleep guidance
• 🔬 **Lab Tests**: Understanding blood reports, normal ranges, and what they mean
• 🏥 **Healthcare Navigation**: Which specialist to see for your concern

Please describe your health concern in more detail, and I'll provide comprehensive medical guidance tailored to your question.

⚠️ *AarogyaGenie AI provides health education and guidance, not a medical diagnosis. Always consult a qualified healthcare professional for medical decisions.*`;
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

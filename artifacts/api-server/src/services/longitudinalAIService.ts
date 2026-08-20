import { db, healthEpisodesTable, patientAiSummariesTable, labReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { buildPatientHealthContext, formatContextSummaryText, type PatientHealthContextData } from "./patientContextBuilder";
import { searchMedicalKnowledge } from "./ragService";
import { callLLM } from "./aiGateway";
import { classifyDomainAndIntent, type DomainCategory } from "./aiDomainClassifier";

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
 * Medical-domain conversational assistant with intelligent RAG and complete patient-context retrieval.
 */
export async function answerLongitudinalAssistant(
  patientId: number,
  query: string,
  history?: ChatHistoryTurn[]
): Promise<AssistantAnswerResponse> {
  const queryTrimmed = query.trim();

  // ── Step 1: Intelligent Intent & Domain Classification ─────────────────────
  const classification = classifyDomainAndIntent(queryTrimmed, history);

  // 1A. Emergency Triage Precedence
  if (classification.isEmergency) {
    return {
      answer: classification.emergencyMessage || "🚨 EMERGENCY ALERT: Please call local emergency services immediately.",
      usedRag: false,
      category: "EMERGENCY",
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
      sources: [],
      retrieval: { topK: 0, resultsUsed: 0 },
      disclaimer: "ℹ️ AarogyaGenie AI is restricted to the medical and healthcare domain.",
    };
  }

  // ── Step 2: Selective Context Retrieval ────────────────────────────────────
  let patientContextText = "";
  let patientContext: PatientHealthContextData | null = null;

  if (classification.isPatientSpecific || classification.category === "HYBRID") {
    // Selectively query only the relevant modules identified by query analyzer
    patientContext = await buildPatientHealthContext(patientId, classification.targetModules);
    patientContextText = formatContextSummaryText(patientContext);
  }

  // Medical RAG Knowledge Search
  const topK = process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : 5;
  const threshold = process.env.RAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) : 0.52;

  let matches: Awaited<ReturnType<typeof searchMedicalKnowledge>> = [];
  if (classification.isGeneralMedical || classification.category === "HYBRID") {
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

  // Format Conversation History Context
  let formattedHistory = "";
  if (history && history.length > 0) {
    const recentTurns = history.slice(-6); // Last 3 user/assistant turns
    formattedHistory = `RECENT CONVERSATION HISTORY:\n${recentTurns
      .map((t) => `${t.sender === "patient" || t.sender === "user" ? "Patient" : "Assistant"}: ${t.text}`)
      .join("\n")}\n\n`;
  }

  // ── Step 3: Construct Grounded Clinical Prompt ─────────────────────────────
  let systemPrompt = "";

  if (classification.category === "PATIENT_SPECIFIC") {
    systemPrompt = `You are AarogyaGenie AI, the patient's personal healthcare companion.
You are answering a question specifically regarding the patient's recorded medical history, orders, prescriptions, doctors, visits, lab tests, or health timeline on the AarogyaGenie platform.

${formattedHistory}AUTHORIZED PATIENT HEALTHCARE RECORDS FROM DATABASE:
${patientContextText}

PATIENT QUESTION: "${queryTrimmed}"

CRITICAL GROUNDING & ZERO-HALLUCINATION RULES:
1. ONLY reference information that is explicitly stated in the AUTHORIZED PATIENT HEALTHCARE RECORDS above.
2. If the user asks about a specific scan, test (such as MRI, CT scan, X-Ray), surgery, medication, or appointment, FIRST verify if that exact test or item name exists in the records above.
3. If that specific scan or item does NOT appear in the records above (even if other unrelated lab tests exist), you MUST explicitly state:
   "According to your recorded AarogyaGenie health records, there is no record of [test/scan/item] on file."
   NEVER assume that an unrelated record is the requested scan. NEVER fabricate or assume test results.
4. When answering about orders, prescriptions, or doctor visits, provide relevant dates, doctor names, clinics, and statuses from the records clearly.
5. Support temporal reasoning: If the user asks for "last", "recent", "latest", or "in August", refer to the actual dates and chronological ordering in the records.
6. Support cross-module connections: If the user asks about what happened after a visit or what tests followed an appointment, connect the timeline accurately.
7. Provide a warm, clear, professional, and well-structured response (use bullet points where appropriate).`;
  } else if (classification.category === "HYBRID") {
    systemPrompt = `You are AarogyaGenie AI, an intelligent clinical health assistant.
The patient is asking a question that relates to their own health records while also seeking medical guidance or clinical interpretation.

${formattedHistory}${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : ""}AUTHORIZED PATIENT HEALTHCARE RECORDS:
${patientContextText}

PATIENT QUESTION: "${queryTrimmed}"

CRITICAL GROUNDING RULES:
1. Address the patient's specific recorded results, prescriptions, or symptoms (e.g. "Your recorded lab test on [date] showed...").
2. Integrate clinical medical knowledge to explain what the condition, finding, or medication means clinically (causes, significance, dietary/lifestyle measures, discussion points for their doctor).
3. Distinguish clearly between patient facts ("Your records show...") and general medical information ("Generally, clinical guidelines note...").
4. If a specific reading or test is not in their records, gently mention it while still providing the medical explanation of what that test or condition means.
5. Highlight warning signs or red flags if applicable, and advise consulting their doctor for personalized medical evaluation.`;
  } else {
    // GENERAL_MEDICAL
    systemPrompt = `You are AarogyaGenie AI, a trusted, empathetic, and clinically grounded medical AI assistant.
Answer the user's general medical or health question thoroughly, accurately, and compassionately.

${formattedHistory}${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : ""}PATIENT HEALTH QUESTION: "${queryTrimmed}"

CRITICAL MEDICAL RESPONSE GUIDELINES:
1. Provide a comprehensive, medically accurate, and easy-to-understand explanation.
2. Structure your response clearly:
   - Direct explanation / Overview of the condition, symptom, or topic
   - Common causes / mechanisms
   - Practical home care, self-care, or relief measures (where appropriate)
   - Important warning signs (red flags) and when to see a healthcare professional
3. If important information is missing (e.g., patient's age, symptom duration, accompanying signs), ask relevant clarifying questions.
4. If the question asks about potential emergencies (e.g., high fever in infants, severe pain), prioritize safety guidance.
5. Do NOT make definitive medical diagnoses or prescribe specific prescription-only medications.
6. Maintain an empathetic, professional, and supportive tone.`;
  }

  // ── Step 4: Call Gemini LLM (with retry & backoff) ─────────────────────────
  try {
    const rawAnswer = await callLLM(systemPrompt, 650);
    if (rawAnswer && rawAnswer.trim().length > 0) {
      return {
        answer: rawAnswer.trim(),
        usedRag,
        category: classification.category,
        sources: sourcesMeta,
        retrieval: {
          topK,
          resultsUsed: matches.length,
        },
        disclaimer:
          classification.category === "PATIENT_SPECIFIC"
            ? "⚠️ Answer grounded in your AarogyaGenie database records. Consult your doctor for medical decisions."
            : "⚠️ Informational medical guidance based on clinical reference standards. Not a substitute for professional medical diagnosis or treatment.",
      };
    }
  } catch (err) {
    console.error("Error in callLLM:", err);
  }

  // ── Step 5: Deterministic Fallback Engine ──────────────────────────────────
  let fallbackAnswer = "";
  if (classification.isPatientSpecific && patientContext) {
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
          sources: sourcesMeta,
          retrieval: { topK, resultsUsed: matches.length },
          disclaimer: "⚠️ Grounded in your AarogyaGenie database records.",
        };
      }
    }

    const sections: string[] = [];
    const isMedsQuery = /\b(medicine|med|meds|order|ordered|pharmacy|prescription|prescribed|dose|tablet|pill)\b/i.test(qLower);
    const isApptQuery = /\b(doctor|dr|appointment|appointments|visit|consultation|clinic|hospital)\b/i.test(qLower);
    const isLabQuery = /\b(lab|labs|test|tests|report|reports|result|results|blood|hemoglobin|glucose)\b/i.test(qLower);
    const isSymptomQuery = /\b(symptom|symptoms|fever|cough|pain|headache)\b/i.test(qLower);

    if ((isMedsQuery || !isApptQuery && !isLabQuery && !isSymptomQuery) && patientContext.recentPrescriptions.length > 0) {
      sections.push(`Doctor Prescriptions:\n${patientContext.recentPrescriptions.map((p) => `• ${p.date}: ${p.diagnosis} by ${p.doctorName} (Medicines: ${p.medicines})`).join("\n")}`);
    }
    if ((isMedsQuery || !isApptQuery && !isLabQuery && !isSymptomQuery) && patientContext.recentMedicineOrders.length > 0) {
      sections.push(`Medicine Orders:\n${patientContext.recentMedicineOrders.map((o) => `• Order #${o.id} on ${o.date} (${o.status.toUpperCase()}): ${o.medicines}${o.pharmacyName ? ` from ${o.pharmacyName}` : ""}`).join("\n")}`);
    }
    if ((isLabQuery || !isMedsQuery && !isApptQuery && !isSymptomQuery) && patientContext.recentLabReports.length > 0) {
      sections.push(`Lab Reports & Test Results:\n${patientContext.recentLabReports.map((l) => `• ${l.date}: ${l.testName} (${l.results || "Completed"})${l.aiSummary ? ` - ${l.aiSummary}` : ""}`).join("\n")}`);
    }
    if ((isApptQuery || !isMedsQuery && !isLabQuery && !isSymptomQuery) && patientContext.recentAppointments.length > 0) {
      sections.push(`Doctor Consultations:\n${patientContext.recentAppointments.map((a) => `• ${a.appointmentDate}: ${a.doctorName}${a.specialty ? ` (${a.specialty})` : ""} - Status: ${a.status.toUpperCase()}`).join("\n")}`);
    }
    if ((isSymptomQuery || !isMedsQuery && !isApptQuery && !isLabQuery) && patientContext.recentSymptoms.length > 0) {
      sections.push(`Reported Symptoms:\n${patientContext.recentSymptoms.map((s) => `• ${s.date}: ${s.symptoms}${s.severity ? ` (Severity: ${s.severity})` : ""}`).join("\n")}`);
    }

    if (sections.length > 0) {
      fallbackAnswer = `Based on your recorded AarogyaGenie health profile:\n\n${sections.join("\n\n")}`;
    } else {
      fallbackAnswer = "According to your recorded AarogyaGenie health profile, no matching records were found for this inquiry.";
    }
  } else {
    fallbackAnswer =
      "I am AarogyaGenie AI, your medical assistant. For specific health concerns, please consult a verified doctor or healthcare professional.";
  }

  return {
    answer: fallbackAnswer,
    usedRag,
    category: classification.category,
    sources: sourcesMeta,
    retrieval: {
      topK,
      resultsUsed: matches.length,
    },
    disclaimer: "⚠️ Informational response grounded in verified database records.",
  };
}

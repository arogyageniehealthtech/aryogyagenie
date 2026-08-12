import { db, healthEpisodesTable, patientAiSummariesTable, labReportsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { buildPatientHealthContext, formatContextSummaryText } from "./patientContextBuilder";
import { searchMedicalKnowledge } from "./ragService";
import { callLLM } from "./aiGateway";

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
    const rawText = await callLLM(prompt, 350);
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

    // Try to extract numerical reading from results string
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

  // Auto-suggest episode if recent symptoms exist
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

/** Answer longitudinal health questions combining Patient Context + RAG Medical Knowledge. */
export async function answerLongitudinalAssistant(
  patientId: number,
  query: string,
): Promise<{
  answer: string;
  usedRag: boolean;
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
}> {
  const queryTrimmed = query.trim();

  // 1. Emergency Safety Precedence Layer (FIRST)
  if (
    /\b(chest pain|pressure in (the )?chest|difficulty breathing|trouble breathing|shortness of breath|can't breathe|cannot breathe|sudden numbness|face droop|stroke|loss of consciousness|heart attack|myocardial infarction)\b/i.test(
      queryTrimmed,
    )
  ) {
    return {
      answer:
        "🚨 EMERGENCY ALERT: Your question mentions potential life-threatening emergency symptoms. Please call local emergency medical services (911/112) or go to the nearest emergency room immediately. Do not wait for symptoms to improve.",
      usedRag: false,
      sources: [
        {
          title: "Emergency Medical Triage Safety Protocol",
          source: "ArogyaGenie Emergency Safety Layer",
          publisher: "ArogyaGenie Safety System",
          section: "Immediate Emergency Triage",
          page: "1",
        },
      ],
      retrieval: { topK: 0, resultsUsed: 0 },
      disclaimer: "⚠️ Immediate emergency medical evaluation required.",
    };
  }

  // 2. Query Intent Classification
  const queryLower = queryTrimmed.toLowerCase();
  const isPersonalQuery = /\b(did i|my|mine|i have|i had|i am|have i|my history|my labs|my report|my prescription|my medicine|my symptom|my issue|my condition|my doctor|my appointment|my timeline|facing|face|faced)\b/i.test(queryLower);

  // 3. Context Retrieval (Patient Context + Global Medical RAG)
  const patientContext = await buildPatientHealthContext(patientId);
  const patientContextText = formatContextSummaryText(patientContext);

  const topK = process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : 5;
  const threshold = process.env.RAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) : 0.55;

  const matches = await searchMedicalKnowledge(queryTrimmed, topK, threshold);
  const usedRag = matches.length > 0;

  const sourcesMeta = matches.map((m) => ({
    documentId: m.documentId,
    title: m.title,
    source: m.metadata.source || m.title,
    publisher: m.metadata.publisher || "Medical Reference",
    section: m.section,
    page: m.page,
  }));

  const formattedRagEvidence = matches
    .map(
      (m, idx) =>
        `SOURCE ${idx + 1}\n` +
        `Title: ${m.title} (${m.documentId})\n` +
        `Publisher: ${m.metadata.publisher || "Clinical Reference"}\n` +
        `${m.section ? `Section: ${m.section}\n` : ""}` +
        `Page: ${m.page || "1"}\n` +
        `Content:\n${m.content}`,
    )
    .join("\n\n");

  // 4. Construct Prompt Grounded in Patient Records and/or RAG
  const prompt = `You are ArogyaGenie AI Assistant, an empathetic, clear, and clinically grounded health guide.
Answer the patient's question using the provided AUTHORIZED PATIENT HEALTH CONTEXT and AUTHORITATIVE MEDICAL GUIDELINES (if available).

${usedRag ? `AUTHORITATIVE MEDICAL GUIDELINES (RAG EVIDENCE):\n${formattedRagEvidence}\n\n` : "NO DIRECT MATCHING GLOBAL MEDICAL GUIDELINES FOUND FOR THIS QUERY.\n\n"}AUTHORIZED PATIENT HEALTH CONTEXT (PATIENT HISTORY & DATABASE RECORDS):
${patientContextText}

PATIENT QUESTION: ${queryTrimmed}

CRITICAL RULES FOR RESPONSE GENERATION:
1. If the question asks about the patient's personal health history, symptoms, prescriptions, lab reports, or timeline (e.g. "Did I ever face any health issue?"), answer based directly on the AUTHORIZED PATIENT HEALTH CONTEXT. Do NOT say "I couldn't find sufficiently relevant information in the medical knowledge base" when patient records exist.
2. If patient history records are present, summarize them clearly and helpfully.
3. If the question asks about general medical knowledge or lab test interpretations (e.g. "What does low hemoglobin mean?"), integrate both patient lab results and clinical guideline explanations.
4. Distinguish clearly between patient-specific records ("Your medical records show...") and general medical information ("Clinical guidelines note...").
5. Do NOT make definitive medical diagnoses or prescribe treatment plans. Suggest doctor consultation where appropriate.
6. If the question asks about a specific test or medical term (e.g. "What does my low hemoglobin mean?"), ALWAYS explain what the medical condition/finding means clinically (causes, significance, next steps) even if the patient's database records do not yet contain a specific numerical reading for that test. Note gently if no specific lab result for it is recorded in their profile.`;

  try {
    const rawAnswer = await callLLM(prompt, 500);
    if (rawAnswer && rawAnswer.trim().length > 0) {
      return {
        answer: rawAnswer,
        usedRag,
        sources: sourcesMeta,
        retrieval: {
          topK,
          resultsUsed: matches.length,
        },
        disclaimer: "⚠️ Informational answer based on your health records and clinical reference guidelines. Consult a doctor for personal medical decisions.",
      };
    }
  } catch (_e) {
    // Fallback engine
  }

  // Deterministic Grounded Fallback Engine
  let fallbackAnswer = "";
  if (isPersonalQuery) {
    const hasHistory =
      patientContext.recentSymptoms.length > 0 ||
      patientContext.recentPrescriptions.length > 0 ||
      patientContext.recentLabReports.length > 0 ||
      patientContext.recentAppointments.length > 0;

    if (hasHistory) {
      const parts: string[] = [];
      if (patientContext.recentSymptoms.length > 0) {
        parts.push(`Recent Symptoms: ${patientContext.recentSymptoms.map((s) => `${s.symptoms} (${s.date})`).join("; ")}`);
      }
      if (patientContext.recentPrescriptions.length > 0) {
        parts.push(`Prescriptions: ${patientContext.recentPrescriptions.map((p) => `${p.diagnosis} - ${p.medicines}`).join("; ")}`);
      }
      if (patientContext.recentLabReports.length > 0) {
        parts.push(`Lab Reports: ${patientContext.recentLabReports.map((l) => `${l.testName} (${l.results ?? "Completed"})`).join("; ")}`);
      }
      fallbackAnswer = `Based on your recorded ArogyaGenie health history:\n- ${parts.join("\n- ")}`;
    } else {
      fallbackAnswer = "According to your recorded ArogyaGenie health profile, no prior medical issues, prescriptions, or lab reports have been logged yet.";
    }
  } else {
    fallbackAnswer = "I am currently unable to fetch additional clinical details for this topic. Please consult your doctor for medical advice.";
  }

  return {
    answer: fallbackAnswer,
    usedRag,
    sources: sourcesMeta,
    retrieval: {
      topK,
      resultsUsed: matches.length,
    },
    disclaimer: "⚠️ Informational response grounded in database records.",
  };
}

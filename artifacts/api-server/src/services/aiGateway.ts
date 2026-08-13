/**
 * AI Gateway Service
 *
 * Provides a unified interface for AI-powered features (symptom assessment,
 * report analysis, etc.). Primary provider: local Ollama REST API.
 * Fallback: deterministic heuristic engine.
 *
 * Frontend must NEVER call AI providers directly — all AI requests go through
 * this gateway via Express API routes.
 */

import { retrieveMedicalContext, type RAGSourceMetadata } from "./ragService";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface FollowUpQuestionsRequest {
  symptoms: string;
  severity?: "mild" | "moderate" | "severe";
  duration?: string;
  additionalNotes?: string;
  patientId?: number;
}

export interface FollowUpQuestionsResponse {
  isEmergency: boolean;
  isInvalidInput?: boolean;
  invalidMessage?: string;
  urgencyLevel?: "LOW" | "MODERATE" | "HIGH" | "EMERGENCY";
  emergencyMessage?: string;
  questions: string[];
  patientContext?: {
    age?: string;
    gender?: string;
    knownConditions?: string[];
    medications?: string[];
  };
}

export interface StructuredPossibleCondition {
  name: string;
  confidence: "Low" | "Moderate" | "High";
  reasoning: string;
}

export interface AIAssessmentRequest {
  symptoms: string;
  severity?: "mild" | "moderate" | "severe";
  duration?: string;
  additionalNotes?: string;
  followUpQuestions?: string[];
  followUpAnswers?: Record<string, string>;
  patientId?: number;
}

export interface AIAssessmentResponse {
  aiResponse: string;
  possibleConditions: string;
  possibleConditionsList?: StructuredPossibleCondition[];
  recommendedAction: string;
  urgencyLevel: "LOW" | "MODERATE" | "HIGH" | "EMERGENCY";
  assessmentStatus?: "VALID" | "INVALID_INPUT" | "EMERGENCY" | "COMPLETED";
  recommendedSpecialty?: string;
  riskFactors?: string[];
  structuredAssessment?: {
    possibleConditions: StructuredPossibleCondition[];
    urgencyLevel: string;
    riskFactors: string[];
    recommendedSpecialty: string;
    recommendedAction: string;
    disclaimer: string;
    sources: RAGSourceMetadata[];
  };
  providerUsed: "gemini-1.5-flash" | "ollama-llama3" | "fallback-heuristic";
  sources?: RAGSourceMetadata[];
  ragUsed?: boolean;
  invalidInputMessage?: string;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3:8b";
const OLLAMA_TIMEOUT_MS = 30_000;

// Gemini configuration (used when GEMINI_API_KEY is set — production / Render)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Detects which LLM provider to use based on environment variables. */
export function detectLLMProvider(): "gemini" | "ollama" {
  return GEMINI_API_KEY ? "gemini" : "ollama";
}

/**
 * Provider-agnostic LLM call.
 * Uses Gemini Flash (production) or Ollama llama3:8b (local) based on env vars.
 * Includes exponential backoff retry for Gemini transient failures (429/500/503/network).
 * Returns the raw text response string, or null on failure.
 */
export async function callLLM(prompt: string, maxTokens: number = 450): Promise<string | null> {
  const provider = detectLLMProvider();

  if (provider === "gemini") {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000); // 20-second Gemini timeout
      try {
        const response = await fetch(
          `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: maxTokens,
              },
            }),
            signal: controller.signal,
          }
        );

        if (response.ok) {
          const data = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }

        // Retry on 429, 500, 502, 503, 504 status codes
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
      } catch (_err) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Ollama path (local development fallback)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: maxTokens },
      }),
      signal: controller.signal,
    });
    if (response.ok) {
      const data = (await response.json()) as { response?: string };
      if (data.response) return data.response;
    }
  } catch (_err) {
    // Fallthrough to null on Ollama error
  } finally {
    clearTimeout(timer);
  }

  return null;
}

type UrgencyLevel = AIAssessmentResponse["urgencyLevel"];


/** Medical disclaimer appended to every AI response. */
export const DISCLAIMER =
  "\n\n⚠️ Disclaimer: This assessment is generated by an AI assistant for informational purposes only. It is not a professional medical diagnosis or treatment plan. Always consult a qualified healthcare provider for medical concerns.";

/**
 * Emergency keyword detector — executes FIRST before any RAG or LLM operations.
 * Also catches ambiguous but potentially serious cardiac-area pain phrases
 * that the LLM might otherwise mis-route (e.g. to Gastroenterology).
 */
export function isEmergencySymptom(symptomsText: string): boolean {
  if (!symptomsText) return false;
  const norm = symptomsText.toLowerCase();
  // Primary emergency keywords (existing)
  if (/\b(chest pain|pressure in (the )?chest|difficulty breathing|trouble breathing|shortness of breath|can't breathe|cannot breathe|sudden numbness|face droop|stroke|loss of consciousness|passed out|fainting|faint|severe bleeding|coughing blood|anaphylaxis|severe allergic reaction|sudden vision loss|severe head injury)\b/i.test(norm)) {
    return true;
  }
  // Cardiac-area pain phrases — ambiguous but potentially serious; must not be routed to unrelated specialty by LLM
  if (/\b(pain in (my |the )?heart|heart (pain|ache|aching|hurts|hurting|attack)|severe (pain|pressure|tightness|discomfort) (in|around|near) (my |the )?(chest|heart|sternum|left arm|jaw)|(left arm|jaw) pain)\b/i.test(norm)) {
    return true;
  }
  return false;
}

/**
 * Symptom input validator — runs before ALL AI/RAG operations.
 * Detects gibberish, random characters, or non-medical input.
 *
 * Strategy (no hardcoded disease list):
 * 1. Minimum length check
 * 2. Character composition check (high ratio of non-letter chars = garbage)
 * 3. Repeated-character / keyboard-mash detection
 * 4. Health vocabulary presence check (broad body parts + sensations + symptoms vocabulary)
 *
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateSymptomInput(input: string): { valid: true } | { valid: false; reason: string } {
  const trimmed = input.trim();

  // 1. Minimum length
  if (trimmed.length < 8) {
    return { valid: false, reason: "Your description is too short. Please describe your symptoms in more detail." };
  }

  // 2. Character composition — reject if > 55% of chars are non-letter/non-space
  const letters = (trimmed.match(/[a-zA-Z ]/g) || []).length;
  const ratio = letters / trimmed.length;
  if (ratio < 0.45) {
    return { valid: false, reason: "Your input appears to contain mostly non-text characters. Please describe your symptoms using words." };
  }

  // 3. Keyboard-mash detection — reject if all 'words' are long single-case runs with no vowels or repeated chars
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0 && trimmed.length > 5) {
    // Single long token with no spaces — likely keyboard mash
    const hasVowel = /[aeiouAEIOU]/.test(trimmed);
    if (!hasVowel) {
      return { valid: false, reason: "Your input does not appear to describe recognizable symptoms. Please describe what you are experiencing in plain language." };
    }
    // Detect repeated character patterns (e.g. 'hhhhhh', 'gjgjgj')
    const repeatingPattern = /^(.{1,3})\1{3,}$/.test(trimmed);
    if (repeatingPattern) {
      return { valid: false, reason: "Your input appears to be a repeated pattern. Please describe your symptoms clearly." };
    }
  }

  // 4. Check for at least one recognizable health-related word
  // This is a broad vocabulary of body parts, sensations, and general symptom terms — NOT diseases
  const healthVocab = /\b(pain|ache|aching|sore|soreness|hurt|hurts|hurting|fever|temperature|hot|cold|chills|cough|coughing|sneeze|sneezing|breathe|breathing|breath|throat|nose|ear|eye|eyes|head|headache|stomach|abdomen|abdominal|belly|chest|heart|back|neck|shoulder|arm|leg|knee|joint|muscle|skin|rash|itch|itching|swelling|swollen|nausea|nauseous|vomit|vomiting|diarrhea|constipation|fatigue|tired|tiredness|weakness|dizzy|dizziness|blurry|vision|hearing|loss|blood|bleeding|discharge|burn|burning|pressure|tight|tightness|stiff|stiffness|numb|numbness|tingle|tingling|cramp|cramping|spasm|palpitation|irregular|racing|rapid|pulse|urine|urination|bowel|stool|period|menstrual|pregnant|pregnancy|anxiety|stress|insomnia|sleep|appetite|weight|sweat|sweating|phlegm|mucus|congestion|infection|inflammation|severe|mild|moderate|chronic|acute|sudden|sharp|dull|constant|intermittent|spreading|worsening|improving|symptom|symptoms|feel|feeling|feeling sick|unwell|ill|illness)\b/i;

  if (!healthVocab.test(trimmed)) {
    return {
      valid: false,
      reason: "Your input doesn't appear to describe recognizable health symptoms. Please describe what you are experiencing — for example: 'I have a fever and headache for 2 days'.",
    };
  }

  return { valid: true };
}

/**
 * Step 1: Follow-up Question Generator
 * Generates relevant follow-up questions tailored to reported symptoms while respecting
 * existing patient context (Age, Gender, Known Conditions).
 */
export async function generateFollowUpQuestions(req: FollowUpQuestionsRequest): Promise<FollowUpQuestionsResponse> {
  // 0. INPUT VALIDATION (before any AI/RAG operation)
  const validation = validateSymptomInput(req.symptoms);
  if (!validation.valid) {
    return {
      isEmergency: false,
      isInvalidInput: true,
      invalidMessage: validation.reason,
      questions: [],
    };
  }

  // 1. CRITICAL EMERGENCY CHECK (FIRST, after basic input validation)
  if (isEmergencySymptom(req.symptoms)) {
    return {
      isEmergency: true,
      urgencyLevel: "EMERGENCY",
      emergencyMessage: "Your reported symptoms indicate a potential medical emergency. Call local emergency services or go to the nearest emergency room immediately. Do not wait for symptoms to improve.",
      questions: [],
    };
  }

  // Gather authorized patient context if patientId is provided
  let patientContextSummary = "No prior patient profile context available.";
  let patientProfileData: { age?: string; gender?: string; knownConditions?: string[]; medications?: string[] } = {};

  if (req.patientId) {
    try {
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, req.patientId),
      });

      if (user) {
        const parts: string[] = [];
        if (user.age) {
          parts.push(`Age: ${user.age}`);
          patientProfileData.age = user.age;
        } else if (user.dateOfBirth) {
          parts.push(`Date of Birth: ${user.dateOfBirth}`);
          patientProfileData.age = user.dateOfBirth;
        }
        if (user.gender) {
          parts.push(`Gender: ${user.gender}`);
          patientProfileData.gender = user.gender;
        }
        if (user.allergies) {
          parts.push(`Known Allergies: ${user.allergies}`);
        }
        if (user.existingConditions) {
          parts.push(`Existing Medical Conditions: ${user.existingConditions}`);
          patientProfileData.knownConditions = [user.existingConditions];
        }
        if (user.currentMedications) {
          parts.push(`Current Medications: ${user.currentMedications}`);
          patientProfileData.medications = [user.currentMedications];
        }
        if (user.previousIllnesses) {
          parts.push(`Previous Major Illnesses / Surgeries: ${user.previousIllnesses}`);
        }
        if (parts.length > 0) {
          patientContextSummary = parts.join(", ");
        }
      }
    } catch (err) {
      console.warn("Could not fetch user profile for follow-up questions:", err);
    }
  }

  // Try LLM (Gemini or Ollama depending on env) to generate dynamic questions
  try {
    const prompt = `You are a medical triage assistant. A patient has reported the following initial symptoms:
Symptoms: ${req.symptoms}${req.severity ? `\nSeverity: ${req.severity}` : ""}${req.duration ? `\nDuration: ${req.duration}` : ""}${req.additionalNotes ? `\nAdditional Notes: ${req.additionalNotes}` : ""}

Patient Known Context:
${patientContextSummary}

Instructions:
Generate 3 to 5 relevant clinical follow-up questions to clarify these specific symptoms and collect any missing medical context.
- Questions MUST be directly relevant to the reported symptoms (e.g. measured temperature/cough for fever, location/radiation for pain, etc.).
- Do NOT ask questions for information already present in Patient Known Context (e.g. if Existing Medical Conditions, Current Medications, or Age are already listed above, DO NOT ask for them again).
- If Age, Gender, Existing Conditions, or Current Medications are NOT in Patient Known Context, you may ask about them.

Respond ONLY with a JSON array of strings (no markdown fences, no extra text), e.g.:
["Question 1", "Question 2", "Question 3"]`;

    const rawText = await callLLM(prompt, 250);
    if (rawText) {
      const jsonText = rawText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      const questions = JSON.parse(jsonText);
      if (Array.isArray(questions) && questions.length > 0) {
        return {
          isEmergency: false,
          urgencyLevel: req.severity === "severe" ? "HIGH" : req.severity === "moderate" ? "MODERATE" : "LOW",
          questions: questions.slice(0, 5).map(String),
          patientContext: patientProfileData,
        };
      }
    }
  } catch (_err) {
    // Fallback to heuristic question engine on LLM error/timeout
  }

  // Heuristic Question Engine Fallback
  const fallbackQuestions: string[] = [];
  const normSymptom = req.symptoms.toLowerCase();

  if (!patientProfileData.age) {
    fallbackQuestions.push("What is your age and gender?");
  }
  if (!patientProfileData.knownConditions) {
    fallbackQuestions.push("Do you have any existing medical conditions or currently take any medications?");
  }

  if (/\b(fever|chills|temp|temperature)\b/.test(normSymptom)) {
    fallbackQuestions.push("What is your measured body temperature if taken?");
    fallbackQuestions.push("Do you have a cough, sore throat, or breathing difficulty?");
    fallbackQuestions.push("Have you experienced any chills, sweating, or body aches?");
  } else if (/\b(cough|cold|flu|throat)\b/.test(normSymptom)) {
    fallbackQuestions.push("Is your cough dry or producing phlegm/mucus?");
    fallbackQuestions.push("Are you experiencing any fever or difficulty swallowing?");
  } else if (/\b(stomach|abdominal|belly|pain|vomiting|diarrhea)\b/.test(normSymptom)) {
    fallbackQuestions.push("Where specifically is the abdominal discomfort located?");
    fallbackQuestions.push("Have you experienced any nausea, vomiting, fever, or changes in bowel habits?");
  } else if (/\b(headache|migraine)\b/.test(normSymptom)) {
    fallbackQuestions.push("Is the head pain throbbing, steady, or sudden?");
    fallbackQuestions.push("Are you experiencing sensitivity to light, nausea, or neck stiffness?");
  } else {
    fallbackQuestions.push("How severe are these symptoms on a scale of 1 to 10?");
    fallbackQuestions.push("Have you noticed any associated symptoms like fever, fatigue, or body pain?");
  }

  return {
    isEmergency: false,
    urgencyLevel: req.severity === "severe" ? "HIGH" : req.severity === "moderate" ? "MODERATE" : "LOW",
    questions: fallbackQuestions.slice(0, 5),
    patientContext: patientProfileData,
  };
}

/**
 * Helper to extract active affirmative symptoms reported by patient,
 * removing question text and filtering out negated statements ("no cough", "no fever").
 */
export function extractActiveSymptomsText(
  symptoms: string,
  additionalNotes?: string,
  followUpQuestions?: string[],
  followUpAnswers?: Record<string, string>
): { activeSymptoms: string; negatedSymptoms: string[] } {
  const activeParts: string[] = [symptoms];
  if (additionalNotes) activeParts.push(additionalNotes);

  const negatedSymptoms: string[] = [];

  if (followUpQuestions && followUpAnswers) {
    for (const q of followUpQuestions) {
      const ans = (followUpAnswers[q] || "").trim();
      if (!ans) continue;

      const normAns = ans.toLowerCase();
      // Detect explicit negations
      if (/^(no|none|denies|not really|n\/a|nil|negative)\b/i.test(normAns) || /\b(no |not |without |deny |denies )/i.test(normAns)) {
        negatedSymptoms.push(`${q} -> ${ans}`);
      } else {
        activeParts.push(ans);
      }
    }
  }

  return {
    activeSymptoms: activeParts.join(" "),
    negatedSymptoms,
  };
}

/**
 * Step 2: Final Assessment Generator
 * Analyzes complete symptom context + follow-up Q&A + RAG clinical guidelines
 * to produce structured assessment.
 */
export async function analyzeSymptoms(req: AIAssessmentRequest): Promise<AIAssessmentResponse> {
  // 0. INPUT VALIDATION (before any AI/RAG operation)
  const validation = validateSymptomInput(req.symptoms);
  if (!validation.valid) {
    return {
      aiResponse: validation.reason,
      possibleConditions: "",
      recommendedAction: "Please describe your symptoms clearly so our AI can help you accurately.",
      urgencyLevel: "LOW",
      assessmentStatus: "INVALID_INPUT",
      invalidInputMessage: validation.reason,
      providerUsed: "fallback-heuristic",
      ragUsed: false,
      sources: [],
    };
  }

  // 1. CRITICAL EMERGENCY SAFETY CHECK (FIRST, after basic input validation)
  let checkText = req.symptoms;
  if (req.additionalNotes) checkText += " " + req.additionalNotes;
  if (req.followUpAnswers) {
    checkText += " " + Object.values(req.followUpAnswers).join(" ");
  }

  if (isEmergencySymptom(checkText)) {
    const emergency = heuristicEmergencyFallback(req);
    return { ...emergency, assessmentStatus: "EMERGENCY" };
  }

  // Extract active symptoms text (excluding question boilerplate and negated statements)
  const { activeSymptoms, negatedSymptoms } = extractActiveSymptomsText(
    req.symptoms,
    req.additionalNotes,
    req.followUpQuestions,
    req.followUpAnswers
  );

  // Synthesize full symptom context for LLM prompt
  let fullContext = `Initial Symptoms: ${req.symptoms}`;
  if (req.severity) fullContext += `\nSeverity: ${req.severity}`;
  if (req.duration) fullContext += `\nDuration: ${req.duration}`;
  if (req.additionalNotes) fullContext += `\nAdditional Notes: ${req.additionalNotes}`;

  if (req.followUpQuestions && req.followUpAnswers) {
    fullContext += `\n\nPatient Follow-up Q&A Context:`;
    for (const q of req.followUpQuestions) {
      const a = req.followUpAnswers[q] ?? "Not specified";
      fullContext += `\n- Question: ${q}\n  Answer: ${a}`;
    }
  }

  // RAG Vector Knowledge Retrieval over active reported symptoms
  let ragPayload = { contextText: "", sources: [] as RAGSourceMetadata[] };
  try {
    ragPayload = await retrieveMedicalContext(activeSymptoms);
  } catch (err) {
    console.warn("RAG retrieval warning in analyzeSymptoms:", err);
  }

  // Attempt LLM Structured Assessment Generation (Gemini or Ollama depending on env)
  try {
    const prompt = `You are ArogyaGenie Medical Triage AI. Analyze the patient's reported symptoms and follow-up answers carefully:

PATIENT HEALTH CONTEXT:
${fullContext}

EXTRACTED ACTIVE PATIENT SYMPTOMS:
${activeSymptoms}

RETRACTED / NEGATED SYMPTOMS (DO NOT DIAGNOSE THESE):
${negatedSymptoms.length > 0 ? negatedSymptoms.join("\n") : "None reported"}

RETRIEVED CLINICAL GUIDELINES EVIDENCE (RAG CONTEXT):
${ragPayload.contextText}

Respond ONLY with a JSON object in this exact format (no markdown fences, no extra text):
{
  "possibleConditions": [
    {
      "name": "<Condition Name>",
      "confidence": "<Low | Moderate | High>",
      "reasoning": "<1-2 sentence clinical reasoning based strictly on patient's active symptoms>"
    }
  ],
  "urgencyLevel": "<LOW | MODERATE | HIGH | EMERGENCY>",
  "riskFactors": ["<Risk factor 1>", "<Risk factor 2>"],
  "recommendedSpecialty": "<Select one: General Physician | Cardiologist | Pulmonologist | Gastroenterologist | ENT | Neurologist | Dermatologist | Orthopedist | Pediatrician | Gynecologist | Internal Medicine | Endocrinologist | Nephrologist | Oncologist | Urologist | Dentist | Surgeon>",
  "recommendedAction": "<clear, actionable guidance for the patient>"
}

CRITICAL RULES:
1. Base your assessment strictly on the INITIAL SYMPTOMS + SEVERITY + DURATION + ALL FOLLOW-UP ANSWERS provided by the patient.
2. NEVER invent or assume symptoms that the patient did not report (e.g. do NOT diagnose Respiratory/Chest illness for an abdominal/stomach pain patient unless the patient explicitly reported respiratory symptoms).
3. Negative follow-up answers ("no cough", "no fever") mean those symptoms are ABSENT.
4. RAG clinical guidelines are reference evidence. If retrieved RAG context is irrelevant to the active symptoms (e.g. respiratory guidelines retrieved for abdominal pain), IGNORE the irrelevant RAG evidence and focus on the patient's actual reported symptoms.
5. Never claim to definitively diagnose ('You have X'). Use cautious non-diagnostic terms ('may suggest', 'possibly').`;

    const rawText = await callLLM(prompt, 450);
    if (rawText) {
      const jsonText = rawText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      const parsed = JSON.parse(jsonText);

      if (Array.isArray(parsed.possibleConditions) && parsed.recommendedAction && parsed.urgencyLevel) {
        const urgency = String(parsed.urgencyLevel).toUpperCase() as UrgencyLevel;
        const validUrgency: UrgencyLevel = ["LOW", "MODERATE", "HIGH", "EMERGENCY"].includes(urgency) ? urgency : "MODERATE";

        const conditionsList: StructuredPossibleCondition[] = parsed.possibleConditions.map((c: any) => ({
          name: String(c.name || "Possible condition"),
          confidence: ["Low", "Moderate", "High"].includes(c.confidence) ? c.confidence : "Moderate",
          reasoning: String(c.reasoning || "Based on reported symptom presentation."),
        }));

        const condSummaryText = conditionsList.map((c) => `${c.name} (${c.confidence} confidence)`).join(", ");
        const specialty = String(parsed.recommendedSpecialty || "General Physician");
        const riskFactors = Array.isArray(parsed.riskFactors) ? parsed.riskFactors.map(String) : [];

        const aiResponse =
          `Based on your reported symptoms (${req.symptoms}), here is your AI-assisted assessment:\n\n` +
          `Possible conditions: ${condSummaryText}\n\n` +
          `Recommended action: ${parsed.recommendedAction}\n\n` +
          `Urgency level: ${validUrgency}` +
          DISCLAIMER;

        const activeProvider = detectLLMProvider();
        return {
          aiResponse,
          possibleConditions: condSummaryText,
          possibleConditionsList: conditionsList,
          recommendedAction: String(parsed.recommendedAction),
          urgencyLevel: validUrgency,
          assessmentStatus: "COMPLETED",
          recommendedSpecialty: specialty,
          riskFactors,
          structuredAssessment: {
            possibleConditions: conditionsList,
            urgencyLevel: validUrgency,
            riskFactors,
            recommendedSpecialty: specialty,
            recommendedAction: String(parsed.recommendedAction),
            disclaimer: DISCLAIMER.trim(),
            sources: ragPayload.sources,
          },
          providerUsed: activeProvider === "gemini" ? "gemini-1.5-flash" : "ollama-llama3",
          sources: ragPayload.sources,
          ragUsed: ragPayload.sources.length > 0,
        };
      }
    }
  } catch (_err) {
    // Fallback to structured heuristic engine
  }

  // Structured Heuristic Fallback
  return structuredHeuristicFallback(req, fullContext, activeSymptoms, ragPayload.sources);
}

function heuristicEmergencyFallback(req: AIAssessmentRequest): AIAssessmentResponse {
  const action = "Call local emergency services or go to the nearest emergency room immediately. Do not wait for symptoms to improve.";
  const condText = "Potentially life-threatening condition requiring immediate emergency evaluation";

  return {
    aiResponse:
      `Your reported symptoms (${req.symptoms}) indicate a potential medical emergency.\n\n` +
      `${action}` +
      DISCLAIMER,
    possibleConditions: condText,
    possibleConditionsList: [
      {
        name: "Acute Medical Emergency",
        confidence: "High",
        reasoning: "Reported symptoms match emergency triage red-flag keywords.",
      },
    ],
    recommendedAction: action,
    urgencyLevel: "EMERGENCY",
    recommendedSpecialty: "Emergency Medicine",
    riskFactors: ["Severe emergency symptom presentation"],
    structuredAssessment: {
      possibleConditions: [
        {
          name: "Acute Medical Emergency",
          confidence: "High",
          reasoning: "Reported symptoms match emergency triage red-flag keywords.",
        },
      ],
      urgencyLevel: "EMERGENCY",
      riskFactors: ["Severe emergency symptom presentation"],
      recommendedSpecialty: "Emergency Medicine",
      recommendedAction: action,
      disclaimer: DISCLAIMER.trim(),
      sources: [],
    },
    providerUsed: "fallback-heuristic",
    sources: [],
    ragUsed: false,
  };
}

function structuredHeuristicFallback(
  req: AIAssessmentRequest,
  fullContext: string,
  activeSymptoms: string,
  sources: RAGSourceMetadata[]
): AIAssessmentResponse {
  const normActive = activeSymptoms.toLowerCase();
  const sev = req.severity ?? "mild";

  let urgency: UrgencyLevel = "LOW";
  let specialty = "General Physician";
  let conditions: StructuredPossibleCondition[] = [];
  let riskFactors: string[] = [];
  let action = "Monitor symptoms and rest. Consult a doctor if symptoms worsen or persist.";

  const hasStomach = /\b(stomach|abdominal|abdomen|belly|navel|belly button|epigastric|gastric|nausea|vomiting|diarrhea)\b/.test(normActive);
  const hasRespiratory = /\b(cough|cold|sore throat|phlegm|bronchitis|pneumonia|wheezing)\b/.test(normActive);

  if (hasStomach && !hasRespiratory) {
    specialty = "Gastroenterologist";
    conditions = [
      {
        name: "Gastritis / Dyspepsia",
        confidence: "Moderate",
        reasoning: "Upper abdominal discomfort and pain centered above or around the navel.",
      },
      {
        name: "Gastroenteritis",
        confidence: "Low",
        reasoning: "Abdominal discomfort possibly related to digestive inflammation.",
      },
    ];
    riskFactors = ["Dietary factors", "Stomach acid irritation", "Hydration status"];
    urgency = sev === "severe" ? "HIGH" : "MODERATE";
    action = "Avoid spicy/acidic foods, stay hydrated, and consult a gastroenterologist if pain is severe or persistent.";
  } else if (hasRespiratory) {
    specialty = /\b(sore throat|ear|sinus)\b/.test(normActive) ? "ENT" : "General Physician";
    conditions = [
      {
        name: "Viral Upper Respiratory Infection",
        confidence: "Moderate",
        reasoning: "Common combination of fever, cough, or sore throat.",
      },
      {
        name: "Acute Bronchitis",
        confidence: "Low",
        reasoning: "Persistent cough with mild systemic symptoms.",
      },
    ];
    riskFactors = ["Recent exposure to viral illness", "Seasonal respiratory pathogens"];
    if (sev === "moderate" || sev === "severe") urgency = "MODERATE";
  } else if (/\b(headache|migraine)\b/.test(normActive)) {
    specialty = "Neurology";
    conditions = [
      {
        name: "Tension Headache",
        confidence: "Moderate",
        reasoning: "Band-like steady head pressure without neurological deficits.",
      },
      {
        name: "Migraine",
        confidence: "Low",
        reasoning: "Episodic head pain potentially with sensory sensitivity.",
      },
    ];
    riskFactors = ["Stress", "Dehydration", "Sleep pattern disruption"];
    urgency = sev === "severe" ? "HIGH" : "LOW";
  } else {
    conditions = [
      {
        name: "Non-specific Symptom Presentation",
        confidence: "Low",
        reasoning: "Symptoms reported require further clinical correlation.",
      },
    ];
    urgency = sev === "severe" ? "HIGH" : sev === "moderate" ? "MODERATE" : "LOW";
  }

  const condText = conditions.map((c) => `${c.name} (${c.confidence} confidence)`).join(", ");
  const aiResponse =
    `Based on your reported symptoms (${req.symptoms}), here is an initial AI assessment:\n\n` +
    `Possible Conditions: ${condText}\n\n` +
    `Recommended Action: ${action}\n\n` +
    `Urgency Level: ${urgency}` +
    DISCLAIMER;

  return {
    aiResponse,
    possibleConditions: condText,
    possibleConditionsList: conditions,
    recommendedAction: action,
    urgencyLevel: urgency,
    assessmentStatus: "COMPLETED",
    recommendedSpecialty: specialty,
    riskFactors,
    structuredAssessment: {
      possibleConditions: conditions,
      urgencyLevel: urgency,
      riskFactors,
      recommendedSpecialty: specialty,
      recommendedAction: action,
      disclaimer: DISCLAIMER.trim(),
      sources,
    },
    providerUsed: "fallback-heuristic",
    sources,
    ragUsed: sources.length > 0,
  };
}

// ─── AI LAB REPORT ANALYSIS SERVICE ─────────────────────────────────────────

export interface AILabReportRequest {
  testName: string;
  results?: string;
  testDate?: string;
}

export interface AILabReportResponse {
  summary: string;
  keyFindings: string[];
  abnormalValues: string[];
  possibleSignificance: string[];
  questionsForDoctor: string[];
  urgency: "NORMAL" | "ATTENTION_REQUIRED" | "URGENT";
  providerUsed: "gemini-1.5-flash" | "ollama-llama3" | "fallback-heuristic";
  disclaimer: string;
  sources?: RAGSourceMetadata[];
  ragUsed?: boolean;
}

function buildReportPrompt(req: AILabReportRequest, ragContextText: string): string {
  return `You are a medical lab report interpreter. Analyze the following lab report for a patient:

Test Name: ${req.testName}
Raw Results / Readings: ${req.results ?? "No detailed values provided"}

Retrieved Clinical Guidelines & Reference Ranges (RAG Context):
${ragContextText}

Respond ONLY with a JSON object in this exact format (no markdown fences, no extra text):
{
  "summary": "<plain text 2-3 sentence overview explaining what this test measures and what the overall result suggests>",
  "keyFindings": ["<finding 1>", "<finding 2>"],
  "abnormalValues": ["<abnormal reading or value out of range, if any>"],
  "possibleSignificance": ["<cautious explanation using terms like 'may indicate' or 'could suggest'>"],
  "questionsForDoctor": ["<suggested question for doctor consultation>"],
  "urgency": "<one of: NORMAL, ATTENTION_REQUIRED, URGENT>"
}

Rules:
- Base your interpretation on the retrieved clinical reference ranges.
- Use cautious non-diagnostic language ('may suggest', 'could be associated with'). Never make a definitive diagnosis.
- Always remind the patient to review the results with their doctor.`;
}

export async function analyzeLabReport(req: AILabReportRequest): Promise<AILabReportResponse> {
  const disclaimerText = DISCLAIMER.trim();

  let ragPayload = { contextText: "", sources: [] as RAGSourceMetadata[] };
  try {
    ragPayload = await retrieveMedicalContext(`${req.testName} ${req.results ?? ""}`);
  } catch (err) {
    console.warn("RAG retrieval warning in analyzeLabReport:", err);
  }

  try {
    const prompt = buildReportPrompt(req, ragPayload.contextText);
    const rawText = await callLLM(prompt, 400);

    if (rawText) {
      const jsonText = rawText.trim().replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
      const parsed = JSON.parse(jsonText);

      return {
        summary: parsed.summary || `Analysis of ${req.testName} completed.`,
        keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [req.testName],
        abnormalValues: Array.isArray(parsed.abnormalValues) ? parsed.abnormalValues : [],
        possibleSignificance: Array.isArray(parsed.possibleSignificance) ? parsed.possibleSignificance : ["Please review with your physician."],
        questionsForDoctor: Array.isArray(parsed.questionsForDoctor) ? parsed.questionsForDoctor : ["What do these test results mean for my health?"],
        urgency: ["NORMAL", "ATTENTION_REQUIRED", "URGENT"].includes(parsed.urgency) ? parsed.urgency : "NORMAL",
        providerUsed: detectLLMProvider() === "gemini" ? "gemini-1.5-flash" : "ollama-llama3",
        disclaimer: disclaimerText,
        sources: ragPayload.sources,
        ragUsed: ragPayload.sources.length > 0,
      };
    }
  } catch (_err) {
    // Fall back to heuristic interpreter
  }

  const abnormalLines: string[] = [];
  const findings: string[] = [];

  if (req.results) {
    const lines = req.results.split("\n");
    for (const line of lines) {
      if (/\b(high|low|abnormal|positive|elevated|deficient|out of range)\b/i.test(line)) {
        abnormalLines.push(line.trim());
      } else if (line.trim().length > 3) {
        findings.push(line.trim());
      }
    }
  }

  const urgency = abnormalLines.length > 0 ? "ATTENTION_REQUIRED" : "NORMAL";

  return {
    summary: `Initial informational summary for ${req.testName}. Results recorded and processed by ArogyaGenie AI Gateway.`,
    keyFindings: findings.length > 0 ? findings.slice(0, 4) : [`Completed ${req.testName}`],
    abnormalValues: abnormalLines,
    possibleSignificance: [
      abnormalLines.length > 0
        ? "Certain values appear outside standard ranges and may suggest conditions for doctor review."
        : "Values appear consistent with typical reference ranges.",
    ],
    questionsForDoctor: [
      "Are there any specific lifestyle or medical recommendations based on these results?",
      "Do I need any follow-up bloodwork or diagnostic imaging?",
    ],
    urgency,
    providerUsed: "fallback-heuristic",
    disclaimer: disclaimerText,
    sources: ragPayload.sources,
    ragUsed: ragPayload.sources.length > 0,
  };
}

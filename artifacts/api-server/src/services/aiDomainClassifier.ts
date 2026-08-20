/**
 * AI Domain & Intent Classifier for AarogyaGenie Health Assistant
 *
 * Distinguishes:
 * 1. EMERGENCY (Life-threatening symptoms requiring immediate 911/112 triage)
 * 2. NON_MEDICAL (Explicitly unrelated queries: coding, math, sports, recipes, general trivia)
 * 3. PATIENT_SPECIFIC (Queries about user's personal medical history, orders, labs, doctors)
 * 4. GENERAL_MEDICAL (Clinical / health education: dengue symptoms, fever advice, BP, medical terms)
 * 5. HYBRID (Questions combining personal health records with medical explanations)
 */

export type DomainCategory = "EMERGENCY" | "NON_MEDICAL" | "PATIENT_SPECIFIC" | "GENERAL_MEDICAL" | "HYBRID";

export type PatientModule =
  | "profile"
  | "symptoms"
  | "medicines"
  | "prescriptions"
  | "appointments"
  | "diagnostics"
  | "lab_reports"
  | "timeline"
  | "episodes";

export interface IntentClassificationResult {
  category: DomainCategory;
  isEmergency: boolean;
  isNonMedical: boolean;
  isPatientSpecific: boolean;
  isGeneralMedical: boolean;
  targetModules: PatientModule[];
  temporalFilter?: "latest" | "recent" | "last_month" | "historical" | "all";
  rejectionMessage?: string;
  emergencyMessage?: string;
}

// ── 1. Emergency Red Flags ──────────────────────────────────────────────────
const EMERGENCY_PATTERNS = [
  /\b(chest pain|pressure in (the )?chest|pain radiating to (my |left )?arm)\b/i,
  /\b(difficulty breathing|trouble breathing|shortness of breath|can't breathe|cannot breathe|gasping for air)\b/i,
  /\b(sudden numbness|face droop(ing)?|slurred speech|stroke symptoms|sudden weakness on one side)\b/i,
  /\b(loss of consciousness|passed out|fainted and not waking|unresponsive)\b/i,
  /\b(heart attack|myocardial infarction|cardiac arrest)\b/i,
  /\b(coughing up (large amounts of )?blood|vomiting blood|severe head trauma)\b/i,
  /\b(anaphylaxis|throat closing up|severe allergic reaction swelling)\b/i,
  /\b(suicidal|want to die|kill myself|harm myself)\b/i,
];

// ── 2. Explicit Non-Medical Patterns ─────────────────────────────────────────
const NON_MEDICAL_PATTERNS = [
  // Coding / programming
  /\b(write (python|javascript|typescript|java|c\+\+|html|css|sql|rust|go|php) code)\b/i,
  /\b(create a function|debug this code|coding tutorial|regex for|git commit|npm install|docker container)\b/i,
  
  // Math / arithmetic
  /\b(what is \d+\s*[\+\-\*\/]\s*\d+|\d+\s*plus\s*\d+|\d+\s*minus\s*\d+|\d+\s*times\s*\d+|calculate (the )?sqrt|derivative of|integral of)\b/i,
  
  // Sports / entertainment / cinema
  /\b(who won (the )?(match|game|world cup|ipl|cricket|football|super bowl|oscar|election))\b/i,
  /\b(cricket score|football score|premier league|nba score|movie review|box office)\b/i,
  
  // Commodity prices / general commerce unrelated to health
  /\b(price of (tomatoes|petrol|diesel|gold|silver|bitcoin|crypto|stocks|shares|cars|iphone))\b/i,
  /\b(stock market today|weather forecast for|flight tickets to)\b/i,
  
  // Cooking / recipes unrelated to medical diets
  /\b(recipe for (pasta|pizza|biryani|cake|cookies|burger|curry|cocktail))\b/i,
  /\b(how to bake|how to cook (chicken|paneer|rice|steak))\b/i,
  
  // General entertainment / jokes / general trivia
  /\b(tell me a joke|tell a joke|write a poem about|write a story about|who is the president of|capital of [a-z]+)\b/i,
];

// ── 3. Health & Medical Keywords (Allowlist of health concepts) ───────────────
const MEDICAL_KEYWORDS = [
  "fever", "cough", "cold", "flu", "dengue", "malaria", "typhoid", "covid", "infection",
  "pain", "ache", "headache", "migraine", "nausea", "vomiting", "diarrhea", "constipation",
  "blood pressure", "hypertension", "hypotension", "diabetes", "glucose", "insulin", "sugar",
  "cholesterol", "lipid", "triglycerides", "hemoglobin", "anemia", "platelet", "wbc", "rbc",
  "asthma", "allergy", "rash", "itching", "swelling", "inflammation", "dehydration", "hydration",
  "stomach", "gastric", "acidity", "gerd", "ulcer", "liver", "kidney", "creatinine", "thyroid", "tsh",
  "heart", "cardio", "pulse", "ecg", "heart rate", "oxygen", "spo2", "temperature",
  "medicine", "medication", "tablet", "capsule", "syrup", "dosage", "dose", "antibiotic",
  "paracetamol", "dolo", "azithromycin", "amoxicillin", "pantoprazole", "cetirizine", "metformin", "atorvastatin",
  "doctor", "physician", "specialist", "cardiologist", "dermatologist", "neurologist", "pediatrician",
  "hospital", "clinic", "prescription", "lab", "test", "scan", "x-ray", "mri", "ct scan", "ultrasound",
  "symptom", "diagnosis", "treatment", "cure", "prevention", "vaccine", "diet", "nutrition",
  "exercise", "mental health", "anxiety", "depression", "insomnia", "sleep", "vital", "timeline",
  "vitamin", "mineral", "supplement", "electrolytes", "ors", "bmi", "weight loss", "obesity"
];

// ── 4. Patient-Specific Pronouns & Phrases ────────────────────────────────────
const PATIENT_QUERY_PATTERNS = [
  /\b(did i|have i|had i|was i|am i|my|mine|me|i have|i had|i took|i tooked|i was|i am|i ordered|i bought|i booked|i checked)\b/i,
  /\b(my (history|medical history|health history|record|records|health record|profile))\b/i,
  /\b(my (medicine|medicines|medication|medications|orders|order|prescriptions|prescription))\b/i,
  /\b(my (appointment|appointments|doctor|doctors|visit|visits|consultation|consultations))\b/i,
  /\b(my (test|tests|lab|labs|report|reports|results|result|diagnosis|diagnoses))\b/i,
  /\b(my (symptom|symptoms|timeline|events|episodes|allergies|conditions))\b/i,
  /\b(prescribed (to|for) me|ordered by me|checked by me|taken by me)\b/i,
  /\b(what (did|have|were) i|when (did|was) (my|i)|show (me )?(my|all my)|summarize my)\b/i,
  /\b(considering my|based on my|looking at my)\b/i,
];

/**
 * Classify a user query and determine the appropriate routing,
 * domain validity, and selective patient modules.
 */
export function classifyDomainAndIntent(
  query: string,
  recentHistory?: Array<{ sender: string; text: string }>
): IntentClassificationResult {
  const q = query.trim();
  const qLower = q.toLowerCase();

  // 1. Check Emergency First
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(q)) {
      return {
        category: "EMERGENCY",
        isEmergency: true,
        isNonMedical: false,
        isPatientSpecific: false,
        isGeneralMedical: true,
        targetModules: [],
        emergencyMessage:
          "🚨 EMERGENCY ALERT: Your message mentions potential life-threatening symptoms. Please immediately call emergency services (112 / 911 / 108 in India) or visit the nearest hospital emergency room. Do not wait for symptoms to resolve on their own.",
      };
    }
  }

  // 2. Check Explicit Non-Medical Rejection
  for (const pattern of NON_MEDICAL_PATTERNS) {
    if (pattern.test(q)) {
      return {
        category: "NON_MEDICAL",
        isEmergency: false,
        isNonMedical: true,
        isPatientSpecific: false,
        isGeneralMedical: false,
        targetModules: [],
        rejectionMessage:
          "I am AarogyaGenie AI, your dedicated medical and healthcare assistant. I can only assist with health-related questions, medical guidance, symptoms, medications, treatments, and your personal healthcare records on AarogyaGenie. For non-medical topics, please use a general assistant.",
      };
    }
  }

  // 3. Check for Patient-Specific Intent
  let isPatientSpecific = PATIENT_QUERY_PATTERNS.some((p) => p.test(qLower));

  // Also check if conversation history indicates user was discussing personal records
  if (!isPatientSpecific && recentHistory && recentHistory.length > 0) {
    const lastUserTurn = [...recentHistory].reverse().find((h) => h.sender === "patient" || h.sender === "user");
    if (lastUserTurn && PATIENT_QUERY_PATTERNS.some((p) => p.test(lastUserTurn.text.toLowerCase()))) {
      // Follow-up question like "Which one was for fever?" or "What was abnormal?"
      if (/\b(which (one|med|medicine|test|doctor)|what was|why|when|was it|were they|any other)\b/i.test(qLower)) {
        isPatientSpecific = true;
      }
    }
  }

  // 4. Check for General Medical Intent
  const hasMedicalKeywords = MEDICAL_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}s?\\b`, "i");
    return regex.test(qLower);
  });

  // Common health question starters: "what are the symptoms of", "what causes", "how to treat", "what is", "is it safe to", "can i take"
  const hasHealthQuestionPattern = /\b(symptom|cause|treatment|cure|remedy|prevent|contagious|safe to take|side effect|dosage of|what should i do if|when to see a doctor|home care for|meaning of|what is|how is|why do i feel)\b/i.test(qLower);

  const isGeneralMedical = hasMedicalKeywords || hasHealthQuestionPattern || isPatientSpecific;

  // If query does NOT match medical keywords or patient patterns AND is very short general text (e.g. "hi", "hello", "hey", "good morning")
  const isGreeting = /^(hi|hello|hey|good morning|good evening|good afternoon|namaste|help|start)\b/i.test(qLower.trim());

  if (!isGeneralMedical && !isGreeting && q.split(" ").length > 3) {
    // If it's a multi-word query that has zero medical or health terms
    return {
      category: "NON_MEDICAL",
      isEmergency: false,
      isNonMedical: true,
      isPatientSpecific: false,
      isGeneralMedical: false,
      targetModules: [],
      rejectionMessage:
        "I am AarogyaGenie AI, your dedicated medical and healthcare assistant. I can only assist with health-related questions, medical guidance, symptoms, medications, treatments, and your personal healthcare records on AarogyaGenie. For non-medical topics, please use a general assistant.",
    };
  }

  // 5. Select Selective Patient Modules
  const targetModules: PatientModule[] = ["profile"]; // Profile is always lightweight and helpful for safety context

  if (isPatientSpecific) {
    // Medicines, Prescriptions, Orders
    if (/\b(medicine|med|meds|tablet|syrup|pill|dose|dosage|order|ordered|pharmacy|delivery|purchase|prescription|prescribed|dolo|paracetamol|antibiotic)\b/i.test(qLower)) {
      targetModules.push("medicines", "prescriptions");
    }

    // Doctor, Appointment, Clinic, Hospital
    if (/\b(doctor|dr|dr\.|appointment|appointments|visit|visits|consultation|consultations|clinic|hospital|specialist|cardiologist|physician)\b/i.test(qLower)) {
      targetModules.push("appointments", "prescriptions");
    }

    // Lab reports, Tests, Diagnostics
    if (/\b(test|tests|lab|labs|report|reports|diagnostic|diagnostics|booking|blood|scan|x-ray|mri|hemoglobin|glucose|result|results|abnormal)\b/i.test(qLower)) {
      targetModules.push("lab_reports", "diagnostics");
    }

    // Symptoms, Symptom Checker
    if (/\b(symptom|symptoms|fever|cough|pain|headache|nausea|checked|assessed|assessment|condition|issue)\b/i.test(qLower)) {
      targetModules.push("symptoms");
    }

    // Timeline, Episodes, Summary, Overview
    if (/\b(timeline|episode|episodes|history|journey|summary|summarize|overview|everything|all|recent|activity|what happened)\b/i.test(qLower) || targetModules.length <= 1) {
      // Broad / cross-module query -> include multiple key modules
      targetModules.push("timeline", "symptoms", "prescriptions", "medicines", "appointments", "lab_reports", "episodes");
    }
  }

  // 6. Determine Temporal Filter
  let temporalFilter: IntentClassificationResult["temporalFilter"] = undefined;
  if (/\b(last|latest|most recent|newest|recent)\b/i.test(qLower)) {
    temporalFilter = "latest";
  } else if (/\b(last month|this month|in august|in july|in 2026)\b/i.test(qLower)) {
    temporalFilter = "last_month";
  } else if (/\b(before|after|earlier|first|previous)\b/i.test(qLower)) {
    temporalFilter = "historical";
  }

  // 7. Determine Category
  let category: DomainCategory = "GENERAL_MEDICAL";
  if (isPatientSpecific && hasMedicalKeywords) {
    category = "HYBRID";
  } else if (isPatientSpecific) {
    category = "PATIENT_SPECIFIC";
  } else {
    category = "GENERAL_MEDICAL";
  }

  return {
    category,
    isEmergency: false,
    isNonMedical: false,
    isPatientSpecific,
    isGeneralMedical: true,
    targetModules: Array.from(new Set(targetModules)),
    temporalFilter,
  };
}

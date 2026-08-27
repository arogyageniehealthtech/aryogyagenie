/**
 * AI Domain, Subject & Intent Classifier for AarogyaGenie Health Assistant
 *
 * Core Rule: Personalization must be INTENTIONAL, not automatic.
 *
 * Distinguishes:
 * 1. SUBJECT:
 *    - SELF: Query specifically about the logged-in user
 *    - OTHER_PERSON: Query about family member, friend, or third party (sister, brother, father, etc.)
 *    - GENERIC: General medical or health education not tied to any individual
 *    - UNCLEAR: Ambiguous or conversational
 *
 * 2. INTENT:
 *    - PERSONAL_HEALTH / MEDICAL_RECORD / PRESCRIPTION / LAB_REPORT / MEDICATION / SYMPTOM
 *    - GENERIC_MEDICAL / OTHER_PERSON_MEDICAL
 *    - APPOINTMENT / DOCTOR / HOSPITAL / LAB / PHARMACY / AAROGYA_JANI_SERVICE
 *    - GENERAL_CONVERSATION / EMERGENCY / UNKNOWN
 *
 * 3. CATEGORY:
 *    - EMERGENCY / NON_MEDICAL / PATIENT_SPECIFIC / GENERAL_MEDICAL / HYBRID / PLATFORM_SERVICE
 */

export type DomainCategory =
  | "EMERGENCY"
  | "NON_MEDICAL"
  | "GENERIC_KNOWLEDGE"
  | "PATIENT_SPECIFIC"
  | "GENERAL_MEDICAL"
  | "HYBRID"
  | "PLATFORM_SERVICE";

export type QuerySubject = "SELF" | "OTHER_PERSON" | "GENERIC" | "UNCLEAR";

export type QueryIntent =
  | "PERSONAL_HEALTH"
  | "MEDICAL_RECORD"
  | "PRESCRIPTION"
  | "LAB_REPORT"
  | "MEDICATION"
  | "SYMPTOM"
  | "GENERIC_MEDICAL"
  | "OTHER_PERSON_MEDICAL"
  | "APPOINTMENT"
  | "DOCTOR"
  | "HOSPITAL"
  | "LAB"
  | "PHARMACY"
  | "AAROGYA_JANI_SERVICE"
  | "GENERAL_CONVERSATION"
  | "EMERGENCY"
  | "UNKNOWN";

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
  subject: QuerySubject;
  relationship?: string;
  intent: QueryIntent;
  isEmergency: boolean;
  isNonMedical: boolean;
  isPatientSpecific: boolean;
  isGeneralMedical: boolean;
  isPlatformService: boolean;
  targetModules: PatientModule[];
  temporalFilter?: "latest" | "recent" | "last_month" | "historical" | "all";
  subjectSwitched?: boolean;
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

// ── 3. Health & Medical Vocabulary ───────────────────────────────────────────
const MEDICAL_KEYWORDS = [
  "fever", "cough", "cold", "flu", "dengue", "malaria", "typhoid", "covid", "infection",
  "pain", "ache", "headache", "migraine", "nausea", "vomiting", "diarrhea", "constipation",
  "blood pressure", "hypertension", "hypotension", "diabetes", "glucose", "insulin", "sugar",
  "cholesterol", "lipid", "triglycerides", "hemoglobin", "anemia", "platelet", "wbc", "rbc",
  "asthma", "allergy", "rash", "itching", "swelling", "inflammation", "dehydration", "hydration",
  "stomach", "gastric", "acidity", "gerd", "ulcer", "liver", "kidney", "creatinine", "thyroid", "tsh",
  "heart", "cardio", "pulse", "ecg", "heart rate", "oxygen", "spo2", "temperature",
  "pcod", "pcos", "polycystic", "period", "menstrual", "pregnancy", "pregnant",
  "medicine", "medication", "tablet", "capsule", "syrup", "dosage", "dose", "antibiotic",
  "paracetamol", "dolo", "azithromycin", "amoxicillin", "pantoprazole", "cetirizine", "metformin", "atorvastatin",
  "doctor", "physician", "specialist", "cardiologist", "dermatologist", "neurologist", "pediatrician", "gynecologist",
  "hospital", "clinic", "prescription", "prescriptions", "prescribed", "prescribe", "lab", "test", "scan", "x-ray", "mri", "ct scan", "ultrasound",
  "symptom", "diagnosis", "treatment", "cure", "prevention", "vaccine", "diet", "nutrition",
  "exercise", "mental health", "anxiety", "depression", "insomnia", "sleep", "vital", "timeline",
  "vitamin", "mineral", "supplement", "electrolytes", "ors", "bmi", "weight loss", "obesity",
  "precaution", "precautions", "remedy", "remedies", "care", "home care", "blood", "blood test", "blood report",
  // Extended health vocabulary
  "thyroid", "hypothyroid", "hyperthyroid", "goiter", "tsh", "t3", "t4",
  "asthma", "inhaler", "bronchitis", "wheeze", "wheezing", "copd", "lungs", "respiratory",
  "migraine", "vertigo", "dizziness", "fainting", "seizure", "epilepsy", "neurological",
  "kidney stone", "uti", "urinary", "bladder", "renal", "nephrology", "dialysis",
  "cholesterol", "ldl", "hdl", "lipid profile", "triglycerides", "coronary", "cardiovascular",
  "anxiety", "depression", "stress", "burnout", "panic", "ocd", "adhd", "autism", "bipolar",
  "vitamin d", "vitamin b12", "iron", "calcium", "magnesium", "zinc", "folic acid", "omega",
  "weight", "overweight", "underweight", "bmi", "metabolism", "calorie", "intermittent fasting",
  "pregnancy", "prenatal", "antenatal", "trimester", "breastfeeding", "lactation", "menopause",
  "skin", "acne", "eczema", "psoriasis", "dermatitis", "fungal", "ringworm", "dandruff",
  "arthritis", "joint", "ligament", "tendon", "back pain", "sciatica", "osteoporosis", "fracture",
  "eye", "vision", "cataract", "glaucoma", "conjunctivitis", "retina",
  "ear", "hearing", "tinnitus", "otitis",
  "dental", "tooth", "oral health", "gums",
  "cancer", "tumor", "chemotherapy", "oncology", "biopsy",
  "immune", "immunity", "autoimmune", "inflammation",
  "surgery", "operation", "recovery", "wound", "dressing",
  "dehydration", "electrolyte", "ors", "saline",
  "blood sugar", "fasting", "postprandial", "insulin resistance",
  "physiotherapy", "rehabilitation", "occupational therapy",
  "health check", "health checkup", "annual health", "preventive care"
];

// ── 4. Third-Person / Other Person Relative Indicators ─────────────────────────
const OTHER_PERSON_RELATIONSHIPS: Array<{ rel: string; regex: RegExp }> = [
  { rel: "sister", regex: /\b(my\s+sister|for\s+my\s+sister|sister's|sister\s+is|sister\s+has)\b/i },
  { rel: "brother", regex: /\b(my\s+brother|for\s+my\s+brother|brother's|brother\s+is|brother\s+has)\b/i },
  { rel: "father", regex: /\b(my\s+(father|dad|papa)|for\s+my\s+(father|dad|papa)|father's|dad's|father\s+is|father\s+has|dad\s+is|dad\s+has)\b/i },
  { rel: "mother", regex: /\b(my\s+(mother|mom|mummy|maa)|for\s+my\s+(mother|mom|mummy|maa)|mother's|mom's|mother\s+is|mother\s+has|mom\s+is|mom\s+has)\b/i },
  { rel: "child", regex: /\b(my\s+(child|kid|son|daughter|baby|toddler|infant|newborn)|child's|kid's|son's|daughter's|baby's|my\s+boy|my\s+girl)\b/i },
  { rel: "spouse", regex: /\b(my\s+(wife|husband|spouse|partner|fiance|fiancee)|wife's|husband's|spouse's|partner's)\b/i },
  { rel: "friend", regex: /\b(my\s+friend|for\s+a\s+friend|friend's|my\s+colleague|my\s+roommate|my\s+neighbor)\b/i },
  { rel: "grandparent", regex: /\b(my\s+(grandfather|grandmother|grandpa|grandma|nana|nani|dada|dadi))\b/i },
  { rel: "relative", regex: /\b(my\s+(uncle|aunt|cousin|relative|nephew|niece|in-law|mother-in-law|father-in-law))\b/i },
  { rel: "third_party", regex: /\b(someone\s+else|another\s+person|other\s+person|a\s+patient|a\s+person|someone\s+i\s+know|for\s+someone|for\s+her|for\s+him|she\s+has|he\s+has|she\s+is\s+having|he\s+is\s+having|she's\s+having|he's\s+having)\b/i },
];

// ── 5. Platform Service Patterns ─────────────────────────────────────────────
const PLATFORM_SERVICE_PATTERNS = [
  /\b(how\s+to\s+book|how\s+can\s+i\s+book|how\s+do\s+i\s+book|book\s+a\s+doctor|book\s+an?\s+appointment|schedule\s+an?\s+appointment|make\s+an?\s+appointment)\b/i,
  /\b(book\s+a\s+lab|book\s+a\s+test|book\s+diagnostic|order\s+medicine|order\s+medicines|pharmacy\s+order|doorstep\s+delivery)\b/i,
  /\b(find\s+a\s+doctor|find\s+a\s+hospital|find\s+a\s+clinic|find\s+a\s+lab|find\s+a\s+pharmacy|near\s+me)\b/i,
  /\b(how\s+does\s+aarogya\s*genie\s+work|features\s+of\s+aarogya\s*genie|upload\s+prescription|upload\s+report|how\s+to\s+use\s+this\s+app)\b/i,
  /\b(consultation\s+fee|consultation\s+price|lab\s+test\s+fee|pricing\s+on\s+aarogya|how\s+much\s+does\s+it\s+cost\s+to\s+book)\b/i,
];

// ── 6. Explicit Self-Referential Patterns ─────────────────────────────────────
const SELF_EXPLICIT_PATTERNS = [
  // First-person statements with symptoms or health conditions
  /\b(i\s+have|i\s+had|i'm\s+having|i\s+am\s+having|i\s+feel|i'm\s+feeling|i\s+am\s+feeling|i\s+suffer|i\s+got|i've\s+got)\b/i,
  /\b(i\s+was|i\s+am|i'm|i\s+took|i\s+ordered|i\s+bought|i\s+booked|i\s+checked|i\s+underwent|did\s+i|have\s+i|had\s+i|was\s+i|am\s+i)\b/i,
  /\b(prescribed\s+(to|for)\s+me|ordered\s+by\s+me|checked\s+by\s+me|taken\s+by\s+me|recommended\s+to\s+me)\b/i,
  /\b(for\s+me|to\s+me|safe\s+for\s+me|can\s+i\s+take|should\s+i\s+take|can\s+i\s+use|should\s+i\s+use)\b/i,
  /\bmy\s+(?:last|latest|recent|newest|old|previous|all|all\s+my|first)?\s*(history|medical\s+history|health\s+history|record|records|health\s+record|profile)\b/i,
  /\bmy\s+(?:last|latest|recent|newest|old|previous|all|active)?\s*(medicine|medicines|medication|medications|orders|order|prescriptions|prescription|rx|reminder|reminders)\b/i,
  /\bmy\s+(?:last|latest|recent|newest|old|previous|next|upcoming)?\s*(appointment|appointments|doctor|doctors|visit|visits|consultation|consultations)\b/i,
  /\bmy\s+(?:last|latest|recent|newest|old|previous)?\s*(test|tests|lab|labs|report|reports|results|result|diagnosis|diagnoses|scan|mri|x-ray|blood\s+test|blood\s+report|blood\s+tests|blood\s+reports|cbc|hemoglobin)\b/i,
  /\bmy\s+(?:current|recent|past|active)?\s*(symptom|symptoms|fever|cough|pain|headache|stomach|chest|bp|blood\s+pressure|sugar|hemoglobin|timeline|events|episodes|allergies|conditions)\b/i,
  /\b(what\s+(did|have|were)\s+i|what\s+were\s+my|what\s+did\s+my|when\s+(did|was)\s+(my|i)|where\s+was\s+my|show\s+(me\s+)?(my|all\s+my)|summarize\s+my)\b/i,
  /\b(considering\s+my|based\s+on\s+my|looking\s+at\s+my|in\s+my\s+records?|from\s+my\s+profile)\b/i,
  /\b(did\s+my\s+doctor|has\s+my\s+doctor|what\s+did\s+my\s+doctor)\b/i,
];

/**
 * Classify a user query and determine the appropriate subject,
 * intent, category, and selective patient modules.
 */
export function classifyDomainAndIntent(
  query: string,
  recentHistory?: Array<{ sender: string; text: string }>
): IntentClassificationResult {
  const q = query.trim();
  const qLower = q.toLowerCase();

  // ── Step 1: Check Emergency First ──────────────────────────────────────────
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(q)) {
      return {
        category: "EMERGENCY",
        subject: "SELF",
        intent: "EMERGENCY",
        isEmergency: true,
        isNonMedical: false,
        isPatientSpecific: false,
        isGeneralMedical: true,
        isPlatformService: false,
        targetModules: [],
        emergencyMessage:
          "🚨 EMERGENCY ALERT: Your message mentions potential life-threatening symptoms. Please immediately call emergency services (112 / 911 / 108 in India) or visit the nearest hospital emergency room. Do not wait for symptoms to resolve on their own.",
      };
    }
  }

  // ── Step 2: Check Explicit Non-Medical Rejection ───────────────────────────
  for (const pattern of NON_MEDICAL_PATTERNS) {
    if (pattern.test(q)) {
      return {
        category: "GENERIC_KNOWLEDGE",
        subject: "GENERIC",
        intent: "GENERAL_CONVERSATION",
        isEmergency: false,
        isNonMedical: false,
        isPatientSpecific: false,
        isGeneralMedical: false,
        isPlatformService: false,
        targetModules: [],
      };
    }
  }

  // ── Step 3: Check Platform Service First ───────────────────────────────────
  const isPlatformService = PLATFORM_SERVICE_PATTERNS.some((p) => p.test(qLower));

  // ── Step 4: Check Third-Party / Other Person Subject ───────────────────────
  let detectedOtherPersonRel: string | undefined = undefined;
  for (const relObj of OTHER_PERSON_RELATIONSHIPS) {
    if (relObj.regex.test(qLower)) {
      detectedOtherPersonRel = relObj.rel;
      break;
    }
  }

  // ── Step 5: Check Self Subject ─────────────────────────────────────────────
  let matchesSelfExplicit = false;
  if (!detectedOtherPersonRel && !isPlatformService) {
    matchesSelfExplicit = SELF_EXPLICIT_PATTERNS.some((p) => p.test(qLower));
  }

  // ── Step 6: Check Follow-ups & Conversation Memory Context ─────────────────
  let isFollowUpTurn = false;
  let subjectSwitched = false;
  let previousSubject: QuerySubject | undefined = undefined;

  if (recentHistory && recentHistory.length > 0) {
    const userTurns = recentHistory.filter((h) => h.sender === "patient" || h.sender === "user");
    const lastUserTurn = userTurns[userTurns.length - 1];

    if (lastUserTurn) {
      const lastTextLower = lastUserTurn.text.toLowerCase();
      // Determine previous turn's subject
      const prevWasOther = OTHER_PERSON_RELATIONSHIPS.some((r) => r.regex.test(lastTextLower));
      previousSubject = prevWasOther ? "OTHER_PERSON" : SELF_EXPLICIT_PATTERNS.some((p) => p.test(lastTextLower)) ? "SELF" : "GENERIC";

      // If current query explicitly refers to OTHER_PERSON, mark subject switch
      if (detectedOtherPersonRel && previousSubject === "SELF") {
        subjectSwitched = true;
      }

      // Check if current query is a short ellipsis / follow-up without introducing a new subject
      // e.g. "Since yesterday", "Around 102", "For 2 days", "Which one was for blood pressure?"
      const isShortEllipsis = /^(since\s+|for\s+\d+|about\s+\d+|around\s+\d+|yesterday|today|last\s+night|yes|no|none|and\s+nausea|which\s+one|what\s+about\s+the\s+other|what\s+was\s+it)\b/i.test(qLower) ||
        (q.split(/\s+/).length <= 4 && !detectedOtherPersonRel && !matchesSelfExplicit && !/^(what\s+is|how\s+to|what\s+are)\b/i.test(qLower));

      if (isShortEllipsis && !detectedOtherPersonRel && !isPlatformService) {
        isFollowUpTurn = true;
        if (previousSubject === "SELF") {
          matchesSelfExplicit = true;
        } else if (previousSubject === "OTHER_PERSON") {
          detectedOtherPersonRel = "other_person";
        }
      }
    }
  }

  // ── Step 7: Determine Subject ──────────────────────────────────────────────
  let subject: QuerySubject = "GENERIC";
  if (detectedOtherPersonRel) {
    subject = "OTHER_PERSON";
  } else if (matchesSelfExplicit) {
    subject = "SELF";
  } else {
    // Check if greeting or purely conversational
    if (/^(hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon|namaste|help|start|thanks|thank\s+you)\b/i.test(qLower.trim())) {
      subject = "UNCLEAR";
    } else {
      subject = "GENERIC";
    }
  }

  // ── Step 8: Classify Granular Intent ───────────────────────────────────────
  let intent: QueryIntent = "UNKNOWN";

  if (isPlatformService) {
    if (/\b(doctor|physician|specialist|consultation)\b/i.test(qLower)) {
      intent = /\b(book|schedule|appointment)\b/i.test(qLower) ? "APPOINTMENT" : "DOCTOR";
    } else if (/\b(hospital|clinic)\b/i.test(qLower)) {
      intent = "HOSPITAL";
    } else if (/\b(lab|test|diagnostic|blood\s+test)\b/i.test(qLower)) {
      intent = "LAB";
    } else if (/\b(medicine|pharmacy|order|delivery)\b/i.test(qLower)) {
      intent = "PHARMACY";
    } else {
      intent = "AAROGYA_JANI_SERVICE";
    }
  } else if (subject === "OTHER_PERSON") {
    intent = "OTHER_PERSON_MEDICAL";
  } else if (subject === "SELF") {
    if (/\b(prescription|prescriptions|prescribed|prescribe|prescribing|rx|doctor\s+prescribe|doctor\s+prescribed)\b/i.test(qLower)) {
      intent = "PRESCRIPTION";
    } else if (/\b(lab|labs|report|reports|test|tests|result|results|blood\s+report|blood\s+test|cbc|hemoglobin\s+test|blood\s+results)\b/i.test(qLower)) {
      intent = "LAB_REPORT";
    } else if (/\b(medicine|medicines|medication|medications|orders|order|pharmacy|tablet|pill|dose|reminder|reminders)\b/i.test(qLower)) {
      intent = "MEDICATION";
    } else if (/\b(appointment|appointments|visit|visits|consultation|doctor\s+visit)\b/i.test(qLower)) {
      intent = "APPOINTMENT";
    } else if (/\b(history|record|records|health\s+record|profile|timeline|summary|journey)\b/i.test(qLower)) {
      intent = "MEDICAL_RECORD";
    } else if (/\b(symptom|symptoms|fever|cough|pain|headache|nausea|vomiting|feeling|having\s+pain|hurt|hurts)\b/i.test(qLower)) {
      intent = "SYMPTOM";
    } else {
      intent = "PERSONAL_HEALTH";
    }
  } else {
    // Subject is GENERIC or UNCLEAR
    if (/^(hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon|namaste|thanks|thank\s+you)\b/i.test(qLower.trim())) {
      intent = "GENERAL_CONVERSATION";
    } else {
      intent = "GENERIC_MEDICAL";
    }
  }

  // ── Step 9: General Medical Validity Check ─────────────────────────────────
  const hasMedicalKeywords = MEDICAL_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${kw}s?\\b`, "i");
    return regex.test(qLower);
  });

  const hasHealthQuestionPattern = /\b(symptom|cause|treatment|cure|remedy|prevent|precaution|precautions|contagious|safe to take|side effect|dosage of|what should i do if|when to see a doctor|home care for|meaning of|what is|how is|why do i feel|diet for|what to eat|how to reduce|how to control|how to manage|how to improve|how to treat|how to prevent|foods good for|foods that help|foods to avoid|natural remedy|home remedy|is it normal|can i take|should i eat|what causes|signs of|symptoms of|effects of|difference between|good for health|healthy food|healthy diet|bad for health|is safe|are safe|when to|how long|how much|daily intake|recommended dose|normal range|reference range|test for|checked for|risk factor|risk of|complication|early sign|warning sign|red flag|seek doctor|consult doctor|see a doctor|health benefit|nutritional|calorie in|protein in|carbohydrate|fat content)\b/i.test(qLower);
  const isGeneralMedical = hasMedicalKeywords || hasHealthQuestionPattern || subject === "SELF" || subject === "OTHER_PERSON";

  // Rejection check for completely out-of-domain queries — require > 4 words to avoid dismissing short health terms
  if (!isGeneralMedical && !isPlatformService && intent !== "GENERAL_CONVERSATION" && q.split(/\s+/).length > 4) {
    return {
      category: "GENERIC_KNOWLEDGE",
      subject: "GENERIC",
      intent: "GENERAL_CONVERSATION",
      isEmergency: false,
      isNonMedical: false,
      isPatientSpecific: false,
      isGeneralMedical: false,
      isPlatformService: false,
      targetModules: [],
    };
  }

  // ── Step 10: Conditional Patient Module Selection ──────────────────────────
  // CRITICAL RULE: Patient records are ONLY retrieved if subject is SELF, NOT a platform service question,
  // and intent requires personal records.
  // If subject is OTHER_PERSON, GENERIC, or PLATFORM_SERVICE, targetModules MUST BE EMPTY!
  const targetModules: PatientModule[] = [];

  let isPatientSpecific = false;
  if (subject === "SELF" && !isPlatformService) {
    isPatientSpecific = true;
    // Profile is included for safety (allergies, chronic conditions) when discussing personal symptoms/meds
    targetModules.push("profile");

    if (intent === "PRESCRIPTION") {
      targetModules.push("prescriptions");
    } else if (intent === "LAB_REPORT") {
      targetModules.push("lab_reports", "diagnostics");
    } else if (intent === "MEDICATION") {
      targetModules.push("medicines", "prescriptions");
    } else if (intent === "APPOINTMENT") {
      targetModules.push("appointments");
    } else if (intent === "SYMPTOM") {
      targetModules.push("symptoms", "prescriptions", "medicines");
    } else if (intent === "MEDICAL_RECORD" || intent === "PERSONAL_HEALTH") {
      targetModules.push("timeline", "symptoms", "prescriptions", "medicines", "appointments", "lab_reports", "episodes");
    } else {
      // Broad personal inquiry
      targetModules.push("prescriptions", "medicines", "lab_reports", "appointments");
    }
  }

  // ── Step 11: Determine Temporal Filter ─────────────────────────────────────
  let temporalFilter: IntentClassificationResult["temporalFilter"] = undefined;
  if (/\b(last|latest|most recent|newest|recent)\b/i.test(qLower)) {
    temporalFilter = "latest";
  } else if (/\b(last month|this month|in august|in july|in 2026)\b/i.test(qLower)) {
    temporalFilter = "last_month";
  } else if (/\b(before|after|earlier|first|previous)\b/i.test(qLower)) {
    temporalFilter = "historical";
  }

  // ── Step 12: Determine Overall Category ────────────────────────────────────
  let category: DomainCategory = "GENERAL_MEDICAL";
  if (isPlatformService) {
    category = "PLATFORM_SERVICE";
  } else if (isPatientSpecific && hasMedicalKeywords) {
    category = "HYBRID";
  } else if (isPatientSpecific) {
    category = "PATIENT_SPECIFIC";
  } else {
    category = "GENERAL_MEDICAL";
  }

  return {
    category,
    subject,
    relationship: detectedOtherPersonRel,
    intent,
    isEmergency: false,
    isNonMedical: false,
    isPatientSpecific,
    isGeneralMedical: !isPlatformService && intent !== "GENERAL_CONVERSATION",
    isPlatformService,
    targetModules: Array.from(new Set(targetModules)),
    temporalFilter,
    subjectSwitched,
  };
}

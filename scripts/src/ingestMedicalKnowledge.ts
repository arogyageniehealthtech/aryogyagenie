/**
 * Medical Knowledge Base Ingestion Script
 *
 * Ingests official medical guideline documents into PostgreSQL vector store.
 * Supports two embedding providers (auto-detected from environment):
 *
 *   GEMINI_API_KEY set  →  Google Gemini text-embedding-004  (production / Render)
 *   OLLAMA_URL set      →  Ollama nomic-embed-text            (local development)
 *
 * Run locally:     pnpm run rag:ingest
 * Run on Render:   Set GEMINI_API_KEY + DATABASE_URL env vars, then run the same command
 *                  against the Render DB's External URL.
 */

import path from "node:path";
import fs from "node:fs";
import { ingestMedicalDocument, type IngestDocumentInput } from "@workspace/api-server/services/documentIngestionService";
import { detectEmbeddingProvider, getActiveEmbeddingModel } from "@workspace/api-server/services/ollamaEmbeddingService";

function findDocsDir(): string {
  let dir = import.meta.dirname;
  while (dir) {
    const candidate = path.join(dir, "artifacts/api-server/src/data/medical_docs");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), "artifacts/api-server/src/data/medical_docs");
}

const DOCS_DIR = findDocsDir();

const DOC_METADATA: Record<string, Omit<IngestDocumentInput, "filePath" | "rawText">> = {
  "CARD-001_acute_chest_pain_triage.md": {
    documentId: "CARD-001",
    title: "Acute Chest Pain & Coronary Triage Guidelines",
    category: "cardiology",
    tags: ["chest pain", "angina", "myocardial infarction", "cardiology", "emergency", "shortness of breath"],
    source: "ACC/AHA Clinical Practice Guidelines for Evaluation of Chest Pain",
    publisher: "American College of Cardiology & AHA",
    documentType: "clinical_guideline",
    version: "2.0",
  },
  "CARD-002_hypertension_classification.md": {
    documentId: "CARD-002",
    title: "Hypertension & Blood Pressure Classification Guidelines",
    category: "cardiology",
    tags: ["hypertension", "blood pressure", "high bp", "systolic", "diastolic", "cardiovascular"],
    source: "ESH/ESC Hypertension Clinical Guidelines & AHA Standards",
    publisher: "European Society of Cardiology & AHA",
    documentType: "clinical_guideline",
    version: "1.5",
  },
  "ENDO-001_diabetes_fasting_glucose.md": {
    documentId: "ENDO-001",
    title: "Fasting Blood Glucose & HbA1c Reference Standards",
    category: "endocrinology",
    tags: ["glucose", "sugar", "diabetes", "hba1c", "fasting blood sugar", "insulin", "endocrinology"],
    source: "ADA Standards of Care in Diabetes",
    publisher: "American Diabetes Association",
    documentType: "clinical_guideline",
    version: "2026.1",
  },
  "HEMAT-001_cbc_blood_count_reference.md": {
    documentId: "HEMAT-001",
    title: "Complete Blood Count (CBC) Reference Ranges & Hematology Protocols",
    category: "hematology",
    tags: ["cbc", "hemoglobin", "wbc", "white blood cells", "platelets", "anemia", "leukocytosis", "hematology"],
    source: "Clinical Laboratory Reference Ranges Handbook",
    publisher: "International Society of Hematology",
    documentType: "lab_reference",
    version: "3.0",
  },
  "HEMAT-002_iron_deficiency_anemia_guidelines.md": {
    documentId: "HEMAT-002",
    title: "Iron Deficiency Anemia Clinical Practice Guidelines",
    category: "hematology",
    tags: ["anemia", "iron deficiency", "ferritin", "hemoglobin", "fatigue", "weakness", "pallor", "blood loss", "pica"],
    source: "ASH Clinical Practice Guidelines for Management of Anemia",
    publisher: "American Society of Hematology",
    documentType: "clinical_guideline",
    version: "2026.1",
  },
  "PULM-001_acute_dyspnea_pulmonary.md": {
    documentId: "PULM-001",
    title: "Acute Dyspnea & Respiratory Assessment Protocol",
    category: "pulmonology",
    tags: ["breathing", "dyspnea", "asthma", "copd", "pneumonia", "oxygen saturation", "pulmonology"],
    source: "Global Initiative for Asthma (GINA) & ATS Clinical Guidelines",
    publisher: "American Thoracic Society",
    documentType: "clinical_guideline",
    version: "2025.2",
  },
  "PULM-002_pneumonia_clinical_guidelines.md": {
    documentId: "PULM-002",
    title: "Community-Acquired Pneumonia Clinical Guidelines",
    category: "pulmonology",
    tags: ["pneumonia", "cough", "phlegm", "sputum", "fever", "chills", "chest pain", "pulmonology", "bacterial infection"],
    source: "IDSA/ATS Consensus Guidelines for Management of Community-Acquired Pneumonia",
    publisher: "Infectious Diseases Society of America & ATS",
    documentType: "clinical_guideline",
    version: "2026.1",
  },
  "PHARM-001_antibiotic_stewardship_safety.md": {
    documentId: "PHARM-001",
    title: "Antibiotic Stewardship & Pharmacological Safety Rules",
    category: "pharmacology",
    tags: ["antibiotic", "amoxicillin", "azithromycin", "dosage", "infection", "pharmacology"],
    source: "CDC Core Elements of Antibiotic Stewardship & WHO Safety Standards",
    publisher: "World Health Organization & CDC",
    documentType: "pharmacology_protocol",
    version: "4.1",
  },
};

export async function runIngestion(): Promise<void> {
  const provider = detectEmbeddingProvider();
  const model = getActiveEmbeddingModel();

  console.log("=================================================");
  console.log("STARTING MEDICAL KNOWLEDGE BASE VECTOR INGESTION");
  console.log(`Embedding Provider : ${provider === "gemini" ? "Google Gemini (text-embedding-004)" : "Ollama (nomic-embed-text)"}`);
  console.log(`Active Model       : ${model}`);
  console.log(`Vector Dimensions  : 768 (both providers)`);
  console.log("=================================================");

  if (provider === "ollama" && !process.env.OLLAMA_URL && process.env.OLLAMA_URL !== "") {
    console.log("ℹ Using default Ollama URL: http://localhost:11434");
  }

  if (!fs.existsSync(DOCS_DIR)) {
    throw new Error(`Medical docs directory does not exist: ${DOCS_DIR}`);
  }

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} medical knowledge markdown documents.`);

  for (const filename of files) {
    const meta = DOC_METADATA[filename];
    if (!meta) {
      console.warn(`Skipping unconfigured doc file: ${filename}`);
      continue;
    }

    const filePath = path.join(DOCS_DIR, filename);
    console.log(`\nIngesting [${meta.documentId}]: ${meta.title}...`);

    const result = await ingestMedicalDocument({
      ...meta,
      filePath,
    });

    console.log(`✓ Document ${result.documentId} ingested successfully! Total Chunks: ${result.totalChunks}`);
    for (const chunk of result.chunks) {
      console.log(`   └─ Chunk ${chunk.chunkIndex} [Section: ${chunk.section}] Vector Dim: ${chunk.vectorLength}`);
    }
  }

  console.log("\n=================================================");
  console.log("ALL MEDICAL KNOWLEDGE DOCUMENTS INGESTED INTO POSTGRES");
  console.log("=================================================");
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.includes("ingestMedicalKnowledge")) {
  runIngestion().catch((err) => {
    console.error("Ingestion Script Failed:", err);
    process.exit(1);
  });
}

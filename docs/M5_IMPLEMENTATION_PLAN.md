# Milestone 5 — Final Approved Implementation Specification

> [!IMPORTANT]
> **READ THIS BEFORE IMPLEMENTING MILESTONE 5**  
> This specification is the complete, self-contained implementation plan for **Milestone 5 (Medical RAG Knowledge Engine & Prescription/Report OCR Pipeline)**. Any developer or AI coding agent taking over this workspace should follow these instructions precisely.

---

## 1. System Architecture Overview

Milestone 5 builds a reusable medical intelligence layer that enriches the existing local Ollama AI Gateway with verified clinical evidence and enables document OCR ingestion for prescriptions and lab reports.

```
                    ┌───────────────┐
                    │  ArogyaGenie  │
                    └───────┬───────┘
                            │
                     ┌──────▼──────┐
                     │ AI Gateway  │
                     └──────┬──────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
        Medical RAG                  OCR Pipeline
       (ragService.ts)              (ocrService.ts)
              │                           │
       Vector Retriever             Text Extractor
(TF-IDF / Cosine Similarity)      (Rx & Lab Parser)
              │                           │
       Knowledge Base              Extracted Data
(Clinical Guidelines / Ranges)    (Medicines / Values)
              │                           │
              └─────────────┬─────────────┘
                            │
                         Ollama
```

---

## 2. Component Specifications

### A. Medical RAG Engine (`artifacts/api-server/src/services/ragService.ts`)
- **Knowledge Repository**: Curated clinical guidelines across Cardiology, Pulmonology, Endocrinology, Hematology, and Pharmacology.
- **Vector Search Algorithm**: TF-IDF (Term Frequency-Inverse Document Frequency) vectorization with Cosine Similarity scoring.
- **Exported Methods**:
  - `searchMedicalKnowledge(query: string, topK?: number): RAGRetrievalResult[]`
  - `retrieveMedicalContext(query: string): string`
- **Integration**: Injected into `buildSymptomPrompt()` and `buildReportPrompt()` in [aiGateway.ts](file:///c:/Users/User/Desktop/Arogya-Genie/artifacts/api-server/src/services/aiGateway.ts).

### B. Prescription & Report OCR Engine (`artifacts/api-server/src/services/ocrService.ts`)
- **Document Text Extractor**: Extracts medication names, dosage numbers, frequency schedules, lab test names, numerical readings, units, reference ranges, and out-of-range indicators.
- **Exported Methods**:
  - `processOCR(input: OCRInput): OCRResult`
- **Frontend Integration**:
  - Integrated in [PrescribeModal.tsx](file:///c:/Users/User/Desktop/Arogya-Genie/artifacts/arogyagenie/src/pages/doctor/PrescribeModal.tsx) via "Auto-Scan Rx with OCR" tool.
  - Integrated in [UploadReportModal.tsx](file:///c:/Users/User/Desktop/Arogya-Genie/artifacts/arogyagenie/src/pages/diagnostic/UploadReportModal.tsx) via "Auto-Extract with OCR" tool.

---

## 3. REST API Specifications

### 1. Medical Knowledge Search
- **Endpoint**: `GET /api/medical-knowledge/search`
- **Auth**: Public / Optional Auth
- **Query Parameters**: `q` (string, required), `limit` (number, optional, default: 3)
- **Response**: Array of `MedicalKnowledgeResult` (`{ score: number, doc: { id, category, title, content, tags } }`)

### 2. OCR Document Extraction
- **Endpoint**: `POST /api/ocr/extract`
- **Auth**: Required (`requireAuth`)
- **Body**: `{ rawText?: string, imageBase64?: string, fileUrl?: string }`
- **Response**: `OCRResult` (`{ rawExtractedText, documentType, extractedMedicines, extractedLabValues, confidenceScore }`)

---

## 4. Security & Safety Rules

1. **Emergency Guardrail Priority**: Emergency keyword detection (e.g., chest pain, severe shortness of breath) must execute BEFORE any RAG or LLM processing, immediately returning an `EMERGENCY` triage response.
2. **Human Verification Requirement**: OCR extraction results must NEVER silently insert confirmed prescription records into the database. They must be displayed in an editable modal for provider or patient verification.
3. **Data Isolation**: Public medical knowledge base documents must remain strictly separated from private patient medical records in PostgreSQL.

---

## 5. Verification & Acceptance Criteria

1. **Codegen**: Running `npx pnpm --filter @workspace/api-spec run codegen` completes cleanly.
2. **Typecheck**: Running `npx pnpm run typecheck` passes with **0 errors** across all 9 workspace packages.
3. **RAG Test**: Querying symptoms or lab test names retrieves relevant clinical context snippets in LLM prompts.
4. **OCR Test**: Submitting document text or image payloads extracts structured medicines and test values.

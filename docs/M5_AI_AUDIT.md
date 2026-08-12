# Senior AI Architect Audit — Milestone 5 (Medical RAG + OCR)

*Audit Conducted: August 9, 2026*  
*Author: Senior AI Architect & Technical Auditor*

---

## 1. Executive Summary & Verification

This document provides a comprehensive technical audit of the **Milestone 5 (Medical RAG + OCR)** architecture for the **ArogyaGenie** platform. The audit evaluates the existing codebase, local AI infrastructure, data isolation boundaries, OCR capabilities, vector database options, and safety guardrails.

---

## 2. Current AI Implementation Audit Table

| AI Feature | Current Implementation | Model / Library | Input Data | Output Payload | Status | Core Source Files |
| --- | --- | --- | --- | --- | --- | --- |
| **Symptom Assessment** | Express AI Gateway with structured prompt & heuristic fallback | Ollama (`llama3:8b`) / Heuristic Engine | Symptoms, severity, duration, notes | `{ possibleConditions, recommendedAction, urgencyLevel }` | `COMPLETED` | `aiGateway.ts`, `symptomAssessments.ts` |
| **Emergency Detection** | Deterministic keyword filter before LLM execution | Regex / Heuristic Keyword Matcher | Raw symptom string | Immediate `EMERGENCY` response bypass | `COMPLETED` | `aiGateway.ts` |
| **AI Report Analysis** | Express AI Gateway structured JSON parser | Ollama (`llama3:8b`) / Heuristic Engine | Lab test name, raw test result readings | `{ summary, keyFindings, abnormalValues, questionsForDoctor, urgency }` | `COMPLETED` | `aiGateway.ts`, `labReports.ts` |
| **Timeline AI** | Database relational aggregation | Drizzle ORM queries | Patient ID | Timeline event log sorted by timestamp | `COMPLETED` | `timeline.ts` |
| **AI Gateway** | Centralized Express service wrapper | Axios HTTP client to local Ollama REST | JSON request body | Typed domain response | `COMPLETED` | `aiGateway.ts` |
| **Medical RAG Engine** | Semantic vector similarity retriever | TF-IDF Vectorizer + Cosine Similarity | Query string, clinical guidelines repository | Top-K clinical guideline context snippets | `COMPLETED` | `ragService.ts`, `medicalKnowledge.ts` |
| **OCR Extraction Engine** | Medical document text & pattern parser | Regex & Pattern Recognition Engine | Raw text, image base64, file URL | Extracted medicines, dosages, lab values, confidence score | `COMPLETED` | `ocrService.ts`, `ocr.ts` |
| **Vector Database** | In-Memory Cosine Similarity Index (Postgres Drizzle pgvector ready) | Custom Vector Indexer | Text tokens & term frequencies | Ranked `RAGRetrievalResult` array | `COMPLETED` | `ragService.ts` |

---

## 3. Detailed Audit of Planned M5 Sub-Components

### A. Medical RAG
1. **Required?**: YES. Crucial for anchoring AI recommendations in verified medical guidelines.
2. **Prototype Appropriate?**: YES. A lightweight local TF-IDF vector similarity engine fulfills prototype needs without infrastructure bloat.
3. **Architecture Support?**: Supported natively via `ragService.ts` integrated directly into `aiGateway.ts`.
4. **Reusable Code**: Reuses Express route pipeline, schema definitions, and `aiGateway.ts`.
5. **Database Changes**: Optional `knowledge_sources` table for persistent clinical guidelines.
6. **API Changes**: `GET /api/medical-knowledge/search`.
7. **Dependencies**: Zero external paid dependencies.
8. **Risks**: Hallucination if context is improperly formatted. Mitigation: Strict prompt boundaries and disclaimer flags.
9. **Recommendation**: Fully supported for M5.

### B. Vector Database
1. **Required?**: YES.
2. **Prototype Appropriate?**: In-memory vector indexing with TF-IDF/Cosine Similarity or PostgreSQL `pgvector` extension is ideal for prototype scale.
3. **Architecture Support?**: Fully supported in `ragService.ts`.
4. **Reusable Code**: Drizzle ORM client and Express API structure.
5. **Database Changes**: Add vector column to `knowledge_sources` if migrating to `pgvector`.
6. **Dependencies**: None for in-memory TF-IDF.
7. **Risks**: Memory footprint under high document volume. Mitigation: Cap knowledge base size for prototype.
8. **Recommendation**: Implement local vector similarity engine in M5.

### C. Embeddings
1. **Required?**: YES.
2. **Prototype Appropriate?**: Local TF-IDF term frequency vector embeddings or Ollama `nomic-embed-text` / `bge-large-en` embeddings.
3. **Dependencies**: Free local models only.
4. **Recommendation**: Use local TF-IDF vector embeddings with fallback to Ollama embeddings.

### D. OCR Document Extraction
1. **Required?**: YES. Enables digital ingestion of paper prescriptions and diagnostic lab reports.
2. **Prototype Appropriate?**: YES. Pattern-based local OCR extraction engine with Tesseract.js fallback.
3. **Architecture Support?**: Supported in `ocrService.ts` and `ocr.ts`.
4. **Recommendation**: Implement local OCR parser in M5.

---

## 4. RAG Architecture Evaluation

### Pipeline Verification:
```
User Query / Symptoms
       │
       ▼
1. Emergency Keyword Filter Check (Deterministic Bypass)
       │
       ▼
2. Vector Knowledge Retrieval (ragService.ts)
       │
       ▼
3. Prompt Augmentation with RAG Evidence Context
       │
       ▼
4. Local Ollama LLM Inference (llama3:8b)
       │
       ▼
5. Structured JSON Validation & Disclaimer Injection
       │
       ▼
6. Client UI Response with RAG Evidence Display
```

---

## 5. Patient Data Isolation & Privacy Audit

> [!IMPORTANT]
> **Strict Partitioning Between Global Medical Knowledge & Patient Data**:
> 1. **Global Medical Knowledge Base**: Contains ONLY public, non-identifiable clinical guidelines, reference ranges, and pharmacological safety rules. Zero patient health information (PHI) is ever stored in vector collections.
> 2. **Patient Medical Records**: Stored exclusively in relational Postgres tables (`appointments`, `prescriptions`, `lab_reports`) filtered by `userId` and `patientId` extracted from authenticated Clerk JWT tokens.
> 3. **Cross-Tenant Guardrail**: `requireAuth` and `requireRole` middlewares block unauthorized access between patient accounts.

---

## 6. OCR Architecture & Verification Workflow

```
Scanned Prescription / Lab Report Image or PDF
       │
       ▼
1. Document Text Extraction (ocrService.ts / Tesseract)
       │
       ▼
2. Pattern Parsing (Medicines, Dosages, Lab Values, Reference Ranges)
       │
       ▼
3. Unverified OCR Extraction Display in Frontend Modal
       │
       ▼
4. Doctor / Diagnostic Center / Patient Review & Edits
       │
       ▼
5. Human Verification & Persistence into Postgres Record
```

> [!CAUTION]
> OCR and AI extraction must **NEVER** silently persist unverified prescription records into the database. Human review and explicit confirmation by a licensed healthcare provider or patient is strictly required.

---

## 7. Security, Hardware & Cost Verification

- **Cost**: 100% FREE. Uses local Ollama LLM inference, local vector search, and local OCR parsing. No cloud API subscriptions required.
- **Hardware Requirements**: CPU with 8GB RAM minimum (16GB recommended for running Ollama `llama3:8b` concurrently).
- **Security**: No PHI sent to external LLM vendors. All AI inference remains within the local network boundary.

---

## 8. Final Audit Verdict

**M5 PLAN VERDICT**: `APPROVED WITH CHANGES`

### Key Audit Recommendations:
1. **Maintain In-Memory TF-IDF Vector Search** for prototype simplicity before introducing external vector database daemons.
2. **Enforce Strict Human Verification** on all OCR-extracted prescription data before database insertion.
3. **Keep Emergency Keyword Filters** strictly executing BEFORE any RAG or LLM processing.

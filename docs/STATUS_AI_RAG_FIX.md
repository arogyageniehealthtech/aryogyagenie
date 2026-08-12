# ArogyaGenie AI Context + RAG Fix Status Report

## WHAT WAS WRONG
1. **Symptom Assessment Respiratory Hallucinations**: When a patient reported stomach pain and answered follow-up questions (e.g., *"No cough, no sore throat"*), the system extracted the word "cough" from the question text or negative answer, and cosine similarity with RAG returned respiratory guidelines (URI, Acute Bronchitis), causing Gemini / heuristic fallback to diagnose Viral Upper Respiratory Infection instead of Gastroenterology/Gastritis.
2. **AI Health Assistant Refusal on Patient History**: When asked personal health questions like *"Did I ever face any health issue?"*, the assistant queried only the global medical vector database. Because global textbooks don't contain patient personal history, RAG returned 0 matches and the assistant refused with *"I couldn't find sufficiently relevant information in the available medical knowledge base..."* even though patient health records existed in ArogyaGenie.
3. **Hardcoded Ollama Provider in Sub-services**: `longitudinalAIService.ts` and `analyzeLabReport` made direct fetch calls to `http://localhost:11434` (Ollama), bypassing `callLLM()`. In Render production where Ollama is not present, these calls failed.
4. **Unsynchronized Health Timeline**: Symptom assessments were saved to `symptom_assessments` table without creating a linked event in `timeline_events` referencing `assessment.id`.

---

## WHAT WAS FIXED
1. **Negated Symptom Filtering & Active Symptom Extraction**: Added `extractActiveSymptomsText()` to separate active reported symptoms from question boilerplate and explicit negations ("no cough", "no fever"). RAG vector retrieval now queries only active reported symptoms.
2. **RAG Medical Domain Reranking**: Enhanced `searchMedicalKnowledge()` in `ragService.ts` with domain relevance reranking. Penalizes respiratory chunks when the patient reports abdominal/stomach pain and has no active respiratory symptoms.
3. **Query-Aware Hybrid Retrieval Architecture**: Redesigned `answerLongitudinalAssistant()` in `longitudinalAIService.ts` to utilize **TWO** distinct sources:
   - **Source A**: Authorized Patient Health Context (Profile: age, gender, blood group, allergies, existing conditions, medications, previous illnesses + symptoms, prescriptions, lab reports, appointments, timeline events).
   - **Source B**: Global Medical RAG (trusted medical guidelines).
   - Personal history queries answer directly from Patient Context. Zero global RAG matches no longer trigger a refusal when patient records exist.
4. **Provider-Agnostic Gemini / Ollama Pipeline**: Exported `callLLM()` and updated `detectEmbeddingProvider()` to use Gemini Flash (production) and gracefully fall back to local Ollama (development). Refactored `analyzeLabReport` and `longitudinalAIService` to use `callLLM()`.
5. **Timeline Synchronization**: Saving a symptom assessment in `symptomAssessments.ts` now creates a linked entry in `timelineEventsTable` with `referenceId: assessment.id`.

---

## FILES CHANGED
- `artifacts/api-server/src/services/aiGateway.ts`
- `artifacts/api-server/src/services/patientContextBuilder.ts`
- `artifacts/api-server/src/services/longitudinalAIService.ts`
- `artifacts/api-server/src/services/ragService.ts`
- `artifacts/api-server/src/services/ollamaEmbeddingService.ts`
- `artifacts/api-server/src/routes/symptomAssessments.ts`
- `artifacts/arogyagenie/src/components/health/HealthAssistantChat.tsx`
- `artifacts/api-server/src/__tests__/productionAiContextRag.test.ts` (NEW)

---

## DB/API CHANGES
- `POST /symptom-assessments`: Automatically creates a linked record in `timeline_events` referencing `assessment.id`.
- `POST /ai/health-assistant`: Evaluates query intent, retrieves Patient Context + Medical RAG, and generates grounded response without false refusals.

---

## AI/RAG CHANGES
- **Query Vector**: RAG vector query string built from `activeSymptoms` rather than raw prompt string containing negated questions/answers.
- **Reranking**: Respiratory knowledge chunks penalized (-0.25 similarity score) when query is purely abdominal. Abdominal and hematology chunks boosted (+0.08 / +0.10) for matching queries.
- **Embedding Provider**: Provider-aware (`gemini` for production, `ollama` for dev).

---

## TEST RESULTS
- `productionAiContextRag.test.ts`: **15 / 15 Passed** (Test Cases A through F).
- `symptomAssessmentWorkflow.test.ts`: **19 / 19 Passed**.
- `symptomValidation.test.ts`: **41 / 41 Passed**.
- `pnpm run typecheck`: **0 Errors**.
- `pnpm run build`: **All 4 workspace packages built successfully**.

---

## KNOWN LIMITATIONS
- Vector search similarity in local development relies on `nomic-embed-text` via Ollama when Gemini API key is not present.
- Medical knowledge chunks must be ingested via `pnpm run rag:ingest` with the matching model provider.

---

## NEXT TASK
- Deploy updated code to Render production environment and verify live Gemini API & PostgreSQL vector store integration.

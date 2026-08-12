# AI Architecture & Gateway Specifications

---

## 1. AI Architecture Overview

ArogyaGenie uses a centralized **AI Gateway** pattern (`artifacts/api-server/src/services/aiGateway.ts`). The frontend NEVER contacts LLMs directly — all requests flow through Express endpoints with authentication, rate limiting, RAG context enrichment, longitudinal patient context building, and fallback rules.

```
Patient / Doctor / Lab / Admin UI
       │
       ▼
Express API Server (/api/symptom-assessments, /api/lab-reports/:id/analyze, /api/patients/me/health-summary, /api/ai/health-assistant)
       │
       ▼
Longitudinal Patient Context Builder (patientContextBuilder.ts)
       │
       ▼
AI Gateway (aiGateway.ts / longitudinalAIService.ts)
       ├── 1. Emergency Safety Filter (Immediate Keyword Bypass - Zero Delay)
       ├── 2. Query Preprocessing & Vector Embedding (nomic-embed-text via Ollama)
       ├── 3. Vector Similarity Search (ragService.ts - PostgreSQL Cosine Similarity)
       ├── 4. Relevance Threshold Filter (RAG_SIMILARITY_THRESHOLD = 0.58, RAG_TOP_K = 5)
       ├── 5. Grounded Generation: Local Ollama REST API (llama3:8b, 15s timeout)
       ├── 6. Structured Response Builder with Clinical Evidence Attribution
       └── 7. Fallback: Deterministic Heuristic Engine
```

---

## 2. Supported AI Capabilities

### A. Symptom Triage & Assessment (RAG-Augmented)
- Endpoint: `POST /api/symptom-assessments`
- Primary Provider: Ollama (`llama3:8b`)
- Context Injection: `ragService.ts` vector similarity search retrieves top-K clinical guidelines.
- Output: Possible conditions, recommended action, urgency level (`LOW`, `MEDIUM`, `HIGH`, `EMERGENCY`).

### B. AI Medical Report Analysis (RAG-Augmented)
- Endpoint: `POST /api/lab-reports/:id/analyze` & automatic on report upload.
- Primary Provider: Ollama (`llama3:8b`)
- Output Schema: Key findings, abnormal value alerts, possible significance, questions for doctor, urgency level.

### C. Longitudinal Patient Health Intelligence
- Endpoints:
  - `GET /api/patients/me/health-summary` (Dynamic AI health summary)
  - `GET /api/patients/me/health-episodes` (Connected health journeys)
  - `GET /api/patients/me/lab-trends` (Multi-report quantitative trend analysis)
  - `GET /api/doctors/patients/:patientId/ai-summary` (Clinical executive briefing for authorized doctors)
  - `POST /api/ai/health-assistant` (Longitudinal context-aware Q&A chat)

### D. Medical RAG Vector Retriever
- Endpoint: `GET /api/medical-knowledge/search`
- Engine: TF-IDF vector term frequency calculation and Cosine Similarity scoring.

### E. Prescription & Report OCR Parser
- Endpoint: `POST /api/ocr/extract`
- Engine: `ocrService.ts` document parser extracting medication names, dosage frequencies, test result readings, and reference ranges.

---

## 3. Configuration & Environment Variables
- `OLLAMA_URL`: Default `http://localhost:11434`
- `OLLAMA_MODEL`: Default `llama3:8b`
- Timeout: `15000` ms

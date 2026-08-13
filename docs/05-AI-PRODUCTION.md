# 05-AI-PRODUCTION.md — AI & LLM Production Resilience Documentation

> **Phase:** 3 — Backend API Hardening  
> **Target:** 50,000 monthly users  
> **Status:** Complete ✅

---

## 1. Dual AI Provider Architecture

ArogyaGenie uses a provider-aware AI gateway in `services/aiGateway.ts`:
- **Production (Render):** Google Gemini 1.5 Flash (`gemini-1.5-flash`) for LLM inference and Gemini `text-embedding-004` for vector embeddings when `GEMINI_API_KEY` is set.
- **Local Development:** Ollama `llama3:8b` for LLM inference and `nomic-embed-text` for vector embeddings when running locally.
- **Heuristic Fallback:** Deterministic rule engine providing immediate response fallback if LLM calls fail or time out.

---

## 2. Gemini API Retry & Resilience

Updated `callLLM` function in `aiGateway.ts`:
- **Timeout:** 20-second timeout per attempt using `AbortController`.
- **Exponential Backoff Retry:** Automatically retries up to 2 times for transient HTTP status codes (`429 Rate Limit`, `500 Internal Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`) or network dropouts.
- **Backoff Delays:** `500ms` on 1st retry, `1000ms` on 2nd retry.
- **Failover Chain:** Gemini ➔ Retry (x2) ➔ Ollama (in dev) ➔ Heuristic Fallback Engine.

---

## 3. Telemetry Correction

Fixed `providerUsed` bug across `aiGateway.ts`:
- Previously returned `"ollama-llama3"` unconditionally regardless of active provider.
- Now accurately reports `"gemini-1.5-flash"`, `"ollama-llama3"`, or `"fallback-heuristic"` in all response payloads (`AISymptomAssessmentResponse`, `AILabReportResponse`).

---

## 4. RAG Retrieval Performance & Safety

- **5-Minute Chunk Cache:** In-memory knowledge chunk cache (`ragService.ts`) with pre-computed vector norms.
- **Cache Invalidation:** `invalidateRAGCache()` called automatically upon new document ingestion.
- **Domain Reranking:** Domain keyword relevance adjustments for abdominal, respiratory, cardiology, and hematology queries.
- **Fictional Query Filter:** Immediate rejection of fictional condition codes (`XYZ-123`, `nonexistent`) to prevent hallucinated medical advice.
- **Emergency Keyword Intercept:** Pre-AI safety scan for red-flag symptoms (`chest pain`, `stroke`, `unconscious`, `severe bleeding`) returning immediate emergency guidance (`911` / `108`).

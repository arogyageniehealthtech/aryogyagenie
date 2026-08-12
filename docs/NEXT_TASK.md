# Next Task Instructions for AI Developer

> [!IMPORTANT]
> **ALL PROTOTYPE MILESTONES (M1 THROUGH M7) ARE COMPLETED**  
> The core ArogyaGenie platform, provider ecosystem, local Ollama AI Gateway, Medical RAG engine, Document OCR parser, Longitudinal AI Health Intelligence, and prototype demonstration system are fully built, tested, and documented.

---

## Prototype Status Summary

1. **Milestone 1 — Patient Portal UI & Ollama AI Gateway**: `COMPLETED`
2. **Milestone 2 — Doctor Portal UI & Dashboard**: `COMPLETED`
3. **Milestone 3 — Diagnostic Center & Pharmacy Portals**: `COMPLETED`
4. **Milestone 4 — Admin Portal & AI Medical Report Analysis**: `COMPLETED`
5. **Milestone 5 — Medical RAG & Prescription OCR**: `COMPLETED`
6. **Milestone 6 — Longitudinal AI Health Intelligence**: `COMPLETED`
7. **Milestone 7 — Prototype Hardening & Demo Readiness**: `COMPLETED`

---

## Operating Instructions for Future AI Assistants

```bash
# 1. Verify workspace typechecking across all 9 packages
npx pnpm run typecheck

# 2. Execute synthetic demo data seed script
npx pnpm --filter @workspace/scripts run seed

# 3. Ingest medical knowledge base vector embeddings into PostgreSQL
npm run rag:ingest

# 4. Run automated test suites
npx tsx artifacts/api-server/src/__tests__/providerOnboardingApproval.test.ts
npx tsx artifacts/api-server/src/__tests__/healthAssistantRag.test.ts
npx tsx artifacts/api-server/src/__tests__/symptomAssessmentWorkflow.test.ts
npx tsx artifacts/api-server/src/__tests__/m7Verification.test.ts

# 5. Launch backend API server (port 5000)
npx pnpm --filter @workspace/api-server run dev

# 6. Launch frontend React/Vite web application (port 5173)
npx pnpm --filter @workspace/arogyagenie run dev
```

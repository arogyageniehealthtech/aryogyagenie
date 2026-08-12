# Known Prototype Limitations

The current ArogyaGenie repository is a functional Phase 1 prototype. The following limitations are expected:

---

## 1. UI Limitations
- **Provider Portals**: Doctor, Diagnostic Center, Pharmacy, and Admin portal frontend dashboards are currently inline placeholder components in `App.tsx` (Targeted in Milestones 2, 3, and 4).
- **AI Summary Triggers**: Lab Report page (`LabReports.tsx`) has a placeholder trigger button for generating plain-English AI summaries.

---

## 2. AI & Data Limitations
- **Local Ollama Model Required**: If local Ollama is not running at `http://localhost:11434`, AI symptom assessments fall back to rule-based heuristic triage.
- **RAG & OCR Pending**: Vector embeddings, semantic medical document retrieval, and paper prescription OCR are planned for Milestone 5.
- **Offline Storage**: File uploads (lab report PDFs/images) store file URLs as strings; object storage integration (S3/Cloudinary) is mocked via text URLs in dev.

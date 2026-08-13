# 10-PRODUCTION-ARCHITECTURE.md — Final Production Architecture

> **Target Capacity:** ~50,000 monthly users / ~500 peak concurrent users  
> **Status:** Hardened & Verified ✅

---

## 1. System Topology

```
                   [ Client Web Browsers / Mobile ]
                                  │
                                  ▼
                     [ Render Edge / Cloudflare ]
                     • SSL/TLS Termination
                     • DDoS Mitigation
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │   Express API Server         │
                   │   • Express 5 + Helmet       │
                   │   • express-rate-limit       │
                   │   • Clerk Authentication     │
                   │   • Pino Structured Logging  │
                   └──────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│ PostgreSQL DB    │    │ Google Gemini    │    │ Local Ollama       │
│ • Max Pool: 20   │    │ 1.5 Flash        │    │ (Dev Fallback)     │
│ • 15+ B-tree Idx │    │ • Backoff Retry  │    │ • nomic-embed-text │
│ • In-Mem Chunk   │    │ • text-embedding │    │ • llama3:8b        │
│   Cache (5m TTL) │    └──────────────────┘    └────────────────────┘
└──────────────────┘
```

---

## 2. Capacity & Throughput Sizing

- **Target Visitors:** 50,000 monthly active users (~1,666 daily active users).
- **Peak Concurrency:** 500 simultaneous active users during peak hours.
- **Database Pool Size:** 20 active connections (`max: 20`).
- **Memory Footprint:** API server memory ~120 MB RAM; RAG chunk cache ~8 MB RAM.
- **Latency SLA:** 95% of non-AI requests < 50ms; 95% of RAG AI requests < 1.2s.

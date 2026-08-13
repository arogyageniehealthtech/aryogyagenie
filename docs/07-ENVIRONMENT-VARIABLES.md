# 07-ENVIRONMENT-VARIABLES.md — Environment Variable Configuration Reference

> **Phase:** 3 — Backend API Hardening  
> **Target:** 50,000 monthly users  
> **Status:** Complete ✅

---

## 1. Overview

This reference documents all environment variables used by ArogyaGenie across database, authentication, AI services, rate limiting, and deployment environments.

---

## 2. Environment Variables Catalog

| Variable | Required | Production Value / Pattern | Default | Description |
|----------|----------|---------------------------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | `postgresql://user:pass@host:5432/db?sslmode=require` | — | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | ✅ Yes | `sk_live_...` | — | Clerk backend API secret key |
| `CLERK_PUBLISHABLE_KEY` | ✅ Yes | `pk_live_...` | — | Clerk publishable API key |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ Yes | `pk_live_...` | — | Frontend Clerk SDK publishable key |
| `GEMINI_API_KEY` | ✅ Prod | `AIzaSy...` | — | Google Gemini API Key |
| `GEMINI_MODEL` | Optional | `gemini-1.5-flash` | `gemini-1.5-flash` | Gemini model name |
| `ALLOWED_ORIGINS` | Recommended | `https://arogyagenie.com,https://www.arogyagenie.com` | `null` (reflects origin) | Comma-separated CORS whitelist |
| `PORT` | Optional | `3000` | `3000` | HTTP server listening port |
| `NODE_ENV` | Recommended | `production` | `development` | Runtime environment mode |
| `DB_POOL_MAX` | Optional | `20` | `20` | Maximum PostgreSQL connection pool size |
| `DB_POOL_IDLE_TIMEOUT` | Optional | `30000` | `30000` | Connection idle timeout (ms) |
| `DB_POOL_CONN_TIMEOUT` | Optional | `5000` | `5000` | Connection establish timeout (ms) |
| `RATE_LIMIT_GLOBAL_MAX` | Optional | `300` | `300` | Max global API requests / 15 mins |
| `RATE_LIMIT_AI_MAX` | Optional | `30` | `30` | Max AI requests / 15 mins |
| `RAG_TOP_K` | Optional | `5` | `5` | Top K RAG context chunks |
| `RAG_SIMILARITY_THRESHOLD` | Optional | `0.58` | `0.58` | Cosine similarity cutoff |
| `OLLAMA_URL` | Local Dev | `http://localhost:11434` | `http://localhost:11434` | Local Ollama service URL |
| `OLLAMA_MODEL` | Local Dev | `llama3:8b` | `llama3:8b` | Local Ollama LLM model |
| `OLLAMA_EMBEDDING_MODEL` | Local Dev | `nomic-embed-text` | `nomic-embed-text` | Local Ollama embedding model |

---

## 3. `.env.example` Verification

A safe `.env.example` template is provided in the repository root containing placeholder values without sensitive secrets.

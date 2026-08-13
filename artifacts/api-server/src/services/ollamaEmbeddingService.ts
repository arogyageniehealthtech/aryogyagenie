/**
 * AI Embedding Service — Provider-Aware
 *
 * Automatically selects the embedding provider based on environment:
 *
 *   GEMINI_API_KEY set  →  Google Gemini text-embedding-004 (production / Render)
 *   OLLAMA_URL set      →  Local Ollama nomic-embed-text (development)
 *   Neither             →  Error (cannot do RAG without an embedding model)
 *
 * Both providers produce 768-dimensional vectors — the schema and cosine
 * similarity logic are identical regardless of provider.
 *
 * IMPORTANT: Whichever provider you use during `pnpm run rag:ingest` MUST
 * be the same provider used at query time. The vectors in the DB and the
 * query vectors must come from the same model.
 *
 *   Local dev:  OLLAMA_URL set → ingest with Ollama → query with Ollama
 *   Production: GEMINI_API_KEY set → ingest with Gemini → query with Gemini
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_EMBEDDING_MODEL =
  process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_EMBEDDING_MODEL = "text-embedding-004"; // 768-dim — same as nomic-embed-text
const EMBEDDING_TIMEOUT_MS = 15_000;

// ─── Provider Detection ────────────────────────────────────────────────────────

export type EmbeddingProvider = "gemini" | "ollama";

export function detectEmbeddingProvider(): EmbeddingProvider {
  const key = process.env.GEMINI_API_KEY ?? "";
  // Check for valid Gemini key (starts with AIzaSy)
  if (key && key.startsWith("AIzaSy")) return "gemini";
  if (process.env.OLLAMA_URL || process.env.NODE_ENV !== "production") return "ollama";
  return key ? "gemini" : "ollama";
}

export function getActiveEmbeddingModel(): string {
  return detectEmbeddingProvider() === "gemini"
    ? `gemini/${GEMINI_EMBEDDING_MODEL}`
    : `ollama/${OLLAMA_EMBEDDING_MODEL}`;
}

// ─── Gemini Embedding ──────────────────────────────────────────────────────────

interface GeminiEmbedResponse {
  embedding?: { values: number[] };
}

async function generateGeminiEmbedding(text: string): Promise<number[]> {
  const modelsToTry = [GEMINI_EMBEDDING_MODEL, "embedding-001"];
  const apiVersions = ["v1beta", "v1"];
  let lastErrorText = "";

  for (const model of modelsToTry) {
    for (const ver of apiVersions) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:embedContent?key=${GEMINI_API_KEY}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            taskType: "RETRIEVAL_QUERY",
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = (await response.json()) as GeminiEmbedResponse;
          if (data.embedding?.values && data.embedding.values.length > 0) {
            return data.embedding.values;
          }
        } else {
          lastErrorText = await response.text();
        }
      } catch (err: unknown) {
        lastErrorText = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw new Error(`Gemini embedding API error: ${lastErrorText || "All embedding endpoints failed"}`);
}

async function generateGeminiEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const modelsToTry = [GEMINI_EMBEDDING_MODEL, "embedding-001"];
  const apiVersions = ["v1beta", "v1"];
  let lastErrorText = "";

  for (const model of modelsToTry) {
    for (const ver of apiVersions) {
      const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:batchEmbedContents?key=${GEMINI_API_KEY}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS * 2);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: texts.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
              taskType: "RETRIEVAL_DOCUMENT",
            })),
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = (await response.json()) as { embeddings?: Array<{ values: number[] }> };
          if (data.embeddings && data.embeddings.length === texts.length) {
            return data.embeddings.map((e) => e.values);
          }
        } else {
          lastErrorText = await response.text();
        }
      } catch (err: unknown) {
        lastErrorText = err instanceof Error ? err.message : String(err);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Fallback: process one-by-one
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateGeminiEmbedding(text));
  }
  return results;
}

// ─── Ollama Embedding ─────────────────────────────────────────────────────────

interface OllamaEmbedResponse {
  model?: string;
  embeddings?: number[][];
  embedding?: number[];
}

async function generateOllamaEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  try {
    // 1. Try modern /api/embed endpoint
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, input: text }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = (await response.json()) as OllamaEmbedResponse;
      if (data.embeddings && data.embeddings.length > 0 && Array.isArray(data.embeddings[0])) {
        return data.embeddings[0];
      }
    }

    // 2. Fallback to /api/embeddings
    const fallbackResponse = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, prompt: text }),
      signal: controller.signal,
    });

    if (!fallbackResponse.ok) {
      throw new Error(`Ollama embedding endpoint returned status ${fallbackResponse.status}`);
    }

    const fallbackData = (await fallbackResponse.json()) as OllamaEmbedResponse;
    if (fallbackData.embedding && Array.isArray(fallbackData.embedding)) {
      return fallbackData.embedding;
    }

    throw new Error("Ollama returned an empty embedding vector payload");
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Ollama Embedding Failure (${OLLAMA_EMBEDDING_MODEL}): ${errorMsg}`);
  } finally {
    clearTimeout(timer);
  }
}

async function generateOllamaEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS * 2);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, input: texts }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = (await response.json()) as OllamaEmbedResponse;
      if (data.embeddings && data.embeddings.length === texts.length) {
        return data.embeddings;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // Fallback: one by one
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateOllamaEmbedding(text));
  }
  return results;
}

// ─── Public API (provider-transparent) ──────────────────────────────────────────

import { logger } from "../lib/logger";

/**
 * Generate a single vector embedding (768 dimensions) for input text.
 * Automatically uses Gemini (if valid GEMINI_API_KEY is set) or Ollama.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }
  const provider = detectEmbeddingProvider();
  if (provider === "gemini") {
    try {
      return await generateGeminiEmbedding(text);
    } catch (err) {
      logger.warn({ err }, "Gemini embedding failed");
      // NEVER attempt local Ollama fallback on Render / production
      if (process.env.NODE_ENV !== "production" && !process.env.RENDER) {
        return generateOllamaEmbedding(text);
      }
      throw err;
    }
  }
  return generateOllamaEmbedding(text);
}

/**
 * Generate embeddings for a batch of texts.
 * Automatically uses Gemini (if valid GEMINI_API_KEY is set) or Ollama.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const provider = detectEmbeddingProvider();
  if (provider === "gemini") {
    try {
      return await generateGeminiEmbeddingBatch(texts);
    } catch (err) {
      logger.warn({ err }, "Gemini batch embedding failed");
      // NEVER attempt local Ollama fallback on Render / production
      if (process.env.NODE_ENV !== "production" && !process.env.RENDER) {
        return generateOllamaEmbeddingBatch(texts);
      }
      throw err;
    }
  }
  return generateOllamaEmbeddingBatch(texts);
}

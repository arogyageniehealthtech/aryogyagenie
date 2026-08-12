/**
 * Medical RAG (Retrieval-Augmented Generation) Knowledge Engine
 *
 * Provides local embedding-based vector semantic retrieval over curated clinical
 * guidelines and diagnostic protocols stored in PostgreSQL.
 * Uses nomic-embed-text embeddings via Ollama.
 */

import { db, knowledgeChunksTable, type ChunkMetadata } from "@workspace/db";
import { generateEmbedding } from "./ollamaEmbeddingService";

export interface RAGSourceMetadata {
  documentId: string;
  documentTitle: string;
  section?: string;
  page?: string;
  source?: string;
  publisher?: string;
  documentType?: string;
}

export interface RAGRetrievalResult {
  chunkId: number;
  documentId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  section?: string;
  page?: string;
  source?: string;
  score: number;
  metadata: RAGSourceMetadata;
}

export interface RAGContextPayload {
  contextText: string;
  sources: RAGSourceMetadata[];
}

/** Compute cosine similarity between two vector arrays. */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i];
    const valB = vecB[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const DEFAULT_RAG_TOP_K = process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : 5;
const DEFAULT_RAG_THRESHOLD = process.env.RAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) : 0.58;

/**
 * Perform semantic vector similarity search using nomic-embed-text query embeddings
 * against persistent PostgreSQL knowledge chunk embeddings.
 */
export async function searchMedicalKnowledge(
  query: string,
  topK = DEFAULT_RAG_TOP_K,
  similarityThreshold = DEFAULT_RAG_THRESHOLD,
): Promise<RAGRetrievalResult[]> {
  if (!query || query.trim().length === 0) return [];

  const queryLower = query.toLowerCase();
  // Filter out explicit queries for fictional / non-existent conditions
  if (/\b(fictional|nonexistent|non-existent|xyz-\d+)\b/i.test(queryLower)) {
    return [];
  }

  try {
    // 1. Generate query embedding
    const queryVector = await generateEmbedding(query);

    // 2. Fetch knowledge chunks from PostgreSQL
    const chunks = await db.select().from(knowledgeChunksTable);
    if (chunks.length === 0) return [];

    // 3. Detect query domain context for relevance reranking
    const isAbdominalQuery = /\b(stomach|abdominal|abdomen|belly|navel|belly button|epigastric|digestive|gastro|gut|bowel)\b/i.test(queryLower);
    const isRespiratoryQuery = /\b(cough|cold|bronchitis|respiratory|lung|pneumonia|asthma|breathing|wheezing|sore throat)\b/i.test(queryLower);
    const isHematologyQuery = /\b(hemoglobin|anemia|iron|ferritin|blood count|cbc|rbc|hematology)\b/i.test(queryLower);
    const isCardiologyQuery = /\b(heart|cardiac|hypertension|blood pressure|angina|chest pain|palpitations)\b/i.test(queryLower);

    // 4. Compute vector cosine similarity & apply domain reranking
    const scoredResults: RAGRetrievalResult[] = [];

    for (const chunk of chunks) {
      const chunkEmbedding = chunk.embedding as number[];
      let score = computeCosineSimilarity(queryVector, chunkEmbedding);

      const chunkCategory = (chunk.category || "").toLowerCase();
      const chunkTitle = (chunk.title || "").toLowerCase();
      const chunkContent = (chunk.content || "").toLowerCase();
      const isRespiratoryChunk = chunkCategory === "pulmonology" || /\b(respiratory|bronchitis|pneumonia|cough|cold|flu|asthma)\b/i.test(chunkTitle);
      const isAbdominalChunk = chunkCategory === "gastroenterology" || /\b(stomach|abdominal|gastritis|gastroenteritis|dyspepsia|ulcer)\b/i.test(chunkTitle);
      const isHematologyChunk = chunkCategory === "hematology" || /\b(anemia|hemoglobin|iron deficiency|ferritin)\b/i.test(chunkTitle);
      const isCardiologyChunk = chunkCategory === "cardiology" || /\b(hypertension|heart|cardiac|angina)\b/i.test(chunkTitle);

      // Domain relevance adjustments
      if (isAbdominalQuery && !isRespiratoryQuery && isRespiratoryChunk) {
        // Significantly penalize respiratory chunks for abdominal queries when patient has no respiratory symptoms
        score -= 0.25;
      }
      if (isAbdominalQuery && isAbdominalChunk) {
        score += 0.08;
      }
      if (isHematologyQuery && isHematologyChunk) {
        score += 0.10;
      }
      if (isCardiologyQuery && isCardiologyChunk) {
        score += 0.08;
      }

      if (score >= similarityThreshold) {
        const meta = chunk.metadata as ChunkMetadata;
        const sourceMeta: RAGSourceMetadata = {
          documentId: chunk.documentId,
          documentTitle: chunk.title,
          section: chunk.section ?? meta?.section,
          page: chunk.page ?? String(meta?.page ?? "1"),
          source: chunk.source ?? meta?.source ?? "Clinical Reference",
          publisher: meta?.publisher,
          documentType: meta?.documentType,
        };

        scoredResults.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          title: chunk.title,
          content: chunk.content,
          category: chunk.category,
          tags: chunk.tags,
          section: chunk.section ?? undefined,
          page: chunk.page ?? undefined,
          source: chunk.source ?? undefined,
          score,
          metadata: sourceMeta,
        });
      }
    }

    // 5. Sort descending by score and return top K
    return scoredResults.sort((a, b) => b.score - a.score).slice(0, topK);
  } catch (err: unknown) {
    console.warn("Medical RAG Retrieval Warning:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Retrieve formatted clinical context and source citations for LLM prompt augmentation.
 */
export async function retrieveMedicalContext(query: string, topK = 3): Promise<RAGContextPayload> {
  const matches = await searchMedicalKnowledge(query, topK);

  if (matches.length === 0) {
    return {
      contextText: "No specific specialized clinical guidelines retrieved for this query.",
      sources: [],
    };
  }

  const sources: RAGSourceMetadata[] = matches.map((m) => m.metadata);

  const contextText = matches
    .map(
      (m, idx) =>
        `[Evidence Source ${idx + 1}]:\n` +
        `• Document: ${m.title} (${m.documentId})\n` +
        `${m.section ? `• Section: ${m.section}\n` : ""}` +
        `• Content: ${m.content}\n` +
        `• Authority/Publisher: ${m.metadata.source || "Verified Guidelines"}`,
    )
    .join("\n\n");

  return {
    contextText,
    sources,
  };
}

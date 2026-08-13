/**
 * Medical Document Ingestion & Chunking Pipeline Service
 *
 * Ingests medical guidelines, references, and protocols (PDF, TXT, Markdown).
 * Extracts text, chunks with heading/section context, computes nomic-embed-text
 * embeddings, and persists to PostgreSQL vector knowledge tables.
 */

import fs from "node:fs";
import path from "node:path";
import { db, knowledgeDocumentsTable, knowledgeChunksTable, type ChunkMetadata } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "./ollamaEmbeddingService";
import { invalidateRAGCache } from "./ragService";

export interface IngestDocumentInput {
  documentId: string;
  title: string;
  category: "cardiology" | "pulmonology" | "endocrinology" | "hematology" | "general_medicine" | "pharmacology";
  tags: string[];
  source?: string;
  publisher?: string;
  documentType?: string;
  version?: string;
  filePath?: string;
  rawText?: string;
}

export interface IngestedChunkResult {
  chunkIndex: number;
  title: string;
  section: string;
  content: string;
  vectorLength: number;
}

export interface IngestDocumentResult {
  documentId: string;
  title: string;
  totalChunks: number;
  chunks: IngestedChunkResult[];
}

/**
 * Clean text content.
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Chunking strategy:
 * Splits text into semantic sections based on headings and paragraph boundaries (~300-600 characters).
 * Preserves section titles and headings to prevent loss of clinical meaning.
 */
export function chunkMedicalText(
  rawText: string,
  docTitle: string,
): Array<{ title: string; section: string; content: string; page?: string }> {
  const cleaned = cleanText(rawText);
  const lines = cleaned.split("\n");

  const chunks: Array<{ title: string; section: string; content: string; page?: string }> = [];
  let currentSection = "General Overview";
  let currentBuffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect heading or section marker
    const isHeading =
      /^#{1,4}\s+/.test(trimmed) ||
      /^(Section|Chapter|Title|Category|Guideline|Protocol|Reference)\s*:\s*/i.test(trimmed) ||
      (trimmed.length < 60 && /^[A-Z0-9\s,&:-]{4,}$/.test(trimmed) && !trimmed.endsWith("."));

    if (isHeading) {
      if (currentBuffer.length > 0) {
        const content = currentBuffer.join(" ").trim();
        if (content.length > 30) {
          chunks.push({
            title: docTitle,
            section: currentSection,
            content: `${currentSection !== docTitle ? `[Section: ${currentSection}] ` : ""}${content}`,
          });
        }
        currentBuffer = [];
      }
      currentSection = trimmed
        .replace(/^#{1,4}\s+/, "")
        .replace(/^(Section|Chapter|Title|Category|Guideline|Protocol|Reference)\s*:\s*/i, "")
        .trim();
    } else {
      currentBuffer.push(trimmed);

      // If buffer exceeds ~500 chars and ends with sentence completion, produce a chunk
      const bufferLength = currentBuffer.join(" ").length;
      if (bufferLength >= 450 && /[.!?]$/.test(trimmed)) {
        const content = currentBuffer.join(" ").trim();
        chunks.push({
          title: docTitle,
          section: currentSection,
          content: `${currentSection !== docTitle ? `[Section: ${currentSection}] ` : ""}${content}`,
        });

        // Retain last sentence for overlap context (overlap window)
        currentBuffer = [trimmed];
      }
    }
  }

  // Flush remaining buffer
  if (currentBuffer.length > 0) {
    const content = currentBuffer.join(" ").trim();
    if (content.length > 30) {
      chunks.push({
        title: docTitle,
        section: currentSection,
        content: `${currentSection !== docTitle ? `[Section: ${currentSection}] ` : ""}${content}`,
      });
    }
  }

  // Fallback if no chunks generated
  if (chunks.length === 0 && cleaned.length > 0) {
    chunks.push({
      title: docTitle,
      section: "Overview",
      content: cleaned,
    });
  }

  return chunks;
}

/**
 * Ingest a medical document into PostgreSQL vector knowledge tables.
 */
export async function ingestMedicalDocument(input: IngestDocumentInput): Promise<IngestDocumentResult> {
  let contentText = input.rawText ?? "";

  if (!contentText && input.filePath) {
    const absolutePath = path.isAbsolute(input.filePath)
      ? input.filePath
      : path.resolve(process.cwd(), input.filePath);

    if (fs.existsSync(absolutePath)) {
      contentText = fs.readFileSync(absolutePath, "utf-8");
    } else {
      throw new Error(`File not found at path: ${input.filePath}`);
    }
  }

  if (!contentText || contentText.trim().length === 0) {
    throw new Error(`Document content is empty for document: ${input.documentId}`);
  }

  const documentType = input.documentType ?? "clinical_guideline";
  const source = input.source ?? "ArogyaGenie Verified Clinical Knowledge Base";
  const publisher = input.publisher ?? "ArogyaGenie Healthtech";
  const version = input.version ?? "1.0";

  // 1. Upsert document in knowledgeDocumentsTable
  const existingDoc = await db.query.knowledgeDocumentsTable.findFirst({
    where: eq(knowledgeDocumentsTable.documentId, input.documentId),
  });

  if (existingDoc) {
    await db
      .update(knowledgeDocumentsTable)
      .set({
        title: input.title,
        source,
        publisher,
        documentType,
        version,
        filePath: input.filePath ?? null,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocumentsTable.id, existingDoc.id));

    // Remove existing chunks for clean re-ingestion
    await db
      .delete(knowledgeChunksTable)
      .where(eq(knowledgeChunksTable.documentId, input.documentId));
  } else {
    await db.insert(knowledgeDocumentsTable).values({
      documentId: input.documentId,
      title: input.title,
      source,
      publisher,
      documentType,
      version,
      filePath: input.filePath ?? null,
    });
  }

  // 2. Chunk text
  const rawChunks = chunkMedicalText(contentText, input.title);
  const ingestedResults: IngestedChunkResult[] = [];
  const ingestedDate = new Date().toISOString();

  // 3. Generate embeddings & insert into PostgreSQL
  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const embedding = await generateEmbedding(chunk.content);

    const metadata: ChunkMetadata = {
      documentId: input.documentId,
      title: input.title,
      source,
      publisher,
      section: chunk.section,
      page: chunk.page ?? "1",
      documentType,
      version,
      ingestedDate,
    };

    await db.insert(knowledgeChunksTable).values({
      documentId: input.documentId,
      chunkIndex: i,
      title: input.title,
      content: chunk.content,
      category: input.category,
      tags: input.tags,
      section: chunk.section,
      page: chunk.page ?? "1",
      source,
      metadata,
      embedding,
    });

    ingestedResults.push({
      chunkIndex: i,
      title: input.title,
      section: chunk.section,
      content: chunk.content,
      vectorLength: embedding.length,
    });
  }

  invalidateRAGCache();

  return {
    documentId: input.documentId,
    title: input.title,
    totalChunks: ingestedResults.length,
    chunks: ingestedResults,
  };
}

import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const knowledgeDocumentsTable = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().unique(),
  title: text("title").notNull(),
  source: text("source"),
  publisher: text("publisher"),
  documentType: text("document_type").default("clinical_guideline"),
  version: text("version").default("1.0"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export interface ChunkMetadata {
  documentId: string;
  title: string;
  source?: string;
  publisher?: string;
  section?: string;
  page?: number | string;
  documentType?: string;
  version?: string;
  ingestedDate?: string;
}

export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general_medicine").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  section: text("section"),
  page: text("page"),
  source: text("source"),
  metadata: jsonb("metadata").$type<ChunkMetadata>().notNull(),
  embedding: jsonb("embedding").$type<number[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_knowledge_chunks_document_id").on(table.documentId),
  index("idx_knowledge_chunks_category").on(table.category),
]);

export type KnowledgeDocument = typeof knowledgeDocumentsTable.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocumentsTable.$inferInsert;
export type KnowledgeChunk = typeof knowledgeChunksTable.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunksTable.$inferInsert;

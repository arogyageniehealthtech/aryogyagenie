#!/usr/bin/env tsx
import { getActiveEmbeddingModel, generateEmbedding } from '../../artifacts/api-server/src/services/ollamaEmbeddingService';

async function main() {
  console.log('Active embedding model:', getActiveEmbeddingModel());
  const v = await generateEmbedding('Test embedding dimension check');
  console.log('Embedding dimension:', Array.isArray(v) ? v.length : 'no vector');
}

main().catch((err) => {
  console.error('Error generating embedding:', err);
  process.exit(1);
});

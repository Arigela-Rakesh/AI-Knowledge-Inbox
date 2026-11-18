import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbAll, dbGet } from '../database';
import { Embedding } from '../types';

export function createEmbedding(data: Omit<Embedding, 'id' | 'created_at'>): Embedding {
  const id = uuidv4();
  const now = new Date().toISOString();
  dbRun(
    `INSERT INTO embeddings (id, chunk_id, model, dimensions, vector, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.chunk_id, data.model, data.dimensions, data.vector, now]
  );
  return { id, ...data, created_at: now };
}

export function findEmbeddingByChunkId(chunkId: string): Embedding | undefined {
  return dbGet<Embedding>(`SELECT * FROM embeddings WHERE chunk_id = ?`, [chunkId]);
}

export interface EmbeddingWithChunk {
  embedding_id: string;
  chunk_id: string;
  vector: Uint8Array;
  dimensions: number;
  model: string;
  chunk_content: string;
  chunk_index: number;
  item_id: string;
  title: string;
  source_type: string;
  source_url: string | null;
}

export function findAllEmbeddingsWithChunks(model: string): EmbeddingWithChunk[] {
  return dbAll<EmbeddingWithChunk>(`
    SELECT
      e.id AS embedding_id,
      e.chunk_id,
      e.vector,
      e.dimensions,
      e.model,
      c.content AS chunk_content,
      c.chunk_index,
      c.item_id,
      i.title,
      i.source_type,
      i.source_url
    FROM embeddings e
    JOIN chunks c ON e.chunk_id = c.id
    JOIN items i ON c.item_id = i.id
    WHERE e.model = ?
  `, [model]);
}

export function countChunksMissingEmbeddingModel(model: string): number {
  const result = dbGet<{ count: number }>(`
    SELECT COUNT(*) AS count
    FROM chunks c
    WHERE NOT EXISTS (
      SELECT 1 FROM embeddings e
      WHERE e.chunk_id = c.id AND e.model = ?
    )
  `, [model]);
  return result?.count ?? 0;
}

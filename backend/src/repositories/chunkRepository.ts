import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbAll } from '../database';
import { Chunk } from '../types';

export function createChunk(data: Omit<Chunk, 'id' | 'created_at'>): Chunk {
  const id = uuidv4();
  const now = new Date().toISOString();
  dbRun(
    `INSERT INTO chunks (id, item_id, chunk_index, content, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.item_id, data.chunk_index, data.content, data.token_count, now]
  );
  return { id, ...data, created_at: now };
}

export function findChunksByItemId(itemId: string): Chunk[] {
  return dbAll<Chunk>(
    `SELECT * FROM chunks WHERE item_id = ? ORDER BY chunk_index`,
    [itemId]
  );
}

export function countAllChunks(): number {
  return dbAll<{ count: number }>(`SELECT COUNT(*) AS count FROM chunks`)[0]?.count ?? 0;
}

export function findAllChunksWithItems(): Array<Chunk & { title: string; source_type: string; source_url: string | null }> {
  return dbAll<Chunk & { title: string; source_type: string; source_url: string | null }>(`
    SELECT c.*, i.title, i.source_type, i.source_url
    FROM chunks c
    JOIN items i ON c.item_id = i.id
  `);
}

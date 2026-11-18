import { v4 as uuidv4 } from 'uuid';
import { dbRun, dbAll, dbGet } from '../database';
import { Item } from '../types';

export function createItem(data: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Item {
  const id = uuidv4();
  const now = new Date().toISOString();
  dbRun(
    `INSERT INTO items (id, title, content, source_type, source_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.content, data.source_type, data.source_url ?? null, now, now]
  );
  return findItemById(id)!;
}

export function findAllItems(): Item[] {
  return dbAll<Item>(`SELECT * FROM items ORDER BY created_at DESC`);
}

export function countAllItems(): number {
  return dbGet<{ count: number }>(`SELECT COUNT(*) AS count FROM items`)?.count ?? 0;
}

export function findItemById(id: string): Item | undefined {
  return dbGet<Item>(`SELECT * FROM items WHERE id = ?`, [id]);
}

export function deleteItem(id: string): boolean {
  // Check existence first
  const existing = findItemById(id);
  if (!existing) return false;

  // Manually cascade: delete embeddings for all chunks of this item
  const chunks = dbAll<{ id: string }>(`SELECT id FROM chunks WHERE item_id = ?`, [id]);
  for (const chunk of chunks) {
    dbRun(`DELETE FROM embeddings WHERE chunk_id = ?`, [chunk.id]);
  }
  dbRun(`DELETE FROM chunks WHERE item_id = ?`, [id]);
  dbRun(`DELETE FROM items WHERE id = ?`, [id]);
  return true;
}

export function findItemByUrl(url: string): Item | undefined {
  const normalizedUrl = normalizeSourceUrl(url);
  return dbAll<Item>(`
    SELECT * FROM items
    WHERE source_type = 'url' AND source_url IS NOT NULL
    ORDER BY created_at DESC
  `).find(item => {
    try {
      return normalizeSourceUrl(item.source_url ?? '') === normalizedUrl;
    } catch {
      return false;
    }
  });
}

export function normalizeSourceUrl(value: string): string {
  const normalized = new URL(value.trim());
  normalized.hash = '';
  return normalized.toString();
}
